import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { fresh, HOUR, running, scavenging, SEED, T0 } from './helpers';

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

/** A save exactly as Ashvale 0.2 wrote it. */
function v2Save(): string {
  return JSON.stringify({
    version: 2,
    savedAt: T0,
    state: {
      version: 2,
      skills: { scavenging: { xp: 4000 }, engineering: { xp: 2500 } },
      inventory: { scrapIron: 30, ironPlate: 5, cyanPrism: 1 },
      activity: { kind: 'craft', recipeId: 'ironPlate', lastProcessedAt: T0 },
      repairs: { fireboxDoor: true, headlamp: true, dryCab: false, reinforcedStorage: false, boiler: false },
      discoveries: { tornTimetable: T0, shedKey: T0 },
      achievements: { firstSearch: T0, firebox: T0 },
      dialogues: { unlocked: ['maraIntro', 'maraFirebox'], read: ['maraIntro'] },
      rngState: 4242,
      clockHighWater: T0,
      stats: { searches: { derelictPlatform: 400, signalCabinet: 50 }, crafts: 30, rareFinds: 4, obtained: { ironPlate: 20 }, longestAwayMs: 1000 },
      onboarded: true,
      createdAt: T0 - HOUR,
    },
  });
}

describe('save migration v2 → v3 (Ascension)', () => {
  it('keeps everything from 0.2 and adds the new systems empty', () => {
    const loaded = deserialize(v2Save(), T0 + 1000, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    const s = loaded.state;
    expect(loaded.migratedFrom).toBe(2);
    expect(s.version).toBe(3);
    expect(s.skills).toEqual({ scavenging: { xp: 4000 }, engineering: { xp: 2500 }, salvaging: { xp: 0 }, research: { xp: 0 } });
    expect(s.inventory.ironPlate).toBe(5);
    expect(s.inventory.waterloggedNotes).toBe(0);
    expect(s.repairs).toMatchObject({ fireboxDoor: true, headlamp: true, cabLanterns: false, signalReceiver: false });
    expect(s.equipment).toEqual({ scavenging: null, engineering: null, salvaging: null, research: null });
    expect(s.research).toEqual({ progress: {}, done: [] });
    expect(s.activity).toEqual({ kind: 'craft', recipeId: 'ironPlate', lastProcessedAt: T0 });
    expect(s.discoveries).toEqual({ tornTimetable: T0, shedKey: T0 });
    expect(s.dialogues.read).toEqual(['maraIntro']);
    expect(s.rngState).toBe(4242);
    expect(s.stats.salvages).toBe(0);
  });

  it('a v1 save migrates all the way to v3', () => {
    const v1 = JSON.stringify({ version: 1, savedAt: T0, state: { skills: { scavenging: { xp: 100 } }, inventory: { scrapIron: 3 }, repairs: { fireboxDoor: true } } });
    const loaded = deserialize(v1, T0, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    expect(loaded.state.version).toBe(3);
    expect(loaded.state.skills.research.xp).toBe(0);
    expect(loaded.state.repairs.fireboxDoor).toBe(true);
  });

  it('round-trips the new fields', () => {
    const base = fresh();
    const s = {
      ...base,
      equipment: { ...base.equipment, salvaging: 'hacksaw' as const },
      research: { progress: { signalDiagrams: 5 }, done: ['platformSurvey' as const] },
      activity: { kind: 'research' as const, projectId: 'signalDiagrams' as const, lastProcessedAt: T0 },
    };
    const loaded = deserialize(serialize(s, T0), T0, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    expect(loaded.state.equipment.salvaging).toBe('hacksaw');
    expect(loaded.state.research).toEqual(s.research);
    expect(loaded.state.activity).toEqual(s.activity);
  });

  it('rejects tools in the wrong slot, unknown projects and impossible progress', () => {
    const raw = JSON.stringify({
      version: 3,
      savedAt: T0,
      state: {
        equipment: { scavenging: 'hacksaw', salvaging: 'goldSaw', research: 'readingGlass' },
        research: { progress: { platformSurvey: 999, made: 3 }, done: ['catalogue', 'cyanOptics', 'nope', 'cyanOptics'] },
        activity: { kind: 'research', projectId: 'cyanOptics', lastProcessedAt: T0 },
      },
    });
    const loaded = deserialize(raw, T0, SEED);
    if (loaded.status !== 'ok') throw new Error('load');
    expect(loaded.state.equipment).toEqual({ scavenging: null, engineering: null, salvaging: null, research: 'readingGlass' });
    expect(loaded.state.research.done).toEqual(['cyanOptics']);
    expect(loaded.state.research.progress).toEqual({ platformSurvey: 9 });
    expect(loaded.state.activity).toBeNull();
  });
});
