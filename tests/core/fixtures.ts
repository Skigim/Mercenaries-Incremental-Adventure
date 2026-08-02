import { xpToReach } from '../../src/core/derive';
import type { GameState, Hero } from '../../src/core/types';

export const T0 = 1_700_000_000_000;

/**
 * Passing `level` alone also sets a consistent `xp`. Resolution recomputes
 * level from xp, so a hero built with level 30 and xp 0 would silently
 * collapse to level 1 on the first completion.
 */
export function testHero(overrides: Partial<Hero> = {}): Hero {
  const level = overrides.level ?? 1;
  return {
    id: 'h1', name: 'Bryn', level, xp: xpToReach(level), skills: [],
    trinket: null, pack: [], assignment: null, ...overrides,
  };
}

export function testState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    heroes: [testHero()],
    warehouse: [],
    completions: {},
    rng: { seed: 42, cursor: 0 },
    lastResolvedAt: T0,
    ...overrides,
  };
}
