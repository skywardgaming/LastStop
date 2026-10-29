import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../src/core/data';
import { levelForXp, levelProgress, XP_TABLE, xpForLevel } from '../src/core/xp';

describe('xp curve', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });

  it('is strictly increasing up to the max level', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
    }
    expect(XP_TABLE.length).toBe(MAX_LEVEL + 1);
  });

  it('reaches a level exactly at its threshold, not one XP before', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
  });

  it('caps at level 20 no matter how much XP', () => {
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
    expect(levelProgress(1e12)).toMatchObject({ level: MAX_LEVEL, isMax: true, fraction: 1 });
  });

  it('treats invalid XP as level 1', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it('reports progress within a level', () => {
    const mid = (xpForLevel(3) + xpForLevel(4)) / 2;
    const p = levelProgress(mid);
    expect(p.level).toBe(3);
    expect(p.fraction).toBeCloseTo(0.5, 1);
  });
});
