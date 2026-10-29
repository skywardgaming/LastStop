import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/scavenging';
import { deserialize, serialize } from '../src/core/save';
import { SAVE_VERSION } from '../src/core/state';
import { scavengingState, SEED, T0 } from './helpers';

describe('versioned saves', () => {
  it('round-trips a game state', () => {
    const state = advance(scavengingState(), T0 + 60_000).state;
    const loaded = deserialize(serialize(state, T0 + 60_000), T0 + 60_000, SEED);
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.state).toEqual(state);
  });

  it('reports empty and corrupt saves', () => {
    expect(deserialize(null, T0, SEED).status).toBe('empty');
    expect(deserialize('{not json', T0, SEED).status).toBe('corrupt');
    expect(deserialize('[]', T0, SEED).status).toBe('corrupt');
  });

  it('rejects unknown save versions', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 99, savedAt: T0, state: {} });
    expect(deserialize(raw, T0, SEED).status).toBe('corrupt');
  });

  it('clamps negative and invalid values instead of trusting them', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      savedAt: T0,
      state: {
        skills: { scavenging: { xp: -500 } },
        inventory: { scrapIron: -10, copperWire: 3.7, brassCog: 'lots', ghostItem: 99 },
        repairs: { fireboxDoor: 'yes' },
        activity: { skill: 'scavenging', locationId: 'moon', lastProcessedAt: T0 },
      },
    });
    const loaded = deserialize(raw, T0, SEED);
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.state.skills.scavenging.xp).toBe(0);
    expect(loaded.state.inventory).toEqual({ scrapIron: 0, copperWire: 3, brassCog: 0 });
    expect(loaded.state.repairs.fireboxDoor).toBe(false);
    expect(loaded.state.activity).toBeNull();
  });

  it('reloading the same save does not duplicate offline rewards once it is re-saved', () => {
    const before = scavengingState();
    const raw = serialize(before, T0);
    const now = T0 + 2 * 60 * 60 * 1000;

    // First load: catch up and immediately save, as the game does.
    const first = deserialize(raw, now, SEED);
    if (first.status !== 'ok') throw new Error('load failed');
    const caught = advance(first.state, now);
    const resaved = serialize(caught.state, now);

    // Second load at the same moment yields nothing more.
    const second = deserialize(resaved, now, SEED);
    if (second.status !== 'ok') throw new Error('load failed');
    const again = advance(second.state, now);
    expect(caught.actions).toBeGreaterThan(0);
    expect(again.actions).toBe(0);
    expect(again.state.inventory).toEqual(caught.state.inventory);
  });
});
