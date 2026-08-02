import { getItem, getMission } from './catalog';
import { CURRENT_VERSION, newGame } from './newGame';
import type { GameState } from './types';

export const SAVE_KEY = 'merchantnext.save.v1';
export const BACKUP_KEY = 'merchantnext.save.backup';

/** Injected rather than reaching for the global, so core stays pure. */
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function save(storage: Storage, state: GameState): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

function looksLikeGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.version === 'number' &&
    Array.isArray(s.heroes) &&
    Array.isArray(s.warehouse) &&
    typeof s.completions === 'object' && s.completions !== null &&
    typeof s.rng === 'object' && s.rng !== null &&
    typeof s.rng.seed === 'number' && typeof s.rng.cursor === 'number' &&
    typeof s.lastResolvedAt === 'number'
  );
}

/**
 * Removes references to catalog entries that no longer exist. Completion
 * counts are deliberately left alone: they are inert, and pruning them
 * could retract an unlock the player already earned.
 */
export function sanitize(state: GameState): GameState {
  const s = structuredClone(state);

  s.warehouse = s.warehouse.filter((stack) => getItem(stack.itemId) !== undefined);

  for (const hero of s.heroes) {
    hero.pack = hero.pack.filter((stack) => getItem(stack.itemId) !== undefined);
    if (hero.trinket && !getItem(hero.trinket)) hero.trinket = null;
    if (hero.assignment && !getMission(hero.assignment.missionId)) hero.assignment = null;
  }

  return s;
}

export function load(
  storage: Storage,
  seed: number,
): { state: GameState; recovered: boolean } {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { state: newGame(seed), recovered: false };

  const quarantine = (): { state: GameState; recovered: boolean } => {
    storage.setItem(BACKUP_KEY, raw);
    return { state: newGame(seed), recovered: true };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return quarantine();
  }

  if (!looksLikeGameState(parsed)) return quarantine();
  // A save from a newer build may contain fields this code cannot honour.
  if (parsed.version > CURRENT_VERSION) return quarantine();
  // Migration chain for older versions goes here as versions accrue.

  return { state: sanitize(parsed), recovered: false };
}
