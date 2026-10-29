import { ITEM_IDS, type ItemId } from './content/items';
import {
  SKILL_IDS,
  TRAIN_PART_IDS,
  type LocationId,
  type ProjectId,
  type RecipeId,
  type SalvageId,
  type SkillId,
  type ToolId,
  type TrainPartId,
} from './content/world';

export const SAVE_VERSION = 3;

export type Inventory = Record<ItemId, number>;

/**
 * The one thing the player is doing. `lastProcessedAt` is the moment it has
 * been credited up to; it only ever moves forward in whole actions.
 */
export type Activity =
  | { kind: 'scavenge'; locationId: LocationId; lastProcessedAt: number }
  | { kind: 'craft'; recipeId: RecipeId; lastProcessedAt: number }
  | { kind: 'salvage'; targetId: SalvageId; lastProcessedAt: number }
  | { kind: 'research'; projectId: ProjectId; lastProcessedAt: number };

export type ActivityKind = Activity['kind'];

export interface GameStats {
  searches: Partial<Record<LocationId, number>>;
  crafts: number;
  salvages: number;
  studies: number;
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
  /** Repairs and improvements to No. 9. */
  repairs: Record<TrainPartId, boolean>;
  /** One tool slot per skill. Equipped tools are not in the inventory. */
  equipment: Record<SkillId, ToolId | null>;
  research: {
    /** Actions completed on unfinished projects. */
    progress: Partial<Record<ProjectId, number>>;
    done: ProjectId[];
  };
  /** Discovery id → timestamp it was found. */
  discoveries: Record<string, number>;
  achievements: Record<string, number>;
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

export function emptySkills(): Record<SkillId, { xp: number }> {
  const s = {} as Record<SkillId, { xp: number }>;
  for (const id of SKILL_IDS) s[id] = { xp: 0 };
  return s;
}

export function createInitialState(now: number, seed: number): GameState {
  const repairs = {} as Record<TrainPartId, boolean>;
  for (const id of TRAIN_PART_IDS) repairs[id] = false;
  const equipment = {} as Record<SkillId, ToolId | null>;
  for (const id of SKILL_IDS) equipment[id] = null;
  return {
    version: SAVE_VERSION,
    skills: emptySkills(),
    inventory: emptyInventory(),
    activity: null,
    repairs,
    equipment,
    research: { progress: {}, done: [] },
    discoveries: {},
    achievements: {},
    dialogues: { unlocked: [], read: [] },
    rngState: seed >>> 0,
    clockHighWater: Number.isFinite(now) ? now : 0,
    stats: { searches: {}, crafts: 0, salvages: 0, studies: 0, rareFinds: 0, obtained: {}, longestAwayMs: 0 },
    onboarded: false,
    createdAt: now,
  };
}
