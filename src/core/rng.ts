export interface Rng {
  next(): number;
  readonly cursor: number;
}

/**
 * Positional hash: a pure function of (seed, cursor). Because it derives
 * rather than accumulates, a saved cursor resumes the exact sequence —
 * which is what stops a reload from rerolling already-resolved loot.
 */
function hash(seed: number, cursor: number): number {
  let t = (seed + cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRng(seed: number, cursor: number): Rng {
  let c = cursor;
  return {
    next(): number {
      return hash(seed, c++);
    },
    get cursor(): number {
      return c;
    },
  };
}
