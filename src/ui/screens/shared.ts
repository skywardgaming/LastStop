// Shared screen context, helpers and content lookups.

import { ITEMS, type ItemId, type ItemKind } from '../../core/content/items';
import { OBJECTIVES, type ObjectiveDef, type SpeakerId } from '../../core/content/story';
import {
  LOCATION_IDS,
  LOCATIONS,
  PROJECT_IDS,
  PROJECTS,
  RECIPE_IDS,
  RECIPES,
  REPAIRS,
  SALVAGE,
  SALVAGE_IDS,
  SKILL_NAMES,
  TOOLS,
  TRAIN_PART_IDS,
  type ProjectId,
  type RecipeCategory,
  type SkillId,
  type ToolId,
  type TrainPartId,
} from '../../core/content/world';
import { projectProgress, type ActivitySpec } from '../../core/rules';
import type { GameState, Inventory } from '../../core/state';
import { artUrl, MARKER_ART, NAV_ART } from '../art';
import type { Tone } from '../kit';

export type Tab = 'station' | 'skills' | 'train' | 'satchel' | 'journal';
export type JournalSection = 'chapters' | 'finds' | 'people' | 'feats' | 'records';
export type SatchelFilter = 'all' | ItemKind;
export type SatchelSort = 'rarity' | 'name' | 'qty';

export interface UiState {
  tab: Tab;
  skill: SkillId;
  recipeCat: RecipeCategory;
  journal: JournalSection;
  satchelFilter: SatchelFilter;
  satchelSort: SatchelSort;
  trainPart: TrainPartId | null;
  /** Expanded rows / sections, by key. */
  open: Record<string, boolean>;
}

export interface RewardEvent {
  at: number;
  skill: SkillId;
  xp: number;
  actions: number;
  items: [ItemId, number][];
}

export interface Actions {
  start(spec: ActivitySpec): void;
  stop(): void;
  requestRepair(id: TrainPartId): void;
  equip(id: ToolId): void;
  unequip(skill: SkillId): void;
  openTools(skill: SkillId): void;
  openItem(id: ItemId): void;
  openDiscovery(id: string): void;
  openCharacter(id: SpeakerId): void;
  openDialogue(id: string): void;
  openHistory(): void;
  go(tab: Tab, sub?: SkillId | JournalSection | TrainPartId): void;
  setUi(patch: Partial<UiState>): void;
  toggle(key: string): void;
}

export interface ScreenCtx {
  state: GameState;
  ui: UiState;
  act: Actions;
  history: RewardEvent[];
}

// ---------- skills ----------

export const SKILL_TONE: Record<SkillId, Tone> = {
  scavenging: 'teal',
  engineering: 'copper',
  salvaging: 'amber',
  research: 'cyan',
};

export const SKILL_LABEL: Record<SkillId, string> = {
  scavenging: 'Scavenging',
  engineering: 'Engineering',
  salvaging: 'Salvaging',
  research: 'Research',
};

/** 24×24 emblems from the Rebirth UI set. */
export function skillEmblem(skill: SkillId): string {
  switch (skill) {
    case 'scavenging':
      return artUrl(MARKER_ART.derelictPlatform ?? '');
    case 'engineering':
      return artUrl(NAV_ART.skills ?? '');
    case 'salvaging':
      return artUrl(MARKER_ART.maintenanceShed ?? '');
    case 'research':
      return artUrl(NAV_ART.journal ?? '');
  }
}

export function specKey(spec: ActivitySpec): string {
  switch (spec.kind) {
    case 'scavenge':
      return `scavenge:${spec.locationId}`;
    case 'craft':
      return `craft:${spec.recipeId}`;
    case 'salvage':
      return `salvage:${spec.targetId}`;
    case 'research':
      return `research:${spec.projectId}`;
  }
}

export function isRunning(state: GameState, spec: ActivitySpec): boolean {
  return state.activity !== null && specKey(state.activity) === specKey(spec);
}

