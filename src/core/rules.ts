// Derived rules: bonuses from repairs, what is unlocked, and action timing.

import { ITEMS } from './content/items';
import {
  LOCATIONS,
  RECIPES,
  REPAIR_IDS,
  REPAIRS,
  type LocationId,
  type Modifiers,
  type RecipeId,
  type RepairId,
  type SkillId,
} from './content/world';
import { hasItems, timesAffordable } from './inventory';
import type { Activity, GameState } from './state';
import { levelForXp } from './xp';

export function modifiers(state: GameState): Modifiers {
  const m: Modifiers = { speed: { scavenging: 0, engineering: 0 }, rareChance: 1, xp: 1 };
  for (const id of REPAIR_IDS) if (state.repairs[id]) REPAIRS[id].apply(m);
  return m;
}

export function skillLevel(state: GameState, skill: SkillId): number {
  return levelForXp(state.skills[skill].xp);
}

export function activitySkill(activity: Activity): SkillId {
  return activity.kind === 'scavenge' ? 'scavenging' : 'engineering';
}

export function actionDuration(state: GameState, activity: Pick<Activity, 'kind'> & { locationId?: LocationId; recipeId?: RecipeId }): number {
  const m = modifiers(state);
  if (activity.kind === 'scavenge' && activity.locationId) {
    return Math.round(LOCATIONS[activity.locationId].actionMs / (1 + m.speed.scavenging));
  }
  if (activity.kind === 'craft' && activity.recipeId) {
    return Math.round(RECIPES[activity.recipeId].actionMs / (1 + m.speed.engineering));
  }
  return Infinity;
}

export function durationOf(state: GameState, activity: Activity): number {
  return activity.kind === 'scavenge'
    ? actionDuration(state, { kind: 'scavenge', locationId: activity.locationId })
    : actionDuration(state, { kind: 'craft', recipeId: activity.recipeId });
}

export function xpPerAction(state: GameState, activity: Activity): number {
  const base = activity.kind === 'scavenge' ? LOCATIONS[activity.locationId].xp : RECIPES[activity.recipeId].xp;
  return Math.round(base * modifiers(state).xp);
}

export type LocationLock = { ok: true } | { ok: false; reason: string };

export function locationAccess(state: GameState, id: LocationId): LocationLock {
  const loc = LOCATIONS[id];
  if (loc.repairRequired && !state.repairs[loc.repairRequired]) return { ok: false, reason: loc.lockedHint };
  if (loc.discoveryRequired && !(loc.discoveryRequired in state.discoveries)) return { ok: false, reason: loc.lockedHint };
  if (skillLevel(state, 'scavenging') < loc.levelRequired) {
    return { ok: false, reason: `Requires Scavenging level ${loc.levelRequired}.` };
  }
  return { ok: true };
}

export function recipeAccess(state: GameState, id: RecipeId): LocationLock {
  const r = RECIPES[id];
  if (skillLevel(state, 'engineering') < r.levelRequired) {
    return { ok: false, reason: `Requires Engineering level ${r.levelRequired}.` };
  }
  if (!hasItems(state.inventory, r.inputs)) return { ok: false, reason: 'Not enough materials.' };
  return { ok: true };
}

export function craftableCount(state: GameState, id: RecipeId): number {
  return timesAffordable(state.inventory, RECIPES[id].inputs);
}

export type RepairBlocker = 'alreadyRepaired' | 'levelTooLow' | 'missingResources';

export function repairBlockers(state: GameState, id: RepairId): RepairBlocker[] {
  const def = REPAIRS[id];
  const out: RepairBlocker[] = [];
  if (state.repairs[id]) out.push('alreadyRepaired');
  if (skillLevel(state, 'engineering') < def.levelRequired) out.push('levelTooLow');
  if (!hasItems(state.inventory, def.cost)) out.push('missingResources');
  return out;
}

/** Effective chance of a drop after the rare-find bonus. */
export function dropChance(state: GameState, item: keyof typeof ITEMS, base: number): number {
  if (ITEMS[item].rarity !== 'rare') return base;
  return Math.min(1, base * modifiers(state).rareChance);
}
