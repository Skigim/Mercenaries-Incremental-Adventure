import { addItems } from './pack';
import { yieldMultiplier } from './derive';
import type { Rng } from './rng';
import type { Hero, ItemStack, MissionDef, WeightedEntry } from './types';

/**
 * Probabilistic rounding. floor() alone would discard every fractional
 * gain, making the first several levels feel inert: 1 x 1.25 would stay 1
 * forever. Consumes exactly one draw whatever the outcome.
 */
export function scaleQuantity(base: number, multiplier: number, rng: Rng): number {
  const exact = base * multiplier;
  const whole = Math.floor(exact);
  const remainder = exact - whole;
  return rng.next() < remainder ? whole + 1 : whole;
}

function pickEntry(table: WeightedEntry[], roll: number): WeightedEntry {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let target = roll * total;
  let last: WeightedEntry | undefined;
  for (const entry of table) {
    last = entry;
    target -= entry.weight;
    if (target < 0) return entry;
  }
  // Only reachable through floating-point drift at the very top of the
  // range. The catalog test guarantees no table is empty.
  if (!last) throw new Error('loot table is empty');
  return last;
}

/**
 * Exactly three draws per roll, always in this order: entry, quantity,
 * rounding. A varying draw count would desynchronise a replay resumed
 * from a saved cursor.
 */
export function rollLoot(mission: MissionDef, hero: Hero, rng: Rng): ItemStack[] {
  const multiplier = yieldMultiplier(hero);
  let loot: ItemStack[] = [];

  for (let i = 0; i < mission.rollsPerRun; i++) {
    const entry = pickEntry(mission.lootTable, rng.next());
    const span = entry.maxQty - entry.minQty + 1;
    const base = entry.minQty + Math.floor(rng.next() * span);
    const qty = scaleQuantity(base, multiplier, rng);
    if (qty > 0) loot = addItems(loot, [{ itemId: entry.itemId, qty }]);
  }

  return loot;
}
