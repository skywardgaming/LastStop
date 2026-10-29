import { ITEM_IDS } from './content/items';
import type { ItemBundle } from './content/world';
import type { Inventory } from './state';

function assertValidAmount(id: string, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid amount for ${id}: ${amount}`);
  }
}

/** Returns a new inventory with the bundle added. Amounts must be non-negative integers. */
export function addItems(inv: Inventory, bundle: ItemBundle): Inventory {
  const next = { ...inv };
  for (const id of ITEM_IDS) {
    const amount = bundle[id] ?? 0;
    assertValidAmount(id, amount);
    next[id] += amount;
  }
  return next;
}

export function hasItems(inv: Inventory, bundle: ItemBundle, times = 1): boolean {
  return ITEM_IDS.every((id) => inv[id] >= (bundle[id] ?? 0) * times);
}

/** How many times the bundle could be paid from this inventory. */
export function timesAffordable(inv: Inventory, bundle: ItemBundle): number {
  let n = Infinity;
  for (const id of ITEM_IDS) {
    const need = bundle[id] ?? 0;
    if (need > 0) n = Math.min(n, Math.floor(inv[id] / need));
  }
  return n === Infinity ? 0 : n;
}

/**
 * Atomically removes the bundle (optionally several times). Returns null and
 * changes nothing if anything is short, so inventory can never go negative.
 */
export function removeItems(inv: Inventory, bundle: ItemBundle, times = 1): Inventory | null {
  for (const id of ITEM_IDS) assertValidAmount(id, bundle[id] ?? 0);
  if (!Number.isInteger(times) || times < 0) throw new RangeError(`Invalid times: ${times}`);
  if (!hasItems(inv, bundle, times)) return null;
  const next = { ...inv };
  for (const id of ITEM_IDS) next[id] -= (bundle[id] ?? 0) * times;
  return next;
}
