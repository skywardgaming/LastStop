import { MAX_LEVEL } from './content/world';

/**
 * Total XP needed to reach each level. Index = level, so XP_TABLE[1] = 0.
 * Curve: 60 * (level - 1)^2.2, steepening past level 12 so the last levels
 * are long-term goals. Level 5 takes ~6 minutes of searching; level 12 a
 * couple of hours; level 20 many hours per skill.
 */
export const XP_TABLE: readonly number[] = buildTable();

function buildTable(): number[] {
  const table = [0, 0];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const late = 1 + 0.15 * Math.pow(Math.max(0, level - 12), 1.5);
    table.push(Math.round(60 * Math.pow(level - 1, 2.2) * late));
  }
  return table;
}

export function xpForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL);
  return XP_TABLE[clamped] ?? 0;
}

export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let level = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (xp >= xpForLevel(l)) level = l;
    else break;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  current: number;
  needed: number;
  fraction: number;
  isMax: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, fraction: 1, isMax: true };
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = Math.max(0, xp - floor);
  const needed = next - floor;
  return { level, current, needed, fraction: Math.min(1, current / needed), isMax: false };
}
