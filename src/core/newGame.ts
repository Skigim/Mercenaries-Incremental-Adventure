import type { GameState, Hero } from './types';

export const CURRENT_VERSION = 1;

/**
 * A placeholder, not a decision. The right roster size is a feel question
 * that cannot be answered before the loop is playable.
 */
export const HERO_COUNT = 3;

const NAMES = ['Bryn', 'Corvin', 'Maela', 'Toller', 'Isolde'];

function makeHero(index: number): Hero {
  return {
    id: `hero_${index + 1}`,
    name: NAMES[index] ?? `Hero ${index + 1}`,
    level: 1,
    xp: 0,
    skills: [],
    trinket: null,
    pack: [],
    assignment: null,
  };
}

export function newGame(seed: number, startedAt = 0): GameState {
  return {
    version: CURRENT_VERSION,
    heroes: Array.from({ length: HERO_COUNT }, (_, i) => makeHero(i)),
    warehouse: [],
    completions: {},
    rng: { seed, cursor: 0 },
    lastResolvedAt: startedAt,
  };
}
