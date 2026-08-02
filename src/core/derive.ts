import { getItem } from './catalog';
import { countItems } from './pack';
import type { Hero } from './types';

const XP_STEP = 100;
// Base capacity must exceed every mission's level-1 worst case, or that
// mission can never start — the capacity gate would block it forever.
// The catalog test enforces this.
const BASE_CAPACITY = 300;
const CAPACITY_PER_LEVEL = 25;
const YIELD_PER_LEVEL = 0.05;

/** Triangular curve: 0, 100, 300, 600, 1000 … */
export function xpToReach(level: number): number {
  return (XP_STEP * (level - 1) * level) / 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  return level;
}

/**
 * Capacity is the offline cap. Raising it with level is the real reward
 * for levelling in a game built around absence: a stronger hero stays
 * productive unattended for longer.
 */
export function carryCapacity(hero: Hero): number {
  return BASE_CAPACITY + (hero.level - 1) * CAPACITY_PER_LEVEL;
}

export function capacityRemaining(hero: Hero): number {
  return Math.max(0, carryCapacity(hero) - countItems(hero.pack));
}

export function yieldMultiplier(hero: Hero): number {
  const bonus = hero.trinket ? (getItem(hero.trinket)?.yieldBonus ?? 0) : 0;
  return 1 + (hero.level - 1) * YIELD_PER_LEVEL + bonus;
}
