import { describe, expect, it } from 'vitest';
import { REPAIRS } from '../src/core/data';
import { addItems, emptyInventory } from '../src/core/inventory';
import { canRepair, performRepair, repairBlockers } from '../src/core/repair';
import { xpForLevel } from '../src/core/xp';
import { freshState, T0 } from './helpers';

const door = REPAIRS.fireboxDoor;
const enough = addItems(emptyInventory(), { scrapIron: 25, copperWire: 8, brassCog: 2 });
const levelFive = { scavenging: { xp: xpForLevel(door.levelRequired) } };

describe('Firebox Door repair', () => {
  it('succeeds with the level and resources, spending exactly the cost', () => {
    const r = performRepair(freshState({ inventory: enough, skills: levelFive }), 'fireboxDoor', T0);
    expect(r.ok).toBe(true);
    expect(r.state.repairs.fireboxDoor).toBe(true);
    expect(r.state.inventory).toEqual({ scrapIron: 5, copperWire: 0, brassCog: 1 });
  });

  it('is blocked below the required level and spends nothing', () => {
    const low = { scavenging: { xp: xpForLevel(door.levelRequired) - 1 } };
    const r = performRepair(freshState({ inventory: enough, skills: low }), 'fireboxDoor', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.blockers).toContain('levelTooLow');
    expect(r.state.inventory).toEqual(enough);
  });

  it('is blocked when short on any resource, and inventory never goes negative', () => {
    const short = addItems(emptyInventory(), { scrapIron: 20, copperWire: 7, brassCog: 1 });
    const r = performRepair(freshState({ inventory: short, skills: levelFive }), 'fireboxDoor', T0);
    expect(r.ok).toBe(false);
    expect(r.state.inventory).toEqual(short);
  });

  it('cannot be repaired twice', () => {
    const once = performRepair(freshState({ inventory: enough, skills: levelFive }), 'fireboxDoor', T0);
    expect(repairBlockers(once.state, 'fireboxDoor')).toContain('alreadyRepaired');
    expect(canRepair(once.state, 'fireboxDoor')).toBe(false);
    const twice = performRepair(once.state, 'fireboxDoor', T0);
    expect(twice.ok).toBe(false);
    expect(twice.state.inventory).toEqual(once.state.inventory);
  });

  it('settles running progress before applying the speed bonus', () => {
    const running = freshState({
      inventory: enough,
      skills: levelFive,
      activity: { skill: 'scavenging', locationId: 'derelictPlatform', lastProcessedAt: T0 },
    });
    const r = performRepair(running, 'fireboxDoor', T0 + 3000 * 4 + 500);
    expect(r.ok).toBe(true);
    expect(r.state.stats.totalSearches).toBe(4);
    expect(r.state.activity?.lastProcessedAt).toBe(T0 + 12000);
  });
});
