import { describe, it, expect } from 'vitest';
import {
  capacityRemaining,
  carryCapacity,
  levelFromXp,
  xpToReach,
  yieldMultiplier,
} from '../../src/core/derive';
import { maxItemsPerRun, MISSIONS } from '../../src/core/catalog';
import type { Hero } from '../../src/core/types';

function hero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    level: 1,
    xp: 0,
    skills: [],
    trinket: null,
    pack: [],
    assignment: null,
    ...overrides,
  };
}

describe('level curve', () => {
  it('starts level 1 at zero xp', () => {
    expect(xpToReach(1)).toBe(0);
    expect(levelFromXp(0)).toBe(1);
  });

  it('is strictly increasing', () => {
    for (let l = 1; l < 40; l++) {
      expect(xpToReach(l + 1)).toBeGreaterThan(xpToReach(l));
    }
  });

  it('round-trips: xp exactly at a threshold yields that level', () => {
    for (let l = 1; l <= 30; l++) {
      expect(levelFromXp(xpToReach(l))).toBe(l);
    }
  });

  it('one xp short of a threshold stays at the lower level', () => {
    expect(levelFromXp(xpToReach(5) - 1)).toBe(4);
  });
});

describe('carryCapacity', () => {
  it('grows with level', () => {
    expect(carryCapacity(hero({ level: 2 }))).toBeGreaterThan(
      carryCapacity(hero({ level: 1 })),
    );
  });

  it('is positive at level 1', () => {
    expect(carryCapacity(hero())).toBeGreaterThan(0);
  });
});

describe('capacityRemaining', () => {
  it('subtracts items held, counting quantity not stacks', () => {
    const h = hero({ pack: [{ itemId: 'copper_ore', qty: 10 }] });
    expect(capacityRemaining(h)).toBe(carryCapacity(h) - 10);
  });

  it('never reports negative room', () => {
    const h = hero({ pack: [{ itemId: 'copper_ore', qty: 99_999 }] });
    expect(capacityRemaining(h)).toBe(0);
  });
});

describe('yieldMultiplier', () => {
  it('is 1 for a level 1 hero with no trinket', () => {
    expect(yieldMultiplier(hero())).toBe(1);
  });

  it('increases with level', () => {
    expect(yieldMultiplier(hero({ level: 10 }))).toBeGreaterThan(1);
  });

  it('adds the equipped trinket bonus', () => {
    const bare = yieldMultiplier(hero({ level: 3 }));
    const adorned = yieldMultiplier(hero({ level: 3, trinket: 'jade_charm' }));
    expect(adorned).toBeCloseTo(bare + 0.1, 10);
  });

  it('ignores an unknown trinket id rather than throwing', () => {
    expect(yieldMultiplier(hero({ trinket: 'nonexistent' }))).toBe(1);
  });
});

describe('maxItemsPerRun', () => {
  it('covers the largest possible haul including the rounding bonus', () => {
    const mission = MISSIONS.tuvale_thicket!;
    // 3 rolls, largest maxQty is 5, level 1 multiplier is 1.
    expect(maxItemsPerRun(mission, hero())).toBe(3 * (5 + 1));
  });

  it('grows with the hero yield multiplier', () => {
    const mission = MISSIONS.tuvale_thicket!;
    expect(maxItemsPerRun(mission, hero({ level: 20 }))).toBeGreaterThan(
      maxItemsPerRun(mission, hero({ level: 1 })),
    );
  });

  it('every mission is runnable by a level 1 hero', () => {
    // If a mission's worst case exceeds starting capacity, the capacity
    // gate blocks it on every attempt and the content is unreachable.
    const fresh = hero();
    for (const mission of Object.values(MISSIONS)) {
      expect(
        maxItemsPerRun(mission, fresh),
        `${mission.id} can never start: worst case exceeds level 1 capacity`,
      ).toBeLessThanOrEqual(carryCapacity(fresh));
    }
  });
});
