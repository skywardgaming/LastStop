import { createInitialState, type GameState } from '../src/core/state';

export const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);
export const SEED = 12345;

export function freshState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(T0, SEED), ...overrides };
}

export function scavengingState(): GameState {
  return freshState({
    activity: { skill: 'scavenging', locationId: 'derelictPlatform', lastProcessedAt: T0 },
  });
}
