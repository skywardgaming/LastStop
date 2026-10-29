import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { HOUR, running, scavenging, SEED, T0 } from './helpers';

/** A save exactly as Prototype 0.1 wrote it. */
function v1Save(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    savedAt: T0,
    state: {
      version: 1,
      skills: { scavenging: { xp: 900 } },
      inventory: { scrapIron: 40, copperWire: 9, brassCog: 2 },
      activity: { skill: 'scavenging', locationId: 'derelictPlatform', lastProcessedAt: T0 },
      repairs: { fireboxDoor: true },
      rngState: 777,
      stats: { totalSearches: 120 },
      createdAt: T0 - HOUR,
      ...overrides,
    },
  });
}

describe('save round trip', () => {
  it('restores a v2 state exactly', () => {
    const s = advance(running(scavenging()), T0 + HOUR).state;
    const loaded = deserialize(serialize(s, T0 + HOUR), T0 + HOUR, SEED);
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.state).toEqual(s);
      expect(loaded.migratedFrom).toBeNull();
    }
  });

  it('reports empty, corrupt and unknown-version saves', () => {
    expect(deserialize(null, T0, SEED).status).toBe('empty');
    expect(deserialize('{nope', T0, SEED).status).toBe('corrupt');
    expect(deserialize('[]', T0, SEED).status).toBe('corrupt');
    expect(deserialize(JSON.stringify({ version: 99, state: {} }), T0, SEED).status).toBe('corrupt');
  });
});

describe('save migration v1 → v2', () => {
  it('keeps XP, items, the firebox repair, RNG and the running activity', () => {
    const loaded = deserialize(v1Save(), T0 + 1000, SEED);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    const s = loaded.state;
    expect(loaded.migratedFrom).toBe(1);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.skills.scavenging.xp).toBe(900);
    expect(s.skills.engineering.xp).toBe(0);
    expect(s.inventory).toMatchObject({ scrapIron: 40, copperWire: 9, brassCog: 2, coalLump: 0 });
    expect(s.repairs).toMatchObject({ fireboxDoor: true, headlamp: false });
    expect(s.rngState).toBe(777);
    expect(s.activity).toEqual({ kind: 'scavenge', locationId: 'derelictPlatform', lastProcessedAt: T0 });
    expect(s.stats.searches.derelictPlatform).toBe(120);
    expect(s.onboarded).toBe(true);
  });

  it('a migrated save still earns its offline time, once', () => {
    const loaded = deserialize(v1Save(), T0 + 2 * HOUR, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    const first = advance(loaded.state, T0 + 2 * HOUR);
    expect(first.actions).toBeGreaterThan(0);
    expect(advance(first.state, T0 + 2 * HOUR).actions).toBe(0);
  });

  it('clamps garbage values from an old save', () => {
    const loaded = deserialize(
      v1Save({ skills: { scavenging: { xp: -50 } }, inventory: { scrapIron: -3, copperWire: 2.9, ghost: 4 }, repairs: { fireboxDoor: 'yes' } }),
      T0,
      SEED,
    );
    if (loaded.status !== 'ok') throw new Error('load');
    expect(loaded.state.skills.scavenging.xp).toBe(0);
    expect(loaded.state.inventory.scrapIron).toBe(0);
    expect(loaded.state.inventory.copperWire).toBe(2);
    expect(loaded.state.repairs.fireboxDoor).toBe(false);
  });
});

describe('v2 sanitising', () => {
  it('drops unknown discoveries, dialogues and activities', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      savedAt: T0,
      state: {
        discoveries: { tornTimetable: T0, madeUp: T0 },
        dialogues: { unlocked: ['maraIntro', 'fake', 'maraIntro'], read: ['fake', 'maraIntro', 'tobinIntro'] },
        activity: { kind: 'craft', recipeId: 'goldBar', lastProcessedAt: T0 },
      },
    });
    const loaded = deserialize(raw, T0, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    expect(Object.keys(loaded.state.discoveries)).toEqual(['tornTimetable']);
    expect(loaded.state.dialogues).toEqual({ unlocked: ['maraIntro'], read: ['maraIntro'] });
    expect(loaded.state.activity).toBeNull();
  });

  it('keeps a future clock high-water mark so wound-back clocks earn nothing', () => {
    const s = advance(running(scavenging()), T0 + 5 * HOUR).state;
    const loaded = deserialize(serialize(s, T0 + 5 * HOUR), T0, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    expect(loaded.state.clockHighWater).toBe(T0 + 5 * HOUR);
    expect(advance(loaded.state, T0 + HOUR).actions).toBe(0);
  });
});
