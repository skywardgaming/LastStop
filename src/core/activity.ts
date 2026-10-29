// The single source of truth for timed progress. Live ticks, a sleeping tab
// and a cold start after days away all go through advance(), for every kind
// of activity.

import { ITEMS, type ItemId } from './content/items';
import { DISCOVERIES } from './content/story';
import {
  LOCATIONS,
  OFFLINE_CAP_MS,
  PROJECTS,
  RECIPES,
  SALVAGE,
  type DropDef,
  type LocationId,
  type ProjectId,
  type RecipeId,
  type SalvageId,
  type SkillId,
} from './content/world';
import { addItems, hasItems, removeItems } from './inventory';
import { nextInt, nextRandom } from './rng';
import { activitySkill, dropChance, durationOf, modifiers, xpPerAction } from './rules';
import { emptyInventory, type Activity, type GameState, type Inventory } from './state';
import { levelForXp } from './xp';

export interface LevelUp {
  skill: SkillId;
  from: number;
  to: number;
}

export type StopReason = 'outOfMaterials' | 'completed';

export interface AdvanceResult {
  state: GameState;
  actions: number;
  skill: SkillId | null;
  xpGained: number;
  itemsGained: Inventory;
  itemsSpent: Inventory;
  rareFinds: ItemId[];
  discoveries: string[];
  /** Salvage actions that yielded double. */
  doubles: number;
  /** Craft/research actions that kept their inputs. */
  saves: number;
  /** Research project finished during this span. */
  completedProject: ProjectId | null;
  levelUp: LevelUp | null;
  /** Set when an activity ended on its own. */
  stopped: StopReason | null;
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
    doubles: 0,
    saves: 0,
    completedProject: null,
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

  const base: GameState = { ...state, clockHighWater: now };
  const activity = base.activity;
  if (!activity) return emptyResult(base);

  const rawElapsed = now - activity.lastProcessedAt;
  if (rawElapsed <= 0) return emptyResult(base);

  const discardedMs = Math.max(0, rawElapsed - OFFLINE_CAP_MS);
  const creditFrom = activity.lastProcessedAt + discardedMs;
  const duration = durationOf(base, activity);
  const possible = Math.floor((now - creditFrom) / duration);

  let run: RunResult;
  switch (activity.kind) {
    case 'scavenge':
      run = runScavenge(base, activity.locationId, possible, creditFrom, duration);
      break;
    case 'craft':
      run = runCraft(base, activity.recipeId, possible);
      break;
    case 'salvage':
      run = runSalvage(base, activity.targetId, possible);
      break;
    case 'research':
      run = runResearch(base, activity.projectId, possible);
      break;
  }

  const skill = activitySkill(activity);
  const xpGained = run.actions * xpPerAction(base, activity);
  const xpBefore = base.skills[skill].xp;
  const from = levelForXp(xpBefore);
  const to = levelForXp(xpBefore + xpGained);

  // Track lifetime totals of everything obtained (for reveals and goals).
  const obtained = { ...run.state.stats.obtained };
  for (const id of Object.keys(run.gained) as ItemId[]) {
    if (run.gained[id] > 0) obtained[id] = (obtained[id] ?? 0) + run.gained[id];
  }

  const nextActivity: Activity | null = run.stopped ? null : { ...activity, lastProcessedAt: creditFrom + run.actions * duration };

  const nextState: GameState = {
    ...run.state,
    skills: { ...run.state.skills, [skill]: { xp: xpBefore + xpGained } },
    activity: nextActivity,
    stats: { ...run.state.stats, obtained, rareFinds: run.state.stats.rareFinds + run.rareFinds.length },
  };

  return {
    state: nextState,
    actions: run.actions,
    skill,
    xpGained,
    itemsGained: run.gained,
    itemsSpent: run.spent,
    rareFinds: run.rareFinds,
    discoveries: run.discoveries,
    doubles: run.doubles,
    saves: run.saves,
    completedProject: run.completed,
    levelUp: to > from ? { skill, from, to } : null,
    stopped: run.stopped,
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
  doubles: number;
  saves: number;
  completed: ProjectId | null;
  stopped: StopReason | null;
}

function blankRun(state: GameState): RunResult {
  return {
    state,
    actions: 0,
    gained: emptyInventory(),
    spent: emptyInventory(),
    rareFinds: [],
    discoveries: [],
    doubles: 0,
    saves: 0,
    completed: null,
    stopped: null,
  };
}

/** Rolls a drop table once, adding to `gained`. Returns the new RNG state. */
function rollDrops(state: GameState, drops: DropDef[], rng: number, gained: Inventory, rare: ItemId[], times = 1): number {
  let r = rng;
  for (const drop of drops) {
    const roll = nextRandom(r);
    r = roll.state;
    if (roll.value < dropChance(state, drop.item, drop.chance)) {
      const amount = nextInt(r, drop.min, drop.max);
      r = amount.state;
      gained[drop.item] += amount.value * times;
      if (ITEMS[drop.item].rarity === 'rare') rare.push(drop.item);
    }
  }
  return r;
}

function runScavenge(state: GameState, locationId: LocationId, actions: number, startAt: number, duration: number): RunResult {
  const out = blankRun(state);
  const loc = LOCATIONS[locationId];
  const found: Record<string, number> = { ...state.discoveries };
  const pending = DISCOVERIES.filter((d) => d.location === locationId && !(d.id in found));
  let rng = state.rngState;
  let searches = state.stats.searches[locationId] ?? 0;

  for (let i = 0; i < actions; i++) {
    searches++;
    rng = rollDrops(state, loc.drops, rng, out.gained, out.rareFinds);

    // At most one discovery per search; pity guarantees key finds.
    const roll = nextRandom(rng);
    rng = roll.state;
    let pick = pending.find((d) => !(d.id in found) && d.guaranteeAt !== undefined && searches >= d.guaranteeAt);
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
      out.discoveries.push(pick.id);
    }
  }

