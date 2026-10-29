// The single source of truth for timed progress. Live ticks, a sleeping
// tab and a cold start after days away all go through advance().

import { ITEMS, type ItemId } from './content/items';
import { DISCOVERIES } from './content/story';
import { LOCATIONS, OFFLINE_CAP_MS, RECIPES, type LocationId, type RecipeId, type SkillId } from './content/world';
import { addItems, hasItems, removeItems } from './inventory';
import { nextInt, nextRandom } from './rng';
import { activitySkill, dropChance, durationOf, xpPerAction } from './rules';
import { emptyInventory, type Activity, type GameState, type Inventory } from './state';
import { levelForXp } from './xp';

export interface LevelUp {
  skill: SkillId;
  from: number;
  to: number;
}

export interface AdvanceResult {
  state: GameState;
  actions: number;
  skill: SkillId | null;
  xpGained: number;
  itemsGained: Inventory;
  itemsSpent: Inventory;
  rareFinds: ItemId[];
  discoveries: string[];
  levelUp: LevelUp | null;
  /** Set when an activity ended on its own (e.g. crafting ran out of materials). */
  stopped: 'outOfMaterials' | null;
  /** Real time since the last credited moment (0 if the clock went backwards). */
  elapsedMs: number;
  /** Time discarded because it exceeded the offline cap. */
  discardedMs: number;
  /** True if `now` was earlier than a time already seen; nothing was credited. */
  clockRewound: boolean;
}

function emptyResult(state: GameState): AdvanceResult {
  return {
    state,
    actions: 0,
    skill: state.activity ? activitySkill(state.activity) : null,
    xpGained: 0,
    itemsGained: emptyInventory(),
    itemsSpent: emptyInventory(),
    rareFinds: [],
    discoveries: [],
    levelUp: null,
    stopped: null,
    elapsedMs: 0,
    discardedMs: 0,
    clockRewound: false,
  };
}

/**
 * Credits completed actions up to `now`.
 *
 * - Time is measured from timestamps, never counted from timers.
 * - At most OFFLINE_CAP_MS is credited; anything older is discarded for good.
 * - lastProcessedAt moves forward in whole actions; the remainder carries.
 * - `now` earlier than the clock high-water mark credits nothing and changes
 *   nothing, so the same span of time can never be paid twice.
 */
export function advance(state: GameState, now: number): AdvanceResult {
  if (!Number.isFinite(now)) return emptyResult(state);
  if (now < state.clockHighWater) return { ...emptyResult(state), clockRewound: true };

  const base = { ...state, clockHighWater: now };
  const activity = base.activity;
  if (!activity) return emptyResult(base);

  const rawElapsed = now - activity.lastProcessedAt;
  if (rawElapsed <= 0) return emptyResult(base);

  const discardedMs = Math.max(0, rawElapsed - OFFLINE_CAP_MS);
  const creditFrom = activity.lastProcessedAt + discardedMs;
  const duration = durationOf(base, activity);
  const possible = Math.floor((now - creditFrom) / duration);

  const result =
    activity.kind === 'scavenge'
      ? runScavenge(base, activity.locationId, possible, creditFrom, duration)
      : runCraft(base, activity.recipeId, possible);

  const skill = activitySkill(activity);
  const xpGained = result.actions * xpPerAction(base, activity);
  const xpBefore = base.skills[skill].xp;
  const from = levelForXp(xpBefore);
  const to = levelForXp(xpBefore + xpGained);

  let nextActivity: Activity | null = { ...activity, lastProcessedAt: creditFrom + result.actions * duration };
  if (result.stopped) nextActivity = null;

  const nextState: GameState = {
    ...result.state,
    skills: { ...result.state.skills, [skill]: { xp: xpBefore + xpGained } },
    activity: nextActivity,
  };

  return {
    state: nextState,
    actions: result.actions,
    skill,
    xpGained,
    itemsGained: result.gained,
    itemsSpent: result.spent,
    rareFinds: result.rareFinds,
    discoveries: result.discoveries,
    levelUp: to > from ? { skill, from, to } : null,
    stopped: result.stopped,
    elapsedMs: rawElapsed,
    discardedMs,
    clockRewound: false,
  };
}

