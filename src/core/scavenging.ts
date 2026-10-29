import { LOCATIONS, OFFLINE_CAP_MS, REPAIR_IDS, REPAIRS, RESOURCE_IDS, type LocationId } from './data';
import { addItems, emptyInventory, type Inventory } from './inventory';
import { nextInt, nextRandom } from './rng';
import type { GameState } from './state';
import { levelForXp } from './xp';

export interface AdvanceResult {
  state: GameState;
  actions: number;
  xpGained: number;
  itemsGained: Inventory;
  levelBefore: number;
  levelAfter: number;
  /** Real time that passed since the last credited moment. */
  elapsedMs: number;
  /** Time that was discarded because it exceeded the offline cap. */
  discardedMs: number;
}

/** Duration of one search, after repair bonuses. */
export function actionDurationMs(state: GameState, locationId: LocationId): number {
  let bonus = 0;
  for (const id of REPAIR_IDS) {
    if (state.repairs[id]) bonus += REPAIRS[id].scavengeSpeedBonus;
  }
  return Math.round(LOCATIONS[locationId].actionMs / (1 + bonus));
}

export function canScavenge(state: GameState, locationId: LocationId): boolean {
  return levelForXp(state.skills.scavenging.xp) >= LOCATIONS[locationId].levelRequired;
}

export function startScavenging(state: GameState, locationId: LocationId, now: number): GameState {
  if (!canScavenge(state, locationId)) return state;
  // Settle any running activity first so nothing earned is lost.
  const settled = advance(state, now).state;
  return { ...settled, activity: { skill: 'scavenging', locationId, lastProcessedAt: now } };
}

/** Credits completed searches up to `now`, then stops. Partial progress is dropped. */
export function stopScavenging(state: GameState, now: number): AdvanceResult {
  const result = advance(state, now);
  return { ...result, state: { ...result.state, activity: null } };
}

/** Fraction (0–1) of the current search that has elapsed, for progress bars. */
export function actionProgress(state: GameState, now: number): number {
  if (!state.activity) return 0;
  const duration = actionDurationMs(state, state.activity.locationId);
  const into = now - state.activity.lastProcessedAt;
  if (into <= 0) return 0;
  return Math.min(1, into / duration);
}

/**
 * The single source of truth for progression. Live ticks, a sleeping tab and
 * a cold start after days away all go through here.
 *
 * - Elapsed time is measured from timestamps, never from timer counts.
 * - At most OFFLINE_CAP_MS is ever credited; older time is discarded.
 * - lastProcessedAt advances by whole actions, keeping the remainder.
 * - If the clock moved backwards, nothing is credited and the timestamp is
 *   left alone, so moving the clock back and forth can't re-claim rewards.
 */
export function advance(state: GameState, now: number): AdvanceResult {
  const levelBefore = levelForXp(state.skills.scavenging.xp);
  const empty: AdvanceResult = {
    state,
    actions: 0,
    xpGained: 0,
    itemsGained: emptyInventory(),
    levelBefore,
    levelAfter: levelBefore,
    elapsedMs: 0,
    discardedMs: 0,
  };

  const activity = state.activity;
  if (!activity || !Number.isFinite(now)) return empty;

  const rawElapsed = now - activity.lastProcessedAt;
  if (rawElapsed <= 0) return { ...empty, elapsedMs: Math.max(0, rawElapsed) };

  const discardedMs = Math.max(0, rawElapsed - OFFLINE_CAP_MS);
  const creditFrom = activity.lastProcessedAt + discardedMs;
  const elapsed = now - creditFrom;

  const location = LOCATIONS[activity.locationId];
  const duration = actionDurationMs(state, activity.locationId);
  const actions = Math.floor(elapsed / duration);

  let rng = state.rngState;
  const gained: Inventory = emptyInventory();
  for (let i = 0; i < actions; i++) {
    for (const drop of location.drops) {
      const roll = nextRandom(rng);
      rng = roll.state;
      if (roll.value < drop.chance) {
        const amount = nextInt(rng, drop.min, drop.max);
        rng = amount.state;
        gained[drop.resource] += amount.value;
      }
    }
  }

  const xpGained = actions * location.xpPerAction;
  const xp = state.skills.scavenging.xp + xpGained;

  const nextState: GameState = {
    ...state,
    skills: { ...state.skills, scavenging: { xp } },
    inventory: addItems(state.inventory, gained),
    activity: { ...activity, lastProcessedAt: creditFrom + actions * duration },
    rngState: rng,
    stats: { ...state.stats, totalSearches: state.stats.totalSearches + actions },
  };

  return {
    state: nextState,
    actions,
    xpGained,
    itemsGained: gained,
    levelBefore,
    levelAfter: levelForXp(xp),
    elapsedMs: rawElapsed,
    discardedMs,
  };
}

export function hasGains(result: AdvanceResult): boolean {
  return result.actions > 0 || RESOURCE_IDS.some((id) => result.itemsGained[id] > 0);
}
