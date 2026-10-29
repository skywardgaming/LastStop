import { describe, expect, it } from 'vitest';
import { advance } from '../src/core/activity';
import { MAX_LEVEL, LOCATIONS } from '../src/core/content/world';
import { levelForXp, levelProgress, XP_TABLE, xpForLevel } from '../src/core/xp';
import { fresh, HOUR, running, scavenging, T0 } from './helpers';

describe('XP progression', () => {
  it('starts at level 1 and rises strictly to 20', () => {
    expect(levelForXp(0)).toBe(1);
    expect(XP_TABLE.length).toBe(MAX_LEVEL + 1);
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
  });

  it('levels exactly at each threshold', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
  });

  it('caps at level 20 and treats junk XP as level 1', () => {
    expect(levelProgress(1e12)).toMatchObject({ level: MAX_LEVEL, isMax: true });
    expect(levelForXp(-5)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
  });

  it('awards XP per completed search and reports level-ups', () => {
    const r = advance(running(scavenging()), T0 + LOCATIONS.derelictPlatform.actionMs * 40);
    expect(r.xpGained).toBe(400);
    expect(r.state.skills.scavenging.xp).toBe(400);
    expect(r.levelUp).toEqual({ skill: 'scavenging', from: 1, to: levelForXp(400) });
  });

  it('the Reinforced Tender adds 15% XP', () => {
    const base = advance(running(scavenging()), T0 + 3000 * 10).xpGained;
    const boosted = advance(
      running(scavenging(), { repairs: { ...fresh().repairs, reinforcedStorage: true } }),
      T0 + 3000 * 10,
    ).xpGained;
    expect(base).toBe(100);
    expect(boosted).toBe(Math.round(10 * 1.15) * 10);
  });

  it('pacing: level 5 Scavenging in under 10 minutes, level 20 in hours not minutes', () => {
    const tenMin = advance(running(scavenging()), T0 + 10 * 60_000).state;
    expect(levelForXp(tenMin.skills.scavenging.xp)).toBeGreaterThanOrEqual(5);
    const oneHour = advance(running(scavenging()), T0 + HOUR).state;
    expect(levelForXp(oneHour.skills.scavenging.xp)).toBeLessThan(MAX_LEVEL);
  });
});
