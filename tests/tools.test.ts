import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { TOOLS } from '../src/core/content/world';
import { autoEquip, equipTool, evaluate, startCrafting, startScavenging, unequipTool } from '../src/core/game';
import { actionDuration, modifiers } from '../src/core/rules';
import { atLevel, fresh, HOUR, MIN, T0, withItems } from './helpers';

describe('tools and equipment', () => {
  it('crafting a tool puts it in the satchel; equipping moves it into the slot', () => {
    const s = atLevel(withItems(fresh(), { ironPlate: 2, scrapIron: 4 }), 'engineering', 2);
    const r = startCrafting(s, 'pryBar', T0);
    if (!r.ok) throw new Error(r.reason);
    const crafted = advance(r.tick.state, T0 + HOUR).state;
    expect(crafted.inventory.pryBar).toBe(1);
    const eq = equipTool(crafted, 'pryBar', T0 + HOUR);
    if (!eq.ok) throw new Error(eq.reason);
    expect(eq.state.equipment.scavenging).toBe('pryBar');
    expect(eq.state.inventory.pryBar).toBe(0);
  });

  it('an equipped tool speeds up its skill', () => {
    const s = withItems(fresh(), { pryBar: 1 });
    const before = actionDuration(s, { kind: 'scavenge', locationId: 'derelictPlatform' });
    const eq = equipTool(s, 'pryBar', T0);
    if (!eq.ok) throw new Error(eq.reason);
    expect(actionDuration(eq.state, { kind: 'scavenge', locationId: 'derelictPlatform' })).toBe(Math.round(before / 1.1));
  });

  it('swapping returns the old tool, and unequipping returns it too (never duplicated)', () => {
    let s = atLevel(withItems(fresh(), { pryBar: 1, brassLantern: 1 }), 'scavenging', 6);
    s = (equipTool(s, 'pryBar', T0) as { state: typeof s }).state;
    s = (equipTool(s, 'brassLantern', T0) as { state: typeof s }).state;
    expect(s.equipment.scavenging).toBe('brassLantern');
    expect(s.inventory.pryBar).toBe(1);
    expect(s.inventory.brassLantern).toBe(0);
    s = unequipTool(s, 'scavenging', T0).state;
    expect(s.equipment.scavenging).toBeNull();
    expect(s.inventory.brassLantern).toBe(1);
    expect(s.inventory.pryBar).toBe(1);
  });

  it('equip/unequip spam cannot create tools', () => {
    let s = withItems(fresh(), { hacksaw: 1 });
    for (let i = 0; i < 20; i++) {
      s = (equipTool(s, 'hacksaw', T0 + i) as { state: typeof s }).state;
      s = unequipTool(s, 'salvaging', T0 + i).state;
    }
    expect(s.inventory.hacksaw).toBe(1);
    expect(s.equipment.salvaging).toBeNull();
  });

  it('higher tiers need skill levels to equip', () => {
    const s = withItems(fresh(), { cyanLantern: 1 });
    const r = equipTool(s, 'cyanLantern', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Scavenging level 12/);
    expect(equipTool(atLevel(s, 'scavenging', 12), 'cyanLantern', T0).ok).toBe(true);
  });

  it('you cannot equip a tool you do not have, or into the wrong slot', () => {
    expect(equipTool(fresh(), 'pryBar', T0).ok).toBe(false);
    expect(TOOLS.pryBar.skill).toBe('scavenging');
  });

  it('auto-equip fills empty slots and only upgrades tiers', () => {
    let s = atLevel(withItems(fresh(), { pryBar: 1, brassLantern: 1, hacksaw: 1 }), 'scavenging', 6);
    s = autoEquip(s, ['pryBar', 'hacksaw'], T0).state;
    expect(s.equipment.scavenging).toBe('pryBar');
    expect(s.equipment.salvaging).toBe('hacksaw');
    s = autoEquip(s, ['brassLantern'], T0).state;
    expect(s.equipment.scavenging).toBe('brassLantern');
    s = autoEquip(s, ['pryBar'], T0).state;
    expect(s.equipment.scavenging).toBe('brassLantern');
  });

  it('equipping mid-activity settles progress first, so the bonus is not retroactive', () => {
    const s = withItems(fresh(), { pryBar: 1 });
    const started = startScavenging(s, 'derelictPlatform', T0);
    if (!started.ok) throw new Error(started.reason);
    const eq = equipTool(started.tick.state, 'pryBar', T0 + 10 * MIN);
    if (!eq.ok) throw new Error(eq.reason);
    expect(eq.settled.actions).toBe((10 * MIN) / 3000);
  });

  it('Precision Tools sometimes keep the materials; output always arrives', () => {
    const base = atLevel(withItems(fresh(), { scrapIron: 300 }), 'engineering', 8);
    const s = { ...base, equipment: { ...base.equipment, engineering: 'precisionTools' as const } };
    expect(modifiers(s).saveChance.engineering).toBeCloseTo(0.1);
    const r = startCrafting(s, 'ironPlate', T0);
    if (!r.ok) throw new Error(r.reason);
    const after = advance(r.tick.state, T0 + 20 * MIN);
    expect(after.saves).toBeGreaterThan(0);
    expect(after.state.inventory.ironPlate).toBe(after.actions);
    expect(after.itemsSpent.scrapIron).toBe((after.actions - after.saves) * 3);
  });

  it('owning a tool for every skill earns the Full Kit feat and its bonus', () => {
    const s = withItems(fresh(), { pryBar: 1, hacksaw: 1, readingGlass: 1, benchVice: 1 });
    const e = evaluate(s, T0);
    expect(e.achievements).toContain('fullKit');
    expect(modifiers(e.state).speed.research).toBeCloseTo(0.05);
  });
});
