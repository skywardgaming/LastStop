// Versioned saves. Old saves are migrated step by step; every value is then
// sanitised rather than trusted.

import { ITEM_IDS, type ItemId } from './content/items';
import { DISCOVERY_BY_ID, DIALOGUE_BY_ID, ACHIEVEMENTS } from './content/story';
import { LOCATION_IDS, RECIPE_IDS, REPAIR_IDS, SKILL_IDS, type LocationId, type RecipeId } from './content/world';
import { createInitialState, SAVE_VERSION, type GameState } from './state';

export interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

export function serialize(state: GameState, now: number): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: now, state };
  return JSON.stringify(envelope);
}

export type LoadResult =
  | { status: 'ok'; state: GameState; savedAt: number; migratedFrom: number | null }
  | { status: 'empty' }
  | { status: 'corrupt'; reason: string };

type Obj = Record<string, unknown>;

export function deserialize(raw: string | null, now: number, seed: number): LoadResult {
  if (raw === null || raw === '') return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', reason: 'Save is not valid JSON.' };
  }
  if (!isObject(parsed)) return { status: 'corrupt', reason: 'Save is not an object.' };

  const fromVersion = typeof parsed.version === 'number' ? parsed.version : NaN;
  const migrated = migrate(parsed);
  if (!migrated) return { status: 'corrupt', reason: `Unsupported save version: ${String(parsed.version)}` };
  const s = migrated.state;
  if (!isObject(s)) return { status: 'corrupt', reason: 'Save has no state.' };

  const state = sanitize(s, now, seed);
  const savedAt = finite(migrated.savedAt) ? migrated.savedAt : now;
  return { status: 'ok', state, savedAt, migratedFrom: fromVersion === SAVE_VERSION ? null : fromVersion };
}

// ---------- migrations ----------

/** Upgrades an envelope one version at a time. Returns null if unknown. */
export function migrate(envelope: Obj): Obj | null {
  let e: Obj = envelope;
  if (e.version === 1) e = migrateV1toV2(e);
  return e.version === SAVE_VERSION ? e : null;
}

/** v1 (Prototype 0.1): one skill, three resources, Firebox Door only. */
function migrateV1toV2(e: Obj): Obj {
  const s = isObject(e.state) ? e.state : {};
  const skills = isObject(s.skills) ? s.skills : {};
  const act = isObject(s.activity) ? s.activity : null;
  const lastProcessedAt = act && finite(act.lastProcessedAt) ? act.lastProcessedAt : 0;
  const stats = isObject(s.stats) ? s.stats : {};
  const savedAt = finite(e.savedAt) ? e.savedAt : 0;
  return {
    version: 2,
    savedAt: e.savedAt,
    state: {
      ...s,
      version: 2,
      skills: { scavenging: skills.scavenging, engineering: { xp: 0 } },
      activity:
        act && act.skill === 'scavenging'
          ? { kind: 'scavenge', locationId: act.locationId, lastProcessedAt }
          : null,
      stats: {
        searches: { derelictPlatform: stats.totalSearches },
        crafts: 0,
        rareFinds: 0,
        obtained: isObject(s.inventory) ? s.inventory : {},
        longestAwayMs: 0,
      },
      // v1 saves never tracked a clock high-water mark; the last save time
      // (or the activity anchor) is the latest moment we know was credited.
      clockHighWater: Math.max(savedAt, lastProcessedAt),
      // Veterans of 0.1 have already met the railway.
      onboarded: true,
    },
  };
}

// ---------- sanitising ----------

function sanitize(s: Obj, now: number, seed: number): GameState {
  const base = createInitialState(now, seed);

  const skills = isObject(s.skills) ? s.skills : {};
  for (const id of SKILL_IDS) {
    const sk = isObject(skills[id]) ? skills[id] : {};
    base.skills[id].xp = count(sk.xp);
  }

  const inv = isObject(s.inventory) ? s.inventory : {};
  for (const id of ITEM_IDS) base.inventory[id] = count(inv[id]);

  const repairs = isObject(s.repairs) ? s.repairs : {};
  for (const id of REPAIR_IDS) base.repairs[id] = repairs[id] === true;

  const disc = isObject(s.discoveries) ? s.discoveries : {};
  for (const [id, at] of Object.entries(disc)) if (id in DISCOVERY_BY_ID) base.discoveries[id] = count(at);

  const ach = isObject(s.achievements) ? s.achievements : {};
  const achIds = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const [id, at] of Object.entries(ach)) if (achIds.has(id)) base.achievements[id] = count(at);

  const dlg = isObject(s.dialogues) ? s.dialogues : {};
  const ids = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x in DIALOGUE_BY_ID))] : [];
  base.dialogues.unlocked = ids(dlg.unlocked);
  base.dialogues.read = ids(dlg.read).filter((id) => base.dialogues.unlocked.includes(id));

  if (finite(s.rngState)) base.rngState = s.rngState >>> 0;
  if (finite(s.createdAt)) base.createdAt = s.createdAt;
  base.onboarded = s.onboarded === true;

  const stats = isObject(s.stats) ? s.stats : {};
  const searches = isObject(stats.searches) ? stats.searches : {};
  for (const id of LOCATION_IDS) {
    const n = count(searches[id]);
    if (n > 0) base.stats.searches[id] = n;
  }
  base.stats.crafts = count(stats.crafts);
  base.stats.rareFinds = count(stats.rareFinds);
  base.stats.longestAwayMs = count(stats.longestAwayMs);
  const obtained = isObject(stats.obtained) ? stats.obtained : {};
  for (const id of ITEM_IDS) {
    const n = count(obtained[id]);
    if (n > 0) base.stats.obtained[id as ItemId] = n;
  }

  // Clock high-water: the latest moment ever credited. Kept strictly, even
  // if it is ahead of the device clock, so winding the clock forward and
  // back cannot farm the offline window twice.
  base.clockHighWater = finite(s.clockHighWater) && s.clockHighWater > 0 ? s.clockHighWater : 0;

  const act = isObject(s.activity) ? s.activity : null;
  if (act && finite(act.lastProcessedAt) && act.lastProcessedAt > 0) {
    const at = act.lastProcessedAt;
    if (act.kind === 'scavenge' && typeof act.locationId === 'string' && (LOCATION_IDS as readonly string[]).includes(act.locationId)) {
      base.activity = { kind: 'scavenge', locationId: act.locationId as LocationId, lastProcessedAt: at };
    } else if (act.kind === 'craft' && typeof act.recipeId === 'string' && (RECIPE_IDS as readonly string[]).includes(act.recipeId)) {
      base.activity = { kind: 'craft', recipeId: act.recipeId as RecipeId, lastProcessedAt: at };
    }
  }
  return base;
}

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function count(value: unknown): number {
  if (!finite(value) || value < 0) return 0;
  return Math.floor(value);
}