export function activityVerb(state: GameState): { verb: string; target: string } {
  const a = state.activity;
  if (!a) return { verb: 'Idle', target: '' };
  switch (a.kind) {
    case 'scavenge':
      return { verb: 'Searching', target: LOCATIONS[a.locationId].name };
    case 'craft':
      return { verb: 'Crafting', target: ITEMS[RECIPES[a.recipeId].output].name };
    case 'salvage':
      return { verb: 'Salvaging', target: SALVAGE[a.targetId].name };
    case 'research': {
      const p = projectProgress(state, a.projectId);
      return { verb: 'Studying', target: `${PROJECTS[a.projectId].name}${p ? ` · ${p[0]}/${p[1]}` : ''}` };
    }
  }
}

// ---------- items ----------

export function seen(state: GameState, id: ItemId): boolean {
  return (state.stats.obtained[id] ?? 0) > 0 || state.inventory[id] > 0 || Object.values(state.equipment).includes(id as ToolId);
}

export function rarityOf(id: ItemId): 'common' | 'uncommon' | 'rare' {
  return ITEMS[id].rarity;
}

export interface ItemLink {
  label: string;
  sub?: string;
  go?: () => void;
}

/** Where an item comes from, each with a real navigation target. */
export function itemSources(id: ItemId, act: Actions): ItemLink[] {
  const out: ItemLink[] = [];
  for (const loc of LOCATION_IDS) {
    const d = LOCATIONS[loc].drops.find((x) => x.item === id);
    if (d) out.push({ label: `Search · ${LOCATIONS[loc].name}`, sub: pct(d.chance), go: () => act.go('skills', 'scavenging') });
  }
  for (const t of SALVAGE_IDS) {
    const d = SALVAGE[t].drops.find((x) => x.item === id);
    if (d) out.push({ label: `Salvage · ${SALVAGE[t].name}`, sub: pct(d.chance), go: () => act.go('skills', 'salvaging') });
  }
  for (const r of RECIPE_IDS) {
    if (RECIPES[r].output !== id) continue;
    const bp = RECIPES[r].research;
    out.push({ label: `Engineering · Lv ${RECIPES[r].levelRequired}${bp ? ` · blueprint: ${PROJECTS[bp].name}` : ''}`, go: () => act.go('skills', 'engineering') });
  }
  return out;
}

/** What an item is used for, each with a real navigation target. */
export function itemUses(id: ItemId, act: Actions): ItemLink[] {
  const out: ItemLink[] = [];
  for (const r of RECIPE_IDS) {
    const n = RECIPES[r].inputs[id];
    if (n) out.push({ label: ITEMS[RECIPES[r].output].name, sub: `×${n}`, go: () => act.go('skills', 'engineering') });
  }
  for (const p of TRAIN_PART_IDS) {
    const n = REPAIRS[p].cost[id];
    if (n) out.push({ label: `No. 9 · ${REPAIRS[p].name}`, sub: `×${n}`, go: () => act.go('train', p) });
  }
  for (const t of SALVAGE_IDS) {
    if (SALVAGE[t].input?.[id]) out.push({ label: `Salvage · ${SALVAGE[t].name}`, sub: '×1', go: () => act.go('skills', 'salvaging') });
  }
  for (const p of PROJECT_IDS) {
    const n = PROJECTS[p].input[id];
    if (n) out.push({ label: `Research · ${PROJECTS[p].name}`, sub: `×${n} each`, go: () => act.go('skills', 'research') });
  }
  return out;
}

