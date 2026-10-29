import { RESOURCE_IDS, type ResourceId } from './data';

export type Inventory = Record<ResourceId, number>;
export type ItemBundle = Partial<Record<ResourceId, number>>;

export function emptyInventory(): Inventory {
  const inv = {} as Inventory;
  for (const id of RESOURCE_IDS) inv[id] = 0;
  return inv;
}

function assertValidAmount(id: ResourceId, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid amount for ${id}: ${amount}`);
  }
}

/** Returns a new inventory with the bundle added. Amounts must be non-negative integers. */
export function addItems(inv: Inventory, bundle: ItemBundle): Inventory {
  const next = { ...inv };
  for (const id of RESOURCE_IDS) {
    const amount = bundle[id] ?? 0;
    assertValidAmount(id, amount);
    next[id] += amount;
  }
  return next;
}

export function hasItems(inv: Inventory, bundle: ItemBundle): boolean {
  return RESOURCE_IDS.every((id) => inv[id] >= (bundle[id] ?? 0));
}

/**
 * Atomically removes the bundle. Returns null — and changes nothing — if any
 * resource is short, so the inventory can never go negative.
 */
export function removeItems(inv: Inventory, bundle: ItemBundle): Inventory | null {
  for (const id of RESOURCE_IDS) assertValidAmount(id, bundle[id] ?? 0);
  if (!hasItems(inv, bundle)) return null;
  const next = { ...inv };
  for (const id of RESOURCE_IDS) next[id] -= bundle[id] ?? 0;
  return next;
}
