import { describe, expect, it } from 'vitest';
import { REPAIR_IDS, REPAIRS } from '../src/core/content/world';
import { performRepair } from '../src/core/game';
import { modifiers, repairBlockers } from '../src/core/rules';
import { atLevel, fresh, running, scavenging, T0, withItems } from './helpers';

describe('locomotive repairs', () => {
  it('Firebox Door: spends exactly its cost and grants +10% scavenging speed', () => {
    const s = withItems(fresh(), { ironPlate: 5, brassCog: 1 });
    const r = performRepair(s, 'fireboxDoor', T0);
    expect(r.ok).toBe(true);
    expect(r.state.repairs.fireboxDoor).toBe(true);
    expect(r.state.inventory.ironPlate).toBe(1);
    expect(r.state.inventory.brassCog).toBe(0);
    expect(modifiers(r.state).speed.scavenging).toBeCloseTo(0.1);
  });

  it('is blocked by level and by any missing material, spending nothing', () => {
    const cost = REPAIRS.dryCab.cost;
    const rich = withItems(fresh(), cost);
    const low = performRepair(rich, 'dryCab', T0);
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.blockers).toEqual(['levelTooLow']);
    expect(low.state.inventory).toEqual(rich.inventory);

    const poor = atLevel(withItems(fresh(), { timberBeam: 4, ironPlate: 2 }), 'engineering', 6);
    const short = performRepair(poor, 'dryCab', T0);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.blockers).toEqual(['missingResources']);
    expect(short.state.inventory).toEqual(poor.inventory);
  });

  it('cannot be performed twice', () => {
    const s = withItems(fresh(), { ironPlate: 8, brassCog: 2 });
    const once = performRepair(s, 'fireboxDoor', T0);
    expect(repairBlockers(once.state, 'fireboxDoor')).toContain('alreadyRepaired');
    const twice = performRepair(once.state, 'fireboxDoor', T0);
    expect(twice.ok).toBe(false);
    expect(twice.state.inventory).toEqual(once.state.inventory);
  });

  it('settles running progress before the bonus applies', () => {
    const s = withItems(running(scavenging()), { ironPlate: 4, brassCog: 1 });
    const r = performRepair(s, 'fireboxDoor', T0 + 3000 * 5 + 200);
    expect(r.ok).toBe(true);
    expect(r.state.stats.searches.derelictPlatform).toBe(5);
  });

  it('every repair is achievable: each cost is made of obtainable items', () => {
    for (const id of REPAIR_IDS) {
      expect(Object.keys(REPAIRS[id].cost).length).toBeGreaterThan(0);
      expect(REPAIRS[id].levelRequired).toBeLessThanOrEqual(20);
    }
  });

  it('stacks all bonuses once fully restored', () => {
    const repairs = Object.fromEntries(REPAIR_IDS.map((id) => [id, true])) as Record<(typeof REPAIR_IDS)[number], boolean>;
    const m = modifiers(fresh({ repairs }));
    expect(m.speed.scavenging).toBeCloseTo(0.2);
    expect(m.speed.engineering).toBeCloseTo(0.3);
    expect(m.rareChance).toBeCloseTo(1.5);
    expect(m.xp).toBeCloseTo(1.15);
  });

  it('a repair can unlock a dialogue and an achievement', () => {
    const s = withItems(fresh(), { ironPlate: 4, brassCog: 1 });
    const r = performRepair(s, 'fireboxDoor', T0);
    if (!r.ok) throw new Error('expected success');
    expect(r.progression.achievements).toContain('firebox');
    expect(r.progression.dialogues).toContain('maraFirebox');
  });
});
