// Player-facing operations. Every operation settles timed progress first,
// so bonuses and spending never apply retroactively, then evaluates
// achievements and story beats. The UI only calls these functions.

import { ACHIEVEMENTS, DIALOGUES } from './content/story';
import { REPAIRS, type LocationId, type RecipeId, type RepairId } from './content/world';
import { advance, type AdvanceResult } from './activity';
import { removeItems } from './inventory';
import { locationAccess, recipeAccess, repairBlockers, type RepairBlocker } from './rules';
import type { Activity, GameState } from './state';

export interface Progression {
  achievements: string[];
  dialogues: string[];
}

export interface TickResult extends AdvanceResult, Progression {}

/** Unlocks any achievements and dialogues whose conditions now hold. */
export function evaluate(state: GameState, now: number): { state: GameState } & Progression {
  const newAchievements = ACHIEVEMENTS.filter((a) => !(a.id in state.achievements) && a.when(state)).map((a) => a.id);
  const unlocked = new Set(state.dialogues.unlocked);
  const newDialogues = DIALOGUES.filter((d) => !unlocked.has(d.id) && d.when(state)).map((d) => d.id);
  if (newAchievements.length === 0 && newDialogues.length === 0) {
    return { state, achievements: [], dialogues: [] };
  }
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

/** The moment a new activity may start: never earlier than time already credited. */
function startTime(state: GameState, now: number): number {
  return Math.max(now, state.clockHighWater);
}

export type StartResult = { ok: true; tick: TickResult } | { ok: false; reason: string; tick: TickResult };

function begin(state: GameState, now: number, activity: (at: number) => Activity, check: (s: GameState) => { ok: true } | { ok: false; reason: string }): StartResult {
  const settled = tick(state, now);
  const access = check(settled.state);
  if (!access.ok) return { ok: false, reason: access.reason, tick: settled };
  const next: GameState = { ...settled.state, activity: activity(startTime(settled.state, now)) };
  return { ok: true, tick: { ...settled, state: next } };
}

export function startScavenging(state: GameState, locationId: LocationId, now: number): StartResult {
  return begin(state, now, (at) => ({ kind: 'scavenge', locationId, lastProcessedAt: at }), (s) => locationAccess(s, locationId));
}

export function startCrafting(state: GameState, recipeId: RecipeId, now: number): StartResult {
  return begin(state, now, (at) => ({ kind: 'craft', recipeId, lastProcessedAt: at }), (s) => recipeAccess(s, recipeId));
}

/** Credits finished actions and stops. Partial progress is discarded. */
export function stopActivity(state: GameState, now: number): TickResult {
  const settled = tick(state, now);
  return { ...settled, state: { ...settled.state, activity: null } };
}

export type RepairResult =
  | { ok: true; state: GameState; progression: Progression; settled: TickResult }
  | { ok: false; state: GameState; blockers: RepairBlocker[]; settled: TickResult };

export function performRepair(state: GameState, id: RepairId, now: number): RepairResult {
  const settled = tick(state, now);
  const s = settled.state;
  const blockers = repairBlockers(s, id);
  if (blockers.length > 0) return { ok: false, state: s, blockers, settled };
  const inventory = removeItems(s.inventory, REPAIRS[id].cost);
  if (!inventory) return { ok: false, state: s, blockers: ['missingResources'], settled };

  const repaired: GameState = { ...s, inventory, repairs: { ...s.repairs, [id]: true } };
  const evaluated = evaluate(repaired, now);
  return {
    ok: true,
    state: evaluated.state,
    progression: { achievements: evaluated.achievements, dialogues: evaluated.dialogues },
    settled,
  };
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
