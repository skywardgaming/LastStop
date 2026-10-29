import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { startCrafting, startScavenging, stopActivity } from '../src/core/game';
import { atLevel, fresh, running, scavenging, T0, withItems } from './helpers';

describe('activity switching', () => {
  it('switching settles the old activity before starting the new one', () => {
    const s = withItems(running(scavenging()), { scrapIron: 30 });
    const r = startCrafting(s, 'ironPlate', T0 + 3000 * 4 + 999);
    expect(r.ok).toBe(true);
    expect(r.tick.actions).toBe(4);
    expect(r.tick.state.stats.searches.derelictPlatform).toBe(4);
    expect(r.tick.state.activity).toEqual({ kind: 'craft', recipeId: 'ironPlate', lastProcessedAt: T0 + 3000 * 4 + 999 });
  });

  it('only one activity runs at a time', () => {
    const s = withItems(fresh(), { scrapIron: 30 });
    const a = startScavenging(s, 'derelictPlatform', T0);
    const b = startCrafting(a.tick.state, 'ironPlate', T0 + 100);
    expect(b.tick.state.activity?.kind).toBe('craft');
    const after = advance(b.tick.state, T0 + 100 + 3000 * 2);
    expect(after.state.stats.searches.derelictPlatform ?? 0).toBe(0);
    expect(after.state.inventory.ironPlate).toBe(2);
  });

  it('a failed switch keeps the current activity running', () => {
    const s = running(scavenging());
    const r = startScavenging(s, 'maintenanceShed', T0 + 1000);
    expect(r.ok).toBe(false);
    expect(r.tick.state.activity?.kind).toBe('scavenge');
  });

  it('stopping credits finished actions and discards the partial one', () => {
    const r = stopActivity(running(scavenging()), T0 + 3000 * 2 + 2900);
    expect(r.actions).toBe(2);
    expect(r.state.activity).toBeNull();
    expect(advance(r.state, T0 + 3000 * 100).actions).toBe(0);
  });

  it('switching between locations keeps per-location search counts', () => {
    let s = atLevel(fresh({ repairs: { ...fresh().repairs, fireboxDoor: true } }), 'scavenging', 3);
    s = startScavenging(s, 'derelictPlatform', T0).tick.state;
    s = startScavenging(s, 'signalCabinet', T0 + 3000 * 3).tick.state;
    s = stopActivity(s, T0 + 3000 * 3 + 4200 * 2 / 1.1 + 10).state;
    expect(s.stats.searches.derelictPlatform).toBe(3);
    expect(s.stats.searches.signalCabinet).toBe(2);
  });
});
