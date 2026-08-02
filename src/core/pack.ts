import type { ItemId, ItemStack } from './types';

/**
 * Total items, not stacks. Counting stacks would defeat the carry cap:
 * a hero repeating one mission draws from the same small table forever
 * and would occupy the same few stacks indefinitely.
 */
export function countItems(stacks: ItemStack[]): number {
  return stacks.reduce((sum, s) => sum + s.qty, 0);
}

export function addItems(stacks: ItemStack[], additions: ItemStack[]): ItemStack[] {
  const result = stacks.map((s) => ({ ...s }));
  for (const addition of additions) {
    if (addition.qty <= 0) continue;
    const existing = result.find((s) => s.itemId === addition.itemId);
    if (existing) existing.qty += addition.qty;
    else result.push({ ...addition });
  }
  return result;
}

/** Returns null — never a partial take — if the quantity is not available. */
export function takeItem(
  stacks: ItemStack[],
  itemId: ItemId,
  qty: number,
): ItemStack[] | null {
  const existing = stacks.find((s) => s.itemId === itemId);
  if (!existing || existing.qty < qty) return null;
  return stacks
    .map((s) => (s.itemId === itemId ? { ...s, qty: s.qty - qty } : { ...s }))
    .filter((s) => s.qty > 0);
}
