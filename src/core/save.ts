import { LOCATION_IDS, REPAIR_IDS, RESOURCE_IDS, type LocationId } from './data';
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
  | { status: 'ok'; state: GameState; savedAt: number }
  | { status: 'empty' }
  | { status: 'corrupt'; reason: string };

/**
 * Parses and sanitises a save. Anything malformed is clamped to a safe value
 * rather than trusted: counts become non-negative integers, unknown keys are
 * dropped, and impossible timestamps disable the activity.
 */
export function deserialize(raw: string | null, now: number, seed: number): LoadResult {
  if (raw === null || raw === '') return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', reason: 'Save is not valid JSON.' };
  }
  if (!isObject(parsed)) return { status: 'corrupt', reason: 'Save is not an object.' };

  const migrated = migrate(parsed);
  if (!migrated) return { status: 'corrupt', reason: `Unsupported save version: ${String(parsed.version)}` };

  const s = migrated.state;
  if (!isObject(s)) return { status: 'corrupt', reason: 'Save has no state.' };

  const base = createInitialState(now, seed);

  const skills = isObject(s.skills) ? s.skills : {};
  const scav = isObject(skills.scavenging) ? skills.scavenging : {};
  base.skills.scavenging.xp = toCount(scav.xp);

  const inv = isObject(s.inventory) ? s.inventory : {};
  for (const id of RESOURCE_IDS) base.inventory[id] = toCount(inv[id]);

  const repairs = isObject(s.repairs) ? s.repairs : {};
  for (const id of REPAIR_IDS) base.repairs[id] = repairs[id] === true;

  if (typeof s.rngState === 'number' && Number.isFinite(s.rngState)) base.rngState = s.rngState >>> 0;

  const stats = isObject(s.stats) ? s.stats : {};
  base.stats.totalSearches = toCount(stats.totalSearches);

  if (typeof s.createdAt === 'number' && Number.isFinite(s.createdAt)) base.createdAt = s.createdAt;

  const act = s.activity;
  if (
    isObject(act) &&
    act.skill === 'scavenging' &&
    typeof act.locationId === 'string' &&
    (LOCATION_IDS as readonly string[]).includes(act.locationId) &&
    typeof act.lastProcessedAt === 'number' &&
    Number.isFinite(act.lastProcessedAt) &&
    act.lastProcessedAt > 0
  ) {
    base.activity = {
      skill: 'scavenging',
      locationId: act.locationId as LocationId,
      lastProcessedAt: act.lastProcessedAt,
    };
  }

  const savedAt = typeof migrated.savedAt === 'number' && Number.isFinite(migrated.savedAt) ? migrated.savedAt : now;
  return { status: 'ok', state: base, savedAt };
}

/** Upgrades older envelopes to the current version. Returns null if unknown. */
function migrate(envelope: Record<string, unknown>): Record<string, unknown> | null {
  const version = envelope.version;
  if (version === SAVE_VERSION) return envelope;
  // Future: if (version === 1) envelope = migrateV1toV2(envelope); …
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}
