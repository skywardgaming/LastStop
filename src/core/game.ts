// Player-facing operations. Every operation settles timed progress first, so
// bonuses and spending never apply retroactively, then evaluates feats and
// story beats. The UI only calls these functions.

import { ACHIEVEMENTS, DIALOGUES } from './content/story';
import { REPAIRS, TOOLS, type LocationId, type ProjectId, type RecipeId, type SalvageId, type ToolId, type TrainPartId } from './content/world';
import { advance, type AdvanceResult } from './activity';
import { addItems, removeItems } from './inventory';
import { repairBlockers, startAccess, toolAccess, type ActivitySpec, type RepairBlocker } from './rules';
import type { Activity, GameState } from './state';

export interface Progression {
  achievements: string[];
  dialogues: string[];
}

export interface TickResult extends AdvanceResult, Progression {}

/** Unlocks any feats and dialogues whose conditions now hold. */
export function evaluate(state: GameState, now: number): { state: GameState } & Progression {
  const newAchievements = ACHIEVEMENTS.filter((a) => !(a.id in state.achievements) && a.when(state)).map((a) => a.id);
  const unlocked = new Set(state.dialogues.unlocked);
  const newDialogues = DIALOGUES.filter((d) => !unlocked.has(d.id) && d.when(state)).map((d) => d.id);
  if (newAchievements.length === 0 && newDialogues.length === 0) return { state, achievements: [], dialogues: [] };
  const achievements = { ...state.achievements };
  for (const id of newAchievements) achievements[id] = now;
  return {
    state: {
      ...state,
      achievements,
      dialogues: { ...state.dialogues, unlocked: [...state.dialogues.unlocked, ...newDialogues] },
    },
    achievements: newAchievements,
    dialogues: newDialogues,
  };
}

export function tick(state: GameState, now: number): TickResult {
  const result = advance(state, now);
  const evaluated = evaluate(result.state, now);
  return { ...result, state: evaluated.state, achievements: evaluated.achievements, dialogues: evaluated.dialogues };
}

/** A new activity never starts before time already credited. */
function startTime(state: GameState, now: number): number {
  return Math.max(now, state.clockHighWater);
}

export type StartResult = { ok: true; tick: TickResult } | { ok: false; reason: string; tick: TickResult };

export function startActivity(state: GameState, spec: ActivitySpec, now: number): StartResult {
  const settled = tick(state, now);
  const access = startAccess(settled.state, spec);
  if (!access.ok) return { ok: false, reason: access.reason, tick: settled };
  const activity = { ...spec, lastProcessedAt: startTime(settled.state, now) } as Activity;
  return { ok: true, tick: { ...settled, state: { ...settled.state, activity } } };
}

export const startScavenging = (s: GameState, locationId: LocationId, now: number): StartResult => startActivity(s, { kind: 'scavenge', locationId }, now);
export const startCrafting = (s: GameState, recipeId: RecipeId, now: number): StartResult => startActivity(s, { kind: 'craft', recipeId }, now);
export const startSalvaging = (s: GameState, targetId: SalvageId, now: number): StartResult => startActivity(s, { kind: 'salvage', targetId }, now);
export const startResearch = (s: GameState, projectId: ProjectId, now: number): StartResult => startActivity(s, { kind: 'research', projectId }, now);

/** Credits finished actions and stops. Partial progress is discarded. */
export function stopActivity(state: GameState, now: number): TickResult {
  const settled = tick(state, now);
  return { ...settled, state: { ...settled.state, activity: null } };
}

// Note on speed changes: repairs, tools and feats change action length.
// Progress is always settled first, so at most the partial action in flight
// is timed at the new speed — never time that was already credited.

export type RepairResult =
  | { ok: true; state: GameState; progression: Progression; settled: TickResult }
  | { ok: false; state: GameState; blockers: RepairBlocker[]; settled: TickResult };

export function performRepair(state: GameState, id: TrainPartId, now: number): RepairResult {
  const settled = tick(state, now);
  const s = settled.state;
  const blockers = repairBlockers(s, id);
  if (blockers.length > 0) return { ok: false, state: s, blockers, settled };
  const inventory = removeItems(s.inventory, REPAIRS[id].cost);
  if (!inventory) return { ok: false, state: s, blockers: ['missingResources'], settled };
  const repaired: GameState = { ...s, inventory, repairs: { ...s.repairs, [id]: true } };
  const evaluated = evaluate(repaired, now);
  return { ok: true, state: evaluated.state, progression: { achievements: evaluated.achievements, dialogues: evaluated.dialogues }, settled };
}

export type EquipResult = { ok: true; state: GameState; settled: TickResult } | { ok: false; reason: string; state: GameState; settled: TickResult };

/** Moves a tool from the satchel into its skill's slot (returning any previous tool). */
export function equipTool(state: GameState, id: ToolId, now: number): EquipResult {
  const settled = tick(state, now);
  const s = settled.state;
  const skill = TOOLS[id].skill;
  if (s.equipment[skill] === id) return { ok: true, state: s, settled };
  if (s.inventory[id] < 1) return { ok: false, reason: 'You don’t have that tool.', state: s, settled };
  const access = toolAccess(s, id);
  if (!access.ok) return { ok: false, reason: access.reason, state: s, settled };
  let inventory = removeItems(s.inventory, { [id]: 1 });
  if (!inventory) return { ok: false, reason: 'You don’t have that tool.', state: s, settled };
  const previous = s.equipment[skill];
  if (previous) inventory = addItems(inventory, { [previous]: 1 });
  const next: GameState = { ...s, inventory, equipment: { ...s.equipment, [skill]: id } };
  return { ok: true, state: evaluate(next, now).state, settled };
}

export function unequipTool(state: GameState, skill: keyof GameState['equipment'], now: number): EquipResult {
  const settled = tick(state, now);
  const s = settled.state;
  const current = s.equipment[skill];
  if (!current) return { ok: true, state: s, settled };
  const next: GameState = { ...s, inventory: addItems(s.inventory, { [current]: 1 }), equipment: { ...s.equipment, [skill]: null } };
  return { ok: true, state: next, settled };
}

/** After crafting, put a new tool to use if its slot is empty or it's a higher tier. */
export function autoEquip(state: GameState, crafted: ToolId[], now: number): { state: GameState; equipped: ToolId[] } {
  let s = state;
  const equipped: ToolId[] = [];
  for (const id of crafted) {
    const def = TOOLS[id];
    const current = s.equipment[def.skill];
    if (current && TOOLS[current].tier >= def.tier) continue;
    if (!toolAccess(s, id).ok) continue;
    const r = equipTool(s, id, now);
    if (r.ok) {
      s = r.state;
      equipped.push(id);
    }
  }
  return { state: s, equipped };
}

export function markDialogueRead(state: GameState, id: string): GameState {
  if (state.dialogues.read.includes(id)) return state;
  return { ...state, dialogues: { ...state.dialogues, read: [...state.dialogues.read, id] } };
}

export function completeOnboarding(state: GameState): GameState {
  return state.onboarded ? state : { ...state, onboarded: true };
}

export function unreadDialogues(state: GameState): string[] {
  return state.dialogues.unlocked.filter((id) => !state.dialogues.read.includes(id));
}
