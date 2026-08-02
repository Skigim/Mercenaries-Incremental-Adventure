import { describe, it, expect } from 'vitest';
import { rollLoot, scaleQuantity } from '../../src/core/loot';
import { createRng } from '../../src/core/rng';
import { countItems } from '../../src/core/pack';
import { maxItemsPerRun, MISSIONS } from '../../src/core/catalog';
import type { Hero } from '../../src/core/types';

function hero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'Test', level: 1, xp: 0, skills: [],
    trinket: null, pack: [], assignment: null, ...overrides,
  };
}

describe('scaleQuantity', () => {
  it('returns the base quantity when the multiplier is exactly 1', () => {
    const rng = createRng(1, 0);
    expect(scaleQuantity(4, 1, rng)).toBe(4);
  });

  it('never floors a fractional gain away', () => {
    // 1 x 1.25 must average above 1, not truncate to 1 every time.
    const rng = createRng(7, 0);
    let total = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) total += scaleQuantity(1, 1.25, rng);
    expect(total / runs).toBeGreaterThan(1.15);
    expect(total / runs).toBeLessThan(1.35);
  });

  it('yields either floor or floor+1, never anything else', () => {
    const rng = createRng(3, 0);
    for (let i = 0; i < 500; i++) {
      const v = scaleQuantity(3, 1.5, rng);
      expect([4, 5]).toContain(v);
    }
  });

  it('consumes exactly one draw regardless of outcome', () => {
    const rng = createRng(11, 0);
    scaleQuantity(2, 1.0, rng);
    scaleQuantity(2, 1.9, rng);
    expect(rng.cursor).toBe(2);
  });
});

describe('rollLoot', () => {
  it('is deterministic for a given seed and cursor', () => {
    const mission = MISSIONS.tuvale_thicket!;
    const a = rollLoot(mission, hero(), createRng(42, 0));
    const b = rollLoot(mission, hero(), createRng(42, 0));
    expect(a).toEqual(b);
  });

  it('consumes exactly three draws per roll', () => {
    const mission = MISSIONS.tuvale_thicket!; // rollsPerRun: 3
    const rng = createRng(42, 0);
    rollLoot(mission, hero(), rng);
    expect(rng.cursor).toBe(3 * 3);
  });

  it('never exceeds maxItemsPerRun, across many seeds', () => {
    const mission = MISSIONS.tuvale_mine!;
    const h = hero({ level: 12 });
    const ceiling = maxItemsPerRun(mission, h);
    for (let seed = 0; seed < 300; seed++) {
      const loot = rollLoot(mission, h, createRng(seed, 0));
      expect(countItems(loot)).toBeLessThanOrEqual(ceiling);
    }
  });

  it('only produces items from the mission loot table', () => {
    const mission = MISSIONS.tuvale_mine!;
    const allowed = new Set(mission.lootTable.map((e) => e.itemId));
    for (let seed = 0; seed < 100; seed++) {
      for (const stack of rollLoot(mission, hero(), createRng(seed, 0))) {
        expect(allowed.has(stack.itemId)).toBe(true);
      }
    }
  });

  it('returns merged stacks rather than duplicate entries', () => {
    const mission = MISSIONS.yarsol_ruins!; // 20 rolls, 4 entries — collisions certain
    const loot = rollLoot(mission, hero(), createRng(5, 0));
    const ids = loot.map((s) => s.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects weighting: a heavily weighted item appears far more often', () => {
    const mission = MISSIONS.tuvale_thicket!; // oak_log 50 vs copper_band 1
    const counts = new Map<string, number>();
    const rng = createRng(1, 0);
    for (let i = 0; i < 400; i++) {
      for (const stack of rollLoot(mission, hero(), rng)) {
        counts.set(stack.itemId, (counts.get(stack.itemId) ?? 0) + 1);
      }
    }
    expect(counts.get('oak_log') ?? 0).toBeGreaterThan(counts.get('copper_band') ?? 0);
  });

  it('grants more on average to a higher level hero', () => {
    const mission = MISSIONS.tuvale_mine!;
    const total = (h: Hero) => {
      const rng = createRng(9, 0);
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += countItems(rollLoot(mission, h, rng));
      return sum;
    };
    expect(total(hero({ level: 20 }))).toBeGreaterThan(total(hero({ level: 1 })));
  });
});
