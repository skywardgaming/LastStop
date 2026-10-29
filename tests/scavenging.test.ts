import { describe, expect, it } from 'vitest';
import { LOCATIONS, OFFLINE_CAP_MS } from '../src/core/data';
import {
  actionDurationMs,
  advance,
  startScavenging,
  stopScavenging,
} from '../src/core/scavenging';
import { freshState, scavengingState, T0 } from './helpers';

const ACTION = LOCATIONS.derelictPlatform.actionMs;
const HOUR = 60 * 60 * 1000;

describe('timestamp progression', () => {
  it('does nothing when idle', () => {
    const r = advance(freshState(), T0 + 10 * HOUR);
    expect(r.actions).toBe(0);
  });

  it('credits whole actions and keeps the remainder', () => {
    const r = advance(scavengingState(), T0 + ACTION * 3 + 1200);
    expect(r.actions).toBe(3);
    expect(r.xpGained).toBe(3 * LOCATIONS.derelictPlatform.xpPerAction);
    expect(r.state.activity?.lastProcessedAt).toBe(T0 + ACTION * 3);
  });

  it('gives the same result for one big step or many small ticks', () => {
    const end = T0 + ACTION * 200 + 777;
    const once = advance(scavengingState(), end).state;
    let ticked = scavengingState();
    for (let t = T0; t <= end; t += 250) ticked = advance(ticked, t).state;
    ticked = advance(ticked, end).state;
    expect(ticked.inventory).toEqual(once.inventory);
    expect(ticked.skills).toEqual(once.skills);
    expect(ticked.rngState).toBe(once.rngState);
  });

  it('is deterministic for a given seed', () => {
    const a = advance(scavengingState(), T0 + ACTION * 500).state;
    const b = advance(scavengingState(), T0 + ACTION * 500).state;
    expect(a.inventory).toEqual(b.inventory);
  });

  it('always drops scrap iron and sometimes the rarer items', () => {
    const r = advance(scavengingState(), T0 + ACTION * 1000);
    expect(r.itemsGained.scrapIron).toBeGreaterThanOrEqual(1000);
    expect(r.itemsGained.copperWire).toBeGreaterThan(200);
    expect(r.itemsGained.copperWire).toBeLessThan(500);
    expect(r.itemsGained.brassCog).toBeGreaterThan(10);
    expect(r.itemsGained.brassCog).toBeLessThan(80);
  });

  it('stopping credits finished actions and clears the activity', () => {
    const r = stopScavenging(scavengingState(), T0 + ACTION * 2 + 10);
    expect(r.actions).toBe(2);
    expect(r.state.activity).toBeNull();
  });

  it('starting resets the timer to now', () => {
    const s = startScavenging(freshState(), 'derelictPlatform', T0 + 5000);
    expect(s.activity?.lastProcessedAt).toBe(T0 + 5000);
  });
});

describe('offline progress', () => {
  it('credits up to eight hours exactly', () => {
    const r = advance(scavengingState(), T0 + 8 * HOUR);
    expect(r.discardedMs).toBe(0);
    expect(r.actions).toBe(Math.floor(OFFLINE_CAP_MS / ACTION));
  });

  it('caps anything longer than eight hours', () => {
    const r = advance(scavengingState(), T0 + 30 * HOUR);
    expect(r.actions).toBe(Math.floor(OFFLINE_CAP_MS / ACTION));
    expect(r.discardedMs).toBe(22 * HOUR);
    expect(r.elapsedMs).toBe(30 * HOUR);
  });

  it('never pays the same time twice', () => {
    const first = advance(scavengingState(), T0 + 5 * HOUR);
    const again = advance(first.state, T0 + 5 * HOUR);
    expect(first.actions).toBeGreaterThan(0);
    expect(again.actions).toBe(0);
    expect(again.state.inventory).toEqual(first.state.inventory);
  });

  it('does not let a capped absence be re-claimed later', () => {
    const capped = advance(scavengingState(), T0 + 30 * HOUR);
    const later = advance(capped.state, T0 + 30 * HOUR + ACTION);
    expect(later.actions).toBe(1);
  });

  it('grants nothing if the clock goes backwards, and does not rewind', () => {
    const s = advance(scavengingState(), T0 + 2 * HOUR).state;
    const back = advance(s, T0 + HOUR);
    expect(back.actions).toBe(0);
    expect(back.state.activity?.lastProcessedAt).toBe(s.activity?.lastProcessedAt);
  });

  it('applies the repair speed bonus to action length', () => {
    const repaired = freshState({ repairs: { fireboxDoor: true } });
    expect(actionDurationMs(repaired, 'derelictPlatform')).toBe(Math.round(ACTION / 1.1));
  });
});
