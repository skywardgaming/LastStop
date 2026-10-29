import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { LOCATIONS, OFFLINE_CAP_MS } from '../src/core/content/world';
import { startCrafting, startScavenging, stopActivity, tick } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save';
import { fresh, HOUR, MIN, running, scavenging, SEED, T0, withItems } from './helpers';

const ACTION = LOCATIONS.derelictPlatform.actionMs;
const CAP_ACTIONS = Math.floor(OFFLINE_CAP_MS / ACTION);

describe('offline rewards', () => {
  it('credits whole actions and carries the remainder', () => {
    const r = advance(running(scavenging()), T0 + ACTION * 3 + 1200);
    expect(r.actions).toBe(3);
    expect(r.state.activity?.lastProcessedAt).toBe(T0 + ACTION * 3);
  });

  it('caps at eight hours and reports the discarded time', () => {
    const r = advance(running(scavenging()), T0 + 30 * HOUR);
    expect(r.actions).toBe(CAP_ACTIONS);
    expect(r.discardedMs).toBe(22 * HOUR);
  });

  it('one big step equals many small ticks (deterministic)', () => {
    const end = T0 + ACTION * 300 + 777;
    const once = advance(running(scavenging()), end).state;
    let s = running(scavenging());
    for (let t = T0; t <= end; t += 250) s = advance(s, t).state;
    s = advance(s, end).state;
    expect(s.inventory).toEqual(once.inventory);
    expect(s.rngState).toBe(once.rngState);
    expect(s.discoveries).toEqual(once.discoveries);
  });

  it('crafting progresses offline too, until materials run out', () => {
    const s = withItems(fresh(), { scrapIron: 300 });
    const started = startCrafting(s, 'ironPlate', T0);
    if (!started.ok) throw new Error('start failed');
    const r = advance(started.tick.state, T0 + 8 * HOUR);
    expect(r.state.inventory.ironPlate).toBe(100);
    expect(r.state.activity).toBeNull();
  });
});

describe('duplication exploits', () => {
  it('the same moment is never paid twice', () => {
    const first = advance(running(scavenging()), T0 + 5 * HOUR);
    const again = advance(first.state, T0 + 5 * HOUR);
    expect(again.actions).toBe(0);
    expect(again.state.inventory).toEqual(first.state.inventory);
  });

  it('rapid reloads of a re-saved game add nothing', () => {
    const now = T0 + 3 * HOUR;
    let raw = serialize(running(scavenging()), T0);
    let total = -1;
    for (let i = 0; i < 5; i++) {
      const loaded = deserialize(raw, now, SEED);
      if (loaded.status !== 'ok') throw new Error('load');
      const caught = tick(loaded.state, now);
      raw = serialize(caught.state, now);
      if (total < 0) total = caught.state.inventory.scrapIron;
      expect(caught.state.inventory.scrapIron).toBe(total);
    }
  });

  it('winding the clock back credits nothing and does not rewind', () => {
    const ahead = advance(running(scavenging()), T0 + 2 * HOUR).state;
    const back = advance(ahead, T0 + HOUR);
    expect(back.clockRewound).toBe(true);
    expect(back.actions).toBe(0);
    expect(back.state).toBe(ahead);
  });

  it('forward-back-forward clock cycles cannot farm the offline window', () => {
    // Jump 8h ahead and collect.
    const jumped = tick(running(scavenging()), T0 + 8 * HOUR);
    expect(jumped.actions).toBe(CAP_ACTIONS);
    // Wind the clock back to real time and switch activity to reset the anchor.
    const back = startScavenging(jumped.state, 'derelictPlatform', T0 + MIN);
    // The new activity is anchored at the high-water mark, not the wound-back clock.
    expect(back.tick.state.activity?.lastProcessedAt).toBe(T0 + 8 * HOUR);
    // Jump ahead again to the same moment: nothing new.
    const again = tick(back.tick.state, T0 + 8 * HOUR);
    expect(again.actions).toBe(0);
  });

  it('a capped absence cannot be re-claimed later', () => {
    const capped = advance(running(scavenging()), T0 + 30 * HOUR);
    const later = advance(capped.state, T0 + 30 * HOUR + ACTION);
    expect(later.actions).toBe(1);
  });

  it('stopping and restarting repeatedly yields no more than continuous play', () => {
    const end = T0 + 10 * MIN;
    const continuous = advance(running(scavenging()), end).state.stats.searches.derelictPlatform ?? 0;
    let s = running(scavenging());
    for (let t = T0 + 500; t < end; t += 500) {
      s = stopActivity(s, t).state;
      const r = startScavenging(s, 'derelictPlatform', t);
      s = r.tick.state;
    }
    s = advance(s, end).state;
    expect(s.stats.searches.derelictPlatform ?? 0).toBeLessThanOrEqual(continuous);
  });
});

describe('invalid timestamps', () => {
  it('NaN and Infinity credit nothing and leave state unchanged', () => {
    const s = running(scavenging());
    expect(advance(s, Number.NaN).state).toBe(s);
    expect(advance(s, Number.POSITIVE_INFINITY).state).toBe(s);
    expect(advance(s, Number.NEGATIVE_INFINITY).actions).toBe(0);
  });

  it('a negative or zero clock credits nothing', () => {
    expect(advance(running(scavenging()), -1).actions).toBe(0);
    expect(advance(running(scavenging()), 0).actions).toBe(0);
  });

  it('an activity anchored in the future earns nothing until that time arrives', () => {
    const s = running(scavenging('derelictPlatform', T0 + HOUR));
    expect(advance(s, T0 + 10 * MIN).actions).toBe(0);
    expect(advance(s, T0 + HOUR + ACTION).actions).toBe(1);
  });
});
