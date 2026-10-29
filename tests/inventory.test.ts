import { describe, expect, it } from 'vitest';
import { addItems, emptyInventory, hasItems, removeItems } from '../src/core/inventory';

describe('inventory', () => {
  it('adds items without mutating the original', () => {
    const inv = emptyInventory();
    const next = addItems(inv, { scrapIron: 3, brassCog: 1 });
    expect(next).toMatchObject({ scrapIron: 3, copperWire: 0, brassCog: 1 });
    expect(inv.scrapIron).toBe(0);
  });

  it('removes items when there are enough', () => {
    const inv = addItems(emptyInventory(), { scrapIron: 5, copperWire: 2 });
    expect(removeItems(inv, { scrapIron: 5, copperWire: 1 })).toMatchObject({ scrapIron: 0, copperWire: 1 });
  });

  it('refuses a removal that would go negative, and changes nothing', () => {
    const inv = addItems(emptyInventory(), { scrapIron: 5, copperWire: 2 });
    expect(removeItems(inv, { scrapIron: 1, copperWire: 3 })).toBeNull();
    expect(inv).toMatchObject({ scrapIron: 5, copperWire: 2 });
  });

  it('rejects negative or fractional amounts', () => {
    const inv = emptyInventory();
    expect(() => addItems(inv, { scrapIron: -1 })).toThrow(RangeError);
    expect(() => addItems(inv, { scrapIron: 1.5 })).toThrow(RangeError);
    expect(() => removeItems(inv, { scrapIron: -4 })).toThrow(RangeError);
  });

  it('checks holdings', () => {
    const inv = addItems(emptyInventory(), { copperWire: 8 });
    expect(hasItems(inv, { copperWire: 8 })).toBe(true);
    expect(hasItems(inv, { copperWire: 9 })).toBe(false);
  });
});
