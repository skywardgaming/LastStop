import { describe, expect, it } from 'vitest';
import { ITEMS, type ItemId } from '../src/core/content/items';
import { LOCATION_IDS, LOCATIONS, RECIPE_IDS, RECIPES, REPAIR_IDS, REPAIRS, type ItemBundle } from '../src/core/content/world';
import { evaluate, performRepair, startCrafting, startScavenging, tick } from '../src/core/game';
import { craftableCount, dropChance, locationAccess, recipeAccess, repairBlockers, skillLevel } from '../src/core/rules';
import { createInitialState, type GameState } from '../src/core/state';
import { HOUR, T0 } from './helpers';

/**
 * A simple greedy player: work towards the next repair, crafting what's
 * craftable and scavenging the best reachable place for what's missing.
 * Proves Chapter One has no dead ends and checks its overall length.
 */
function shortfall(s: GameState, bundle: ItemBundle, times = 1): ItemBundle {
  const out: ItemBundle = {};
  for (const [id, n] of Object.entries(bundle) as [ItemId, number][]) {
    const need = n * times - s.inventory[id];
    if (need > 0) out[id] = need;
  }
  return out;
}

function decide(s: GameState, now: number): GameState {
  const target = REPAIR_IDS.find((id) => !s.repairs[id]);
  if (!target) return s;
  if (repairBlockers(s, target).length === 0) {
    const r = performRepair(s, target, now);
    return r.state;
  }
  // Expand the missing parts into raw needs, crafting where possible.
  const missing = shortfall(s, REPAIRS[target].cost);
  for (const id of Object.keys(missing) as ItemId[]) {
    const recipe = RECIPE_IDS.find((r) => RECIPES[r].output === id);
    if (recipe && recipeAccess(s, recipe).ok) return startCrafting(s, recipe, now).tick.state;
    if (recipe) {
      const raw = shortfall(s, RECIPES[recipe].inputs, missing[id] ?? 1);
      for (const rid of Object.keys(raw) as ItemId[]) {
        const sub = RECIPE_IDS.find((r) => RECIPES[r].output === rid);
        if (sub && recipeAccess(s, sub).ok) return startCrafting(s, sub, now).tick.state;
        const where = bestPlace(s, rid);
        if (where) return startScavenging(s, where, now).tick.state;
      }
    } else {
      const where = bestPlace(s, id);
      if (where) return startScavenging(s, where, now).tick.state;
    }
  }
  // Level-gated: train Engineering on anything craftable, else scavenge for XP.
  const anyCraft = RECIPE_IDS.filter((r) => recipeAccess(s, r).ok && craftableCount(s, r) > 0).pop();
  if (skillLevel(s, 'engineering') < REPAIRS[target].levelRequired && anyCraft) return startCrafting(s, anyCraft, now).tick.state;
  const open = LOCATION_IDS.filter((l) => locationAccess(s, l).ok);
  const shed = open.includes('maintenanceShed') ? 'maintenanceShed' : null;
  const cab = open.includes('signalCabinet') ? 'signalCabinet' : null;
  return startScavenging(s, shed ?? cab ?? 'derelictPlatform', now).tick.state;
}

function bestPlace(s: GameState, id: ItemId): (typeof LOCATION_IDS)[number] | null {
  let best: (typeof LOCATION_IDS)[number] | null = null;
  let rate = 0;
  for (const l of LOCATION_IDS) {
    if (!locationAccess(s, l).ok) continue;
    const d = LOCATIONS[l].drops.find((x) => x.item === id);
    if (!d) continue;
    const r = (dropChance(s, id, d.chance) * (d.min + d.max)) / 2 / LOCATIONS[l].actionMs;
    if (r > rate) {
      rate = r;
      best = l;
    }
  }
  // Locked sources: the shed key lives in the cabinet; levels come from searching.
  if (!best && ITEMS[id]) {
    if (locationAccess(s, 'signalCabinet').ok) return 'signalCabinet';
    return 'derelictPlatform';
  }
  return best;
}

describe('Chapter One playthrough', () => {
  it('a greedy player restores No. 9 with no dead ends, in a few hours of play', () => {
    let s = evaluate(createInitialState(T0, 2024), T0).state;
    let now = T0;
    const step = 30_000;
    const firstRepairAt: Record<string, number> = {};
    while (!s.repairs.boiler && now < T0 + 24 * HOUR) {
      s = decide(s, now);
      now += step;
      s = tick(s, now).state;
      for (const id of REPAIR_IDS) if (s.repairs[id] && !(id in firstRepairAt)) firstRepairAt[id] = (now - T0) / 60_000;
    }
    const hours = (now - T0) / HOUR;
    // eslint-disable-next-line no-console
    console.log('Chapter One minutes per repair:', firstRepairAt, `total ${hours.toFixed(1)}h`);
    expect(s.repairs.boiler).toBe(true);
    expect(firstRepairAt.fireboxDoor).toBeLessThan(12);
    expect(hours).toBeLessThan(8);
    expect(hours).toBeGreaterThan(2);
  });
});
