import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { RECIPES } from '../src/core/content/world';
import { startCrafting } from '../src/core/game';
import { craftableCount, durationOf } from '../src/core/rules';
import { atLevel, fresh, HOUR, T0, withItems } from './helpers';

const plate = RECIPES.ironPlate;

describe('Engineering crafting', () => {
  it('consumes inputs and produces outputs per completed action', () => {
    const s = withItems(fresh(), { scrapIron: 30 });
    const started = startCrafting(s, 'ironPlate', T0);
    expect(started.ok).toBe(true);
    const r = advance(started.tick.state, T0 + plate.actionMs * 4 + 100);
    expect(r.actions).toBe(4);
    expect(r.state.inventory.ironPlate).toBe(4);
    expect(r.state.inventory.scrapIron).toBe(18);
    expect(r.state.skills.engineering.xp).toBe(4 * plate.xp);
    expect(r.state.stats.crafts).toBe(4);
  });

  it('stops by itself when materials run out, never overspending', () => {
    const s = withItems(fresh(), { scrapIron: 10 });
    const started = startCrafting(s, 'ironPlate', T0);
    if (!started.ok) throw new Error('should start');
    const r = advance(started.tick.state, T0 + HOUR);
    expect(r.actions).toBe(3);
    expect(r.stopped).toBe('outOfMaterials');
    expect(r.state.activity).toBeNull();
    expect(r.state.inventory.scrapIron).toBe(1);
    expect(r.state.inventory.ironPlate).toBe(3);
  });

  it('refuses to start without materials or below the level', () => {
    expect(startCrafting(fresh(), 'ironPlate', T0).ok).toBe(false);
    const rich = withItems(fresh(), { oakTimber: 30 });
    const r = startCrafting(rich, 'timberBeam', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Engineering level 4/);
    expect(startCrafting(atLevel(rich, 'engineering', 4), 'timberBeam', T0).ok).toBe(true);
  });

  it('multi-input recipes check every input', () => {
    const s = atLevel(withItems(fresh(), { pressureGauge: 1, copperCoil: 2, brassCog: 1 }), 'engineering', 8);
    expect(craftableCount(s, 'gaugeAssembly')).toBe(0);
    expect(startCrafting(s, 'gaugeAssembly', T0).ok).toBe(false);
  });

  it('the Dry Cab makes crafting 20% faster', () => {
    const s = fresh({ activity: { kind: 'craft', recipeId: 'ironPlate', lastProcessedAt: T0 } });
    const dry = { ...s, repairs: { ...s.repairs, dryCab: true } };
    expect(durationOf(dry, dry.activity!)).toBe(Math.round(plate.actionMs / 1.2));
  });
});
