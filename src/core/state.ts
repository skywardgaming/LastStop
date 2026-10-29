import { REPAIR_IDS, type LocationId, type RepairId } from './data';
import { emptyInventory, type Inventory } from './inventory';

export const SAVE_VERSION = 1;

export interface ScavengingActivity {
  skill: 'scavenging';
  locationId: LocationId;
  /**
   * Timestamp (ms since epoch) up to which this activity has been credited.
   * It only ever moves forward in whole-action steps, so time already paid
   * out can never be paid out again.
   */
  lastProcessedAt: number;
}

export interface GameState {
  version: number;
  skills: { scavenging: { xp: number } };
  inventory: Inventory;
  activity: ScavengingActivity | null;
  repairs: Record<RepairId, boolean>;
  rngState: number;
  stats: { totalSearches: number };
  createdAt: number;
}

export function createInitialState(now: number, seed: number): GameState {
  const repairs = {} as Record<RepairId, boolean>;
  for (const id of REPAIR_IDS) repairs[id] = false;
  return {
    version: SAVE_VERSION,
    skills: { scavenging: { xp: 0 } },
    inventory: emptyInventory(),
    activity: null,
    repairs,
    rngState: seed >>> 0,
    stats: { totalSearches: 0 },
    createdAt: now,
  };
}
