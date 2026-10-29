import type { ItemBundle, SkillId } from '../src/core/content/world';
import { addItems } from '../src/core/inventory';
import { createInitialState, type Activity, type GameState } from '../src/core/state';
import { xpForLevel } from '../src/core/xp';

export const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);
export const SEED = 12345;
export const MIN = 60_000;
export const HOUR = 60 * MIN;

export function fresh(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(T0, SEED), ...overrides };
}

export function withItems(state: GameState, bundle: ItemBundle): GameState {
  return { ...state, inventory: addItems(state.inventory, bundle) };
}

export function atLevel(state: GameState, skill: SkillId, level: number): GameState {
  return { ...state, skills: { ...state.skills, [skill]: { xp: xpForLevel(level) } } };
}

export function running(activity: Activity, overrides: Partial<GameState> = {}): GameState {
  return fresh({ activity, ...overrides });
}

export const scavenging = (locationId: 'derelictPlatform' | 'signalCabinet' | 'maintenanceShed' = 'derelictPlatform', at = T0): Activity => ({
  kind: 'scavenge',
  locationId,
  lastProcessedAt: at,
});
