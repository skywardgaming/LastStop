import { describe, expect, it } from 'vitest';
import { IMPROVEMENT_IDS, REPAIR_IDS, SKILL_IDS } from '../src/core/content/world';
import { skillLevel } from '../src/core/rules';
import { simulate } from './sim';

describe('full-game simulation (goal-directed bot)', () => {
  it('Chapter One: restores No. 9 with no dead ends, first repair within minutes', () => {
    const log = simulate([...REPAIR_IDS], 24);
    // eslint-disable-next-line no-console
    console.log('Chapter One minutes:', log.partAt, `levels`, Object.fromEntries(SKILL_IDS.map((k) => [k, skillLevel(log.finalState, k)])));
    expect(log.finalState.repairs.boiler).toBe(true);
    expect(log.partAt.fireboxDoor ?? Infinity).toBeLessThan(12);
    expect(log.partAt.boiler ?? Infinity).toBeLessThan(10 * 60);
    expect(log.partAt.boiler ?? 0).toBeGreaterThan(3 * 60);
  });

  it('Night Works: every improvement is reachable', () => {
    const log = simulate([...REPAIR_IDS, ...IMPROVEMENT_IDS], 48);
    // eslint-disable-next-line no-console
    console.log('Night Works minutes:', log.partAt, 'research done', log.finalState.research.done.length);
    for (const id of IMPROVEMENT_IDS) expect(log.finalState.repairs[id], id).toBe(true);
  });

  it('works for several seeds (luck never blocks progress)', () => {
    for (const seed of [1, 99, 31337]) {
      const log = simulate([...REPAIR_IDS], 24, seed, 60_000);
      expect(log.finalState.repairs.boiler, `seed ${seed}`).toBe(true);
    }
  });
});