  out.actions = actions;
  out.state = {
    ...state,
    inventory: addItems(state.inventory, out.gained),
    discoveries: found,
    rngState: rng,
    stats: { ...state.stats, searches: { ...state.stats.searches, [locationId]: searches } },
  };
  return out;
}

function runCraft(state: GameState, recipeId: RecipeId, possible: number): RunResult {
  const out = blankRun(state);
  const recipe = RECIPES[recipeId];
  const m = modifiers(state);
  const yieldPer = recipe.outputQty + (m.recipeYield[recipeId] ?? 0);
  let inventory = state.inventory;
  let rng = state.rngState;

  for (let i = 0; i < possible; i++) {
    if (!hasItems(inventory, recipe.inputs)) {
      out.stopped = 'outOfMaterials';
      break;
    }
    let keep = false;
    if (m.saveChance.engineering > 0) {
      const roll = nextRandom(rng);
      rng = roll.state;
      keep = roll.value < m.saveChance.engineering;
    }
    if (keep) out.saves++;
    else {
      inventory = removeItems(inventory, recipe.inputs) as Inventory;
      for (const [id, qty] of Object.entries(recipe.inputs) as [ItemId, number][]) out.spent[id] += qty;
    }
    inventory = addItems(inventory, { [recipe.output]: yieldPer });
    out.gained[recipe.output] += yieldPer;
    out.actions++;
  }
  // Stop when the next action can't start, so the bar doesn't fill for nothing.
  if (!out.stopped && !hasItems(inventory, recipe.inputs)) out.stopped = 'outOfMaterials';

  out.state = { ...state, inventory, rngState: rng, stats: { ...state.stats, crafts: state.stats.crafts + out.actions } };
  return out;
}

function runSalvage(state: GameState, targetId: SalvageId, possible: number): RunResult {
  const out = blankRun(state);
  const target = SALVAGE[targetId];
  const m = modifiers(state);
  let inventory = state.inventory;
  let rng = state.rngState;

  for (let i = 0; i < possible; i++) {
    if (target.input) {
      const after = removeItems(inventory, target.input);
      if (!after) {
        out.stopped = 'outOfMaterials';
        break;
      }
      inventory = after;
      for (const [id, qty] of Object.entries(target.input) as [ItemId, number][]) out.spent[id] += qty;
    }
    let times = 1;
    if (m.doubleChance > 0) {
      const roll = nextRandom(rng);
      rng = roll.state;
      if (roll.value < m.doubleChance) {
        times = 2;
        out.doubles++;
      }
    }
    const before = { ...out.gained };
    rng = rollDrops(state, target.drops, rng, out.gained, out.rareFinds, times);
    const delta: Partial<Inventory> = {};
    for (const id of Object.keys(out.gained) as ItemId[]) if (out.gained[id] !== before[id]) delta[id] = out.gained[id] - before[id];
    inventory = addItems(inventory, delta);
    out.actions++;
  }
  if (!out.stopped && target.input && !hasItems(inventory, target.input)) out.stopped = 'outOfMaterials';

  out.state = { ...state, inventory, rngState: rng, stats: { ...state.stats, salvages: state.stats.salvages + out.actions } };
  return out;
}

function runResearch(state: GameState, projectId: ProjectId, possible: number): RunResult {
  const out = blankRun(state);
  const project = PROJECTS[projectId];
  const m = modifiers(state);
  let inventory = state.inventory;
  let rng = state.rngState;
  let progress = state.research.progress[projectId] ?? 0;
  const total = project.actions;
  let done = state.research.done;

  for (let i = 0; i < possible; i++) {
    if (!hasItems(inventory, project.input)) {
      out.stopped = 'outOfMaterials';
      break;
    }
    let keep = false;
    if (m.saveChance.research > 0) {
      const roll = nextRandom(rng);
      rng = roll.state;
      keep = roll.value < m.saveChance.research;
    }
    if (keep) out.saves++;
    else {
      inventory = removeItems(inventory, project.input) as Inventory;
      for (const [id, qty] of Object.entries(project.input) as [ItemId, number][]) out.spent[id] += qty;
    }
    out.actions++;
    progress++;
    if (total !== undefined && progress >= total) {
      done = [...done, projectId];
      out.completed = projectId;
      out.stopped = 'completed';
      break;
    }
  }
  if (!out.stopped && !hasItems(inventory, project.input)) out.stopped = 'outOfMaterials';

  const nextProgress = { ...state.research.progress };
  if (total !== undefined) {
    if (out.completed) delete nextProgress[projectId];
    else if (progress > 0) nextProgress[projectId] = progress;
  }

  out.state = {
    ...state,
    inventory,
    rngState: rng,
    research: { progress: nextProgress, done },
    stats: { ...state.stats, studies: state.stats.studies + out.actions },
  };
  return out;
}

/** Fraction (0–1) of the current action that has elapsed. */
export function actionProgress(state: GameState, now: number): number {
  if (!state.activity) return 0;
  const into = now - state.activity.lastProcessedAt;
  if (into <= 0) return 0;
  return Math.min(1, into / durationOf(state, state.activity));
}
