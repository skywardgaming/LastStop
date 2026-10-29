import { REPAIRS, type RepairId } from './data';
import { hasItems, removeItems } from './inventory';
import { advance } from './scavenging';
import type { GameState } from './state';
import { levelForXp } from './xp';

export type RepairBlocker = 'alreadyRepaired' | 'levelTooLow' | 'missingResources';

export function repairBlockers(state: GameState, id: RepairId): RepairBlocker[] {
  const def = REPAIRS[id];
  const blockers: RepairBlocker[] = [];
  if (state.repairs[id]) blockers.push('alreadyRepaired');
  if (levelForXp(state.skills.scavenging.xp) < def.levelRequired) blockers.push('levelTooLow');
  if (!hasItems(state.inventory, def.cost)) blockers.push('missingResources');
  return blockers;
}

export function canRepair(state: GameState, id: RepairId): boolean {
  return repairBlockers(state, id).length === 0;
}

export type RepairResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; blockers: RepairBlocker[] };

/**
 * Settles progress up to `now` (so a speed bonus never applies retroactively),
 * then spends the cost and marks the repair complete. Atomic: on failure the
 * returned state is the settled state with inventory untouched.
 */
export function performRepair(state: GameState, id: RepairId, now: number): RepairResult {
  const settled = advance(state, now).state;
  const blockers = repairBlockers(settled, id);
  if (blockers.length > 0) return { ok: false, state: settled, blockers };

  const inventory = removeItems(settled.inventory, REPAIRS[id].cost);
  if (!inventory) return { ok: false, state: settled, blockers: ['missingResources'] };

  return {
    ok: true,
    state: { ...settled, inventory, repairs: { ...settled.repairs, [id]: true } },
  };
}
