import { ITEM_IDS, type ItemId } from './content/items';
import { REPAIR_IDS, type LocationId, type RecipeId, type RepairId, type SkillId } from './content/world';

export const SAVE_VERSION = 2;

export type Inventory = Record<ItemId, number>;

export type Activity =
  | {
      kind: 'scavenge';
      locationId: LocationId;
      /** Credited up to this moment; moves forward only in whole actions. */
      lastProcessedAt: number;
    }
  | {
      kind: 'craft';
      recipeId: RecipeId;
      lastProcessedAt: number;
    };

export interface GameStats {
  searches: Partial<Record<LocationId, number>>;
  crafts: number;
  rareFinds: number;
  /** Total of each item ever obtained, used for "???" reveals and goals. */
  obtained: Partial<Record<ItemId, number>>;
  longestAwayMs: number;
}

export interface GameState {
  version: number;
  skills: Record<SkillId, { xp: number }>;
  inventory: Inventory;
  activity: Activity | null;
  repairs: Record<RepairId, boolean>;
  /** Discovery id → timestamp it was found. */
  discoveries: Record<string, number>;
  achievements: Record<string, number>;
  /** Dialogue ids that became available, and those read. */
  dialogues: { unlocked: string[]; read: string[] };
  rngState: number;
  /**
   * The latest timestamp the game has ever accepted. Time before this is
   * never credited again, so winding the clock back and forth (or switching
   * activities while it is wound back) cannot farm rewards.
   */
  clockHighWater: number;
  stats: GameStats;
  onboarded: boolean;
  createdAt: number;
}

export function emptyInventory(): Inventory {
  const inv = {} as Inventory;
  for (const id of ITEM_IDS) inv[id] = 0;
  return inv;
}

export function createInitialState(now: number, seed: number): GameState {
  const repairs = {} as Record<RepairId, boolean>;
  for (const id of REPAIR_IDS) repairs[id] = false;
  return {
    version: SAVE_VERSION,
    skills: { scavenging: { xp: 0 }, engineering: { xp: 0 } },
    inventory: emptyInventory(),
    activity: null,
    repairs,
    discoveries: {},
    achievements: {},
    dialogues: { unlocked: [], read: [] },
    rngState: seed >>> 0,
    clockHighWater: Number.isFinite(now) ? now : 0,
    stats: { searches: {}, crafts: 0, rareFinds: 0, obtained: {}, longestAwayMs: 0 },
    onboarded: false,
    createdAt: now,
  };
}