export function pct(n: number): string {
  if (n >= 1) return 'Always';
  const v = n * 100;
  return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)}%`;
}

// ---------- objectives ----------

export const OBJECTIVE_ROUTES: Record<string, [Tab, (SkillId | JournalSection | TrainPartId)?]> = {
  search10: ['skills', 'scavenging'],
  plates: ['skills', 'engineering'],
  firebox: ['train', 'fireboxDoor'],
  salvage: ['skills', 'salvaging'],
  study: ['skills', 'research'],
  tool: ['skills', 'engineering'],
  cabinet: ['skills', 'scavenging'],
  headlamp: ['train', 'headlamp'],
  key: ['skills', 'scavenging'],
  shed: ['skills', 'scavenging'],
  dryCab: ['train', 'dryCab'],
  tender: ['train', 'reinforcedStorage'],
  methods: ['skills', 'research'],
  boiler: ['train', 'boiler'],
  lanterns: ['train', 'cabLanterns'],
  winch: ['train', 'tenderWinch'],
  tier3: ['skills', 'engineering'],
  research8: ['skills', 'research'],
  receiver: ['train', 'signalReceiver'],
  all15: ['journal', 'records'],
};

export function objectiveStatus(state: GameState): { done: number; total: number; current: ObjectiveDef | null } {
  let done = 0;
  let current: ObjectiveDef | null = null;
  for (const o of OBJECTIVES) {
    const [c, t] = o.progress(state);
    if (c >= t) done++;
    else if (!current) current = o;
  }
  return { done, total: OBJECTIVES.length, current };
}

export function objectiveDone(state: GameState, o: ObjectiveDef): boolean {
  const [c, t] = o.progress(state);
  return c >= t;
}

// ---------- milestones ----------

export interface Milestone {
  level: number;
  text: string;
}

/** Everything a skill unlocks, by level (derived from content, nothing invented). */
export function skillMilestones(skill: SkillId): Milestone[] {
  const out: Milestone[] = [];
  if (skill === 'scavenging') for (const l of LOCATION_IDS) out.push({ level: LOCATIONS[l].levelRequired, text: LOCATIONS[l].name });
  if (skill === 'engineering') {
    for (const r of RECIPE_IDS) out.push({ level: RECIPES[r].levelRequired, text: `${ITEMS[RECIPES[r].output].name}${RECIPES[r].research ? ' (blueprint)' : ''}` });
    for (const t of TRAIN_PART_IDS) out.push({ level: REPAIRS[t].levelRequired, text: `No. 9 · ${REPAIRS[t].name}` });
  }
  if (skill === 'salvaging') for (const t of SALVAGE_IDS) out.push({ level: SALVAGE[t].levelRequired, text: SALVAGE[t].name });
  if (skill === 'research') for (const p of PROJECT_IDS) out.push({ level: PROJECTS[p].levelRequired, text: PROJECTS[p].name });
  for (const t of Object.keys(TOOLS) as ToolId[]) {
    if (TOOLS[t].skill === skill && TOOLS[t].levelRequired > 1) out.push({ level: TOOLS[t].levelRequired, text: `Equip ${ITEMS[t].name}` });
  }
  return out.sort((a, b) => a.level - b.level || a.text.localeCompare(b.text));
}

// ---------- rewards ----------

/** Totals per item over a list of reward events, biggest first by rarity then count. */
export function aggregate(events: RewardEvent[]): { items: [ItemId, number][]; xp: Partial<Record<SkillId, number>>; actions: number } {
  const items = new Map<ItemId, number>();
  const xp: Partial<Record<SkillId, number>> = {};
  let actions = 0;
  for (const e of events) {
    actions += e.actions;
    xp[e.skill] = (xp[e.skill] ?? 0) + e.xp;
    for (const [id, n] of e.items) items.set(id, (items.get(id) ?? 0) + n);
  }
  const rank = { rare: 2, uncommon: 1, common: 0 } as const;
  const sorted = [...items.entries()].sort((a, b) => rank[rarityOf(b[0])] - rank[rarityOf(a[0])] || b[1] - a[1]);
  return { items: sorted, xp, actions };
}

export function inventoryKinds(inv: Inventory): Record<SatchelFilter, number> {
  const out: Record<SatchelFilter, number> = { all: 0, material: 0, component: 0, machinery: 0, tool: 0 };
  for (const id of Object.keys(inv) as ItemId[]) {
    if (inv[id] <= 0) continue;
    out.all++;
    out[ITEMS[id].kind]++;
  }
  return out;
}

export const SKILL_NAME = SKILL_NAMES;
export type { ProjectId };