interface RunResult {
  state: GameState;
  actions: number;
  gained: Inventory;
  spent: Inventory;
  rareFinds: ItemId[];
  discoveries: string[];
  stopped: 'outOfMaterials' | null;
}

function runScavenge(
  state: GameState,
  locationId: LocationId,
  actions: number,
  startAt: number,
  duration: number,
): RunResult {
  const loc = LOCATIONS[locationId];
  const gained = emptyInventory();
  const rareFinds: ItemId[] = [];
  const discoveries: string[] = [];
  const found: Record<string, number> = { ...state.discoveries };
  const pending = DISCOVERIES.filter((d) => d.location === locationId && !(d.id in found));
  const chances = loc.drops.map((d) => dropChance(state, d.item, d.chance));
  let rng = state.rngState;
  let searches = state.stats.searches[locationId] ?? 0;

  for (let i = 0; i < actions; i++) {
    searches++;
    loc.drops.forEach((drop, k) => {
      const roll = nextRandom(rng);
      rng = roll.state;
      if (roll.value < (chances[k] ?? 0)) {
        const amount = nextInt(rng, drop.min, drop.max);
        rng = amount.state;
        gained[drop.item] += amount.value;
        if (ITEMS[drop.item].rarity === 'rare') rareFinds.push(drop.item);
      }
    });

    // At most one discovery per search; pity guarantees key finds.
    const roll = nextRandom(rng);
    rng = roll.state;
    const guaranteed = pending.find((d) => !(d.id in found) && d.guaranteeAt !== undefined && searches >= d.guaranteeAt);
    let pick = guaranteed;
    if (!pick) {
      let acc = 0;
      for (const d of pending) {
        if (d.id in found) continue;
        acc += d.chance;
        if (roll.value < acc) {
          pick = d;
          break;
        }
      }
    }
    if (pick) {
      found[pick.id] = startAt + (i + 1) * duration;
      discoveries.push(pick.id);
    }
  }

  const obtained = { ...state.stats.obtained };
  for (const id of Object.keys(gained) as ItemId[]) {
    if (gained[id] > 0) obtained[id] = (obtained[id] ?? 0) + gained[id];
  }

  return {
    state: {
      ...state,
      inventory: addItems(state.inventory, gained),
      discoveries: found,
      rngState: rng,
      stats: {
        ...state.stats,
        searches: { ...state.stats.searches, [locationId]: searches },
        rareFinds: state.stats.rareFinds + rareFinds.length,
        obtained,
      },
    },
    actions,
    gained,
    spent: emptyInventory(),
    rareFinds,
    discoveries,
    stopped: null,
  };
}

function runCraft(state: GameState, recipeId: RecipeId, possible: number): RunResult {
  const recipe = RECIPES[recipeId];
  let inventory = state.inventory;
  let actions = 0;
  let stopped: 'outOfMaterials' | null = null;

  for (let i = 0; i < possible; i++) {
    const after = removeItems(inventory, recipe.inputs);
    if (!after) {
      stopped = 'outOfMaterials';
      break;
    }
    inventory = addItems(after, { [recipe.output]: recipe.outputQty });
    actions++;
  }
  // Also stop if the next action could not start.
  if (!stopped && !hasItems(inventory, recipe.inputs)) stopped = 'outOfMaterials';

  const gained = emptyInventory();
  gained[recipe.output] = actions * recipe.outputQty;
  const spent = emptyInventory();
  for (const [id, qty] of Object.entries(recipe.inputs) as [ItemId, number][]) spent[id] = qty * actions;

  const obtained = { ...state.stats.obtained };
  if (actions > 0) obtained[recipe.output] = (obtained[recipe.output] ?? 0) + gained[recipe.output];

  return {
    state: { ...state, inventory, stats: { ...state.stats, crafts: state.stats.crafts + actions, obtained } },
    actions,
    gained,
    spent,
    rareFinds: [],
    discoveries: [],
    stopped,
  };
}

/** Fraction (0–1) of the current action that has elapsed. */
export function actionProgress(state: GameState, now: number): number {
  if (!state.activity) return 0;
  const into = now - state.activity.lastProcessedAt;
  if (into <= 0) return 0;
  return Math.min(1, into / durationOf(state, state.activity));
}
