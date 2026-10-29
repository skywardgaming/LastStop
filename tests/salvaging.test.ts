import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { SALVAGE } from '../src/core/content/world';
import { startSalvaging } from '../src/core/game';
import { actionDuration, modifiers, salvageAccess } from '../src/core/rules';
import { atLevel, fresh, HOUR, T0, withItems } from './helpers';

describe('Salvaging', () => {
  it('the Scrap Wagon is open from the start and never runs out', () => {
    const r = startSalvaging(fresh(), 'scrapWagon', T0);
    expect(r.ok).toBe(true);
    const after = advance(r.tick.state, T0 + 8 * HOUR);
    expect(after.stopped).toBeNull();
    expect(after.actions).toBe(Math.floor((8 * HOUR) / SALVAGE.scrapWagon.actionMs));
    expect(after.state.inventory.scrapIron).toBeGreaterThanOrEqual(after.actions);
    expect(after.state.inventory.brassFitting).toBeGreaterThan(0);
    expect(after.state.skills.salvaging.xp).toBe(after.actions * SALVAGE.scrapWagon.xp);
  });

  it('machinery targets consume one item per action and stop when it runs out', () => {
    const s = atLevel(withItems(fresh(), { brokenLantern: 3 }), 'salvaging', 2);
    const r = startSalvaging(s, 'brokenLantern', T0);
    if (!r.ok) throw new Error(r.reason);
    const after = advance(r.tick.state, T0 + HOUR);
    expect(after.actions).toBe(3);
    expect(after.itemsSpent.brokenLantern).toBe(3);
    expect(after.state.inventory.brokenLantern).toBe(0);
    expect(after.stopped).toBe('outOfMaterials');
    expect(after.state.activity).toBeNull();
    expect(after.state.inventory.glassShard).toBeGreaterThanOrEqual(6);
  });

  it('is gated by level and by having the machinery', () => {
    expect(salvageAccess(withItems(fresh(), { telegraphSet: 1 }), 'telegraphSet').ok).toBe(false);
    expect(salvageAccess(atLevel(fresh(), 'salvaging', 5), 'telegraphSet').ok).toBe(false);
    expect(salvageAccess(atLevel(withItems(fresh(), { telegraphSet: 1 }), 'salvaging', 5), 'telegraphSet').ok).toBe(true);
  });

  it('double yield doubles the whole action, deterministically', () => {
    const base = atLevel(withItems(fresh(), { seizedPump: 200 }), 'salvaging', 8);
    const boosted = { ...base, equipment: { ...base.equipment, salvaging: 'cuttingTorch' as const }, skills: { ...base.skills, salvaging: { xp: 1e6 } } };
    expect(modifiers(boosted).doubleChance).toBeCloseTo(0.2);
    const r1 = startSalvaging(boosted, 'seizedPump', T0);
    if (!r1.ok) throw new Error(r1.reason);
    const end = T0 + actionDuration(r1.tick.state, { kind: 'salvage', targetId: 'seizedPump' }) * 150;
    const a = advance(r1.tick.state, end);
    const b = advance(r1.tick.state, end);
    expect(a.doubles).toBeGreaterThan(10);
    expect(a.doubles).toBeLessThan(60);
    expect(a.state.inventory).toEqual(b.state.inventory);
    expect(a.state.inventory.bearing).toBeGreaterThanOrEqual(a.actions + a.doubles);
  });

  it('salvaged rare drops respect the rare-find bonus', () => {
    const s = atLevel(withItems(fresh(), { deadDynamo: 1 }), 'salvaging', 12);
    const lit = { ...s, repairs: { ...s.repairs, headlamp: true } };
    expect(modifiers(lit).rareChance).toBeCloseTo(1.5);
  });
});
