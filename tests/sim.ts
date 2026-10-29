// A goal-directed simulated player. It works backwards from the next train
// part through recipes, salvage targets, research gates and level gates,
// and always picks something it can actually start. If the content ever has
// a dead end, the bot stalls and the chapter tests fail.

import type { ItemId } from '../src/core/content/items';
import { DISCOVERY_BY_ID } from '../src/core/content/story';
import {
  LOCATION_IDS,
  LOCATIONS,
  PROJECT_IDS,
  PROJECTS,
  RECIPE_IDS,
  RECIPES,
  REPAIRS,
  SALVAGE_IDS,
  SALVAGE,
  TOOL_IDS,
  TOOLS,
  TRAIN_PART_IDS,
  type LocationId,
  type ProjectId,
  type SkillId,
  type TrainPartId,
} from '../src/core/content/world';
import { autoEquip, evaluate, performRepair, startActivity, tick } from '../src/core/game';
import {
  dropChance,
  locationAccess,
  ownedTools,
  projectUnlocked,
  recipeAccess,
  recipeUnlocked,
  repairBlockers,
  researchAccess,
  salvageAccess,
  salvageUnlocked,
  skillLevel,
  startAccess,
  type ActivitySpec,
} from '../src/core/rules';
import { createInitialState, type GameState } from '../src/core/state';

type Plan = ActivitySpec | null;

function bestLocationFor(s: GameState, item: ItemId): LocationId | null {
  let best: LocationId | null = null;
  let rate = 0;
  for (const l of LOCATION_IDS) {
    if (!locationAccess(s, l).ok) continue;
    const d = LOCATIONS[l].drops.find((x) => x.item === item);
    if (!d) continue;
    const r = (dropChance(s, item, d.chance) * (d.min + d.max)) / 2 / LOCATIONS[l].actionMs;
    if (r > rate) {
      rate = r;
      best = l;
    }
  }
  return best;
}

function bestXpLocation(s: GameState): LocationId {
  let best: LocationId = 'derelictPlatform';
  let rate = 0;
  for (const l of LOCATION_IDS) {
    if (!locationAccess(s, l).ok) continue;
    const r = LOCATIONS[l].xp / LOCATIONS[l].actionMs;
    if (r > rate) {
      rate = r;
      best = l;
    }
  }
  return best;
}

function train(s: GameState, skill: SkillId, depth: number): Plan {
  switch (skill) {
    case 'scavenging':
      return { kind: 'scavenge', locationId: bestXpLocation(s) };
    case 'salvaging': {
      // Highest-level target we can feed, else the wagon.
      const ok = [...SALVAGE_IDS].reverse().find((t) => salvageAccess(s, t).ok);
      return { kind: 'salvage', targetId: ok ?? 'scrapWagon' };
    }
    case 'engineering': {
      const ok = [...RECIPE_IDS].filter((r) => RECIPES[r].category === 'parts').reverse().find((r) => recipeAccess(s, r).ok);
      if (ok) return { kind: 'craft', recipeId: ok };
      return need(s, 'scrapIron', s.inventory.scrapIron + 3, depth + 1);
    }
    case 'research': {
      const open = PROJECT_IDS.find((p) => p !== 'catalogue' && researchAccess(s, p).ok);
      if (open) return { kind: 'research', projectId: open };
      if (researchAccess(s, 'catalogue').ok) return { kind: 'research', projectId: 'catalogue' };
      return need(s, 'waterloggedNotes', s.inventory.waterloggedNotes + 2, depth + 1);
    }
  }
}

function needDiscovery(s: GameState, id: string): Plan {
  const d = DISCOVERY_BY_ID[id];
  if (!d) return null;
  const access = locationAccess(s, d.location);
  if (access.ok) return { kind: 'scavenge', locationId: d.location };
  return unlockLocation(s, d.location);
}

function unlockLocation(s: GameState, l: LocationId): Plan {
  const loc = LOCATIONS[l];
  if (loc.repairRequired && !s.repairs[loc.repairRequired]) return null; // repair chain handles it
  if (loc.discoveryRequired && !(loc.discoveryRequired in s.discoveries)) return needDiscovery(s, loc.discoveryRequired);
  return train(s, 'scavenging', 0);
}

function needProject(s: GameState, p: ProjectId, depth: number): Plan {
  const def = PROJECTS[p];
  if (def.discoveryRequired && !(def.discoveryRequired in s.discoveries)) return needDiscovery(s, def.discoveryRequired);
  if (!projectUnlocked(s, p).ok) return train(s, 'research', depth);
  if (researchAccess(s, p).ok) return { kind: 'research', projectId: p };
  for (const [item, qty] of Object.entries(def.input) as [ItemId, number][]) {
    if (s.inventory[item] < qty) return need(s, item, qty * 4, depth + 1);
  }
  return null;
}

