import { describe, expect, it } from 'vitest';
import { addItems, hasItems, removeItems, timesAffordable } from '../src/core/inventory';
import { emptyInventory } from '../src/core/state';

describe('inventory transactions', () => {
  it('adds without mutating', () => {
    const inv = emptyInventory();
    const next = addItems(inv, { scrapIron: 3, cyanPrism: 1 });
    expect(next.scrapIron).toBe(3);
    expect(next.cyanPrism).toBe(1);
    expect(inv.scrapIron).toBe(0);
  });

  it('removes atomically and never goes negative', () => {
    const inv = addItems(emptyInventory(), { scrapIron: 5, copperWire: 2 });
    expect(removeItems(inv, { scrapIron: 1, copperWire: 3 })).toBeNull();
    expect(inv).toMatchObject({ scrapIron: 5, copperWire: 2 });
    expect(removeItems(inv, { scrapIron: 5, copperWire: 2 })).toMatchObject({ scrapIron: 0, copperWire: 0 });
  });

  it('supports paying a bundle several times', () => {
    const inv = addItems(emptyInventory(), { scrapIron: 10 });
    expect(timesAffordable(inv, { scrapIron: 3 })).toBe(3);
    expect(hasItems(inv, { scrapIron: 3 }, 3)).toBe(true);
    expect(removeItems(inv, { scrapIron: 3 }, 4)).toBeNull();
    expect(removeItems(inv, { scrapIron: 3 }, 3)?.scrapIron).toBe(1);
  });

  it('rejects negative, fractional and invalid amounts', () => {
    const inv = emptyInventory();
    expect(() => addItems(inv, { scrapIron: -1 })).toThrow(RangeError);
    expect(() => addItems(inv, { scrapIron: 0.5 })).toThrow(RangeError);
    expect(() => removeItems(inv, { scrapIron: -2 })).toThrow(RangeError);
    expect(() => removeItems(inv, { scrapIron: 1 }, -1)).toThrow(RangeError);
  });

  it('an empty bundle is affordable zero times', () => {
    expect(timesAffordable(emptyInventory(), {})).toBe(0);
  });
});
