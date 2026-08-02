import { describe, it, expect } from 'vitest';
import {
  BACKUP_KEY, SAVE_KEY, load, sanitize, save, type Storage,
} from '../../src/core/persistence';
import { CURRENT_VERSION, HERO_COUNT, newGame } from '../../src/core/newGame';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('newGame', () => {
  it('creates the configured roster with no assignments', () => {
    const state = newGame(1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(state.heroes.every((h) => h.assignment === null)).toBe(true);
    expect(state.heroes.every((h) => h.level === 1 && h.xp === 0)).toBe(true);
  });

  it('gives every hero a distinct id', () => {
    const ids = new Set(newGame(1).heroes.map((h) => h.id));
    expect(ids.size).toBe(HERO_COUNT);
  });

  it('stamps the current version', () => {
    expect(newGame(1).version).toBe(CURRENT_VERSION);
  });
});

describe('save and load round-trip', () => {
  it('restores an equivalent state', () => {
    const storage = memoryStorage();
    const original = testState({ completions: { tuvale_gather: 3 } });
    save(storage, original);
    const { state, recovered } = load(storage, 1);
    expect(recovered).toBe(false);
    expect(state).toEqual(original);
  });

  it('reproduces identical resolution results after a reload', () => {
    const storage = memoryStorage();
    const original = testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = T0 + GATHER.durationMs * 12;

    const direct = resolveUpTo(original, gap).state;
    save(storage, original);
    const reloaded = resolveUpTo(load(storage, 1).state, gap).state;

    expect(reloaded.heroes[0]!.pack).toEqual(direct.heroes[0]!.pack);
    expect(reloaded.rng.cursor).toBe(direct.rng.cursor);
  });

  it('preserves the rng cursor so a reload does not reroll', () => {
    const storage = memoryStorage();
    save(storage, testState({ rng: { seed: 42, cursor: 137 } }));
    expect(load(storage, 1).state.rng.cursor).toBe(137);
  });
});

describe('load failure modes', () => {
  it('falls back to a fresh game when nothing is stored', () => {
    const { state, recovered } = load(memoryStorage(), 1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(recovered).toBe(false);
  });

  it('falls back to a fresh game on unparseable json and flags recovery', () => {
    const { state, recovered } = load(memoryStorage({ [SAVE_KEY]: '{not json' }), 1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(recovered).toBe(true);
  });

  it('preserves the unreadable save under the backup key rather than overwriting it', () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{not json' });
    load(storage, 1);
    expect(storage.getItem(BACKUP_KEY)).toBe('{not json');
  });

  it('refuses a save newer than the running code', () => {
    const future = JSON.stringify({ ...testState(), version: CURRENT_VERSION + 1 });
    const { state, recovered } = load(memoryStorage({ [SAVE_KEY]: future }), 1);
    expect(state.version).toBe(CURRENT_VERSION);
    expect(recovered).toBe(true);
  });

  it('rejects a structurally invalid save', () => {
    const bad = JSON.stringify({ version: CURRENT_VERSION, heroes: 'not an array' });
    expect(load(memoryStorage({ [SAVE_KEY]: bad }), 1).recovered).toBe(true);
  });

  it('recovers when a hero object is malformed rather than crashing', () => {
    const bad = JSON.stringify({ ...testState(), heroes: [{}] });
    const storage = memoryStorage({ [SAVE_KEY]: bad });
    const { state, recovered } = load(storage, 1);
    expect(recovered).toBe(true);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(storage.getItem(BACKUP_KEY)).toBe(bad);
  });

  it('recovers when a warehouse stack is malformed rather than crashing', () => {
    const bad = JSON.stringify({ ...testState(), warehouse: [null] });
    const { recovered } = load(memoryStorage({ [SAVE_KEY]: bad }), 1);
    expect(recovered).toBe(true);
  });
});

describe('sanitize', () => {
  it('drops an assignment naming a mission no longer in the catalog', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: 'deleted', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    expect(sanitize(state).heroes[0]!.assignment).toBeNull();
  });

  it('keeps the hero and the warehouse when dropping an assignment', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 9 }],
      heroes: [testHero({
        pack: [{ itemId: 'oak_log', qty: 2 }],
        assignment: { missionId: 'deleted', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const clean = sanitize(state);
    expect(clean.warehouse).toEqual([{ itemId: 'copper_ore', qty: 9 }]);
    expect(clean.heroes[0]!.pack).toEqual([{ itemId: 'oak_log', qty: 2 }]);
  });

  it('drops stacks of items no longer in the catalog', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 1 }, { itemId: 'deleted_item', qty: 4 }],
    });
    expect(sanitize(state).warehouse).toEqual([{ itemId: 'copper_ore', qty: 1 }]);
  });

  it('unequips a trinket no longer in the catalog', () => {
    const state = testState({ heroes: [testHero({ trinket: 'deleted_item' })] });
    expect(sanitize(state).heroes[0]!.trinket).toBeNull();
  });

  it('leaves stale completion keys alone, since pruning could retract an earned unlock', () => {
    const state = testState({ completions: { deleted: 3, tuvale_gather: 1 } });
    expect(sanitize(state).completions).toEqual({ deleted: 3, tuvale_gather: 1 });
  });
});