/** Returns an activity that makes progress toward having `qty` of `item`. */
export function need(s: GameState, item: ItemId, qty: number, depth = 0): Plan {
  if (s.inventory[item] >= qty || depth > 8) return null;

  const recipe = RECIPE_IDS.find((r) => RECIPES[r].output === item);
  if (recipe) {
    const r = RECIPES[recipe];
    const unlocked = recipeUnlocked(s, recipe);
    if (!unlocked.ok) {
      if (r.research && !s.research.done.includes(r.research)) return needProject(s, r.research, depth);
      return train(s, 'engineering', depth);
    }
    if (recipeAccess(s, recipe).ok) return { kind: 'craft', recipeId: recipe };
    const times = Math.max(1, Math.ceil((qty - s.inventory[item]) / r.outputQty));
    for (const [input, n] of Object.entries(r.inputs) as [ItemId, number][]) {
      const plan = need(s, input, n * times, depth + 1);
      if (plan) return plan;
    }
    return null;
  }

  // Salvage: a target we can feed now, else the best one we could feed.
  const salvages = SALVAGE_IDS.filter((t) => SALVAGE[t].drops.some((d) => d.item === item));
  const loc = bestLocationFor(s, item);
  for (const t of salvages) {
    if (salvageAccess(s, t).ok) {
      const chance = SALVAGE[t].drops.find((d) => d.item === item)?.chance ?? 0;
      // Prefer scavenging if the item is a common ground drop and the target is a weak source.
      if (loc && chance < 0.2 && LOCATIONS[loc].drops.some((d) => d.item === item && d.chance >= 0.2)) break;
      return { kind: 'salvage', targetId: t };
    }
  }
  if (loc) return { kind: 'scavenge', locationId: loc };
  for (const t of [...salvages].reverse()) {
    if (!salvageUnlocked(s, t).ok) continue;
    const input = SALVAGE[t].input;
    if (input) {
      const [machine] = Object.keys(input) as ItemId[];
      if (machine) {
        const plan = need(s, machine, 1, depth + 1);
        if (plan) return plan;
      }
    }
  }
  if (salvages.length > 0) {
    const lowest = Math.min(...salvages.map((t) => SALVAGE[t].levelRequired));
    if (skillLevel(s, 'salvaging') < lowest) return train(s, 'salvaging', depth);
  }
  // Ground drop at a locked location.
  const lockedLoc = LOCATION_IDS.find((l) => LOCATIONS[l].drops.some((d) => d.item === item));
  return lockedLoc ? unlockLocation(s, lockedLoc) : null;
}

function planPart(s: GameState, id: TrainPartId): Plan {
  const def = REPAIRS[id];
  if (def.research && !s.research.done.includes(def.research)) {
    const p = needProject(s, def.research, 0);
    if (p) return p;
  }
  if (skillLevel(s, 'engineering') < def.levelRequired) {
    // Gather the parts while levelling: crafting them is Engineering XP.
    for (const [item, qty] of Object.entries(def.cost) as [ItemId, number][]) {
      const p = need(s, item, qty);
      if (p && p.kind === 'craft') return p;
    }
    return train(s, 'engineering', 0);
  }
  for (const [item, qty] of Object.entries(def.cost) as [ItemId, number][]) {
    const p = need(s, item, qty);
    if (p) return p;
  }
  return null;
}

/** Tier-1 tools are cheap and pay for themselves; the bot makes them early. */
function planTools(s: GameState): Plan {
  for (const t of TOOL_IDS) {
    const def = TOOLS[t];
    if (def.tier !== 1 || ownedTools(s, def.skill).length > 0) continue;
    if (recipeAccess(s, t).ok) return { kind: 'craft', recipeId: t };
  }
  return null;
}

function planUpgradeTools(s: GameState): Plan {
  for (const t of TOOL_IDS) {
    const def = TOOLS[t];
    if (def.tier === 1 || ownedTools(s, def.skill).includes(t)) continue;
    const better = ownedTools(s, def.skill).some((o) => TOOLS[o].tier >= def.tier);
    if (better) continue;
    if (recipeAccess(s, t).ok) return { kind: 'craft', recipeId: t };
  }
  return null;
}

export interface SimLog {
  partAt: Partial<Record<TrainPartId, number>>;
  idleSteps: number;
  finalState: GameState;
  minutes: number;
}

export function simulate(goal: TrainPartId[], maxHours: number, seed = 2024, stepMs = 30_000): SimLog {
  const T0 = Date.UTC(2026, 9, 29, 12);
  let s = evaluate(createInitialState(T0, seed), T0).state;
  let now = T0;
  const partAt: SimLog['partAt'] = {};
  let idleSteps = 0;

  while (now < T0 + maxHours * 3_600_000 && !goal.every((g) => s.repairs[g])) {
    // Repair anything ready, in order.
    for (const id of TRAIN_PART_IDS) {
      if (!s.repairs[id] && repairBlockers(s, id).length === 0) {
        const r = performRepair(s, id, now);
        if (r.ok) {
          s = r.state;
          partAt[id] = (now - T0) / 60_000;
        }
      }
    }
    s = autoEquip(s, TOOL_IDS.filter((t) => s.inventory[t] > 0), now).state;

    const next = goal.find((g) => !s.repairs[g]);
    let plan: Plan = planTools(s);
    if (!plan && next) plan = planPart(s, next);
    if (!plan) plan = planUpgradeTools(s);
    if (plan && startAccess(s, plan).ok) {
      const a = s.activity;
      const same = a && JSON.stringify({ ...a, lastProcessedAt: 0 }) === JSON.stringify({ ...plan, lastProcessedAt: 0 });
      if (!same) s = startActivity(s, plan, now).tick.state;
    } else {
      idleSteps++;
      if (!s.activity) s = startActivity(s, { kind: 'scavenge', locationId: bestXpLocation(s) }, now).tick.state;
    }
    now += stepMs;
    s = tick(s, now).state;
  }
  return { partAt, idleSteps, finalState: s, minutes: (now - T0) / 60_000 };
}
