import { describe, it, expect } from 'vitest';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { countItems } from '../../src/core/pack';
import { carryCapacity, levelFromXp } from '../../src/core/derive';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!; // 30s, 1 roll, 10 xp
const MINE = MISSIONS.tuvale_mine!;     // 1h

describe('resolveUpTo — single completion', () => {
  it('completes a run whose duration has elapsed', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.completions[GATHER.id]).toBe(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'MissionCompleted')).toBe(true);
  });

  it('does not complete a run still in flight', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs - 1);
    expect(next.completions[GATHER.id]).toBeUndefined();
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.heroes[0]!.assignment).not.toBeNull();
  });

  it('clears the assignment on a non-repeat completion without dereferencing null', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 10);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(next.completions[GATHER.id]).toBe(1); // exactly one, not ten
  });

  it('leaves a hero with no assignment untouched', () => {
    const { state: next } = resolveUpTo(testState(), T0 + 99_999_999);
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.heroes[0]!.assignment).toBeNull();
  });
});

describe('resolveUpTo — repeat across an offline gap', () => {
  it('runs exactly the number of times that fit in a nine-hour gap', () => {
    const state = testState({
      heroes: [testHero({
        level: 100, // capacity 2775, far above nine hours of hauling
        assignment: { missionId: MINE.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const nineHours = 9 * 3_600_000;
    const { state: next } = resolveUpTo(state, T0 + nineHours);
    expect(next.completions[MINE.id]).toBe(9);
    expect(next.heroes[0]!.assignment!.blockedAt).toBeNull();
  });

  it('preserves partial progress into the next resolution', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = GATHER.durationMs * 2 + 10_000;
    const { state: next } = resolveUpTo(state, T0 + gap);
    expect(next.completions[GATHER.id]).toBe(2);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0 + GATHER.durationMs * 2);
  });

  it('resolving in two hops equals resolving in one', () => {
    const make = () => testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = GATHER.durationMs * 20;
    const oneHop = resolveUpTo(make(), T0 + gap).state;
    const first = resolveUpTo(make(), T0 + gap / 2).state;
    const twoHops = resolveUpTo(first, T0 + gap).state;
    expect(twoHops.completions).toEqual(oneHop.completions);
    expect(twoHops.heroes[0]!.pack).toEqual(oneHop.heroes[0]!.pack);
    expect(twoHops.rng.cursor).toBe(oneHop.rng.cursor);
  });
});

describe('resolveUpTo — carry capacity', () => {
  it('blocks the hero once the worst-case haul no longer fits', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs * 10_000);
    expect(next.heroes[0]!.assignment!.blockedAt).not.toBeNull();
    expect(events.some((e) => e.type === 'PackFull')).toBe(true);
  });

  it('never exceeds carry capacity', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 10_000);
    const hero = next.heroes[0]!;
    // Compare against the hero's *final* capacity: they level up during
    // the gap, so a literal starting figure would be the wrong bar.
    expect(countItems(hero.pack)).toBeLessThanOrEqual(carryCapacity(hero));
  });

  it('a hero repeating one mission does eventually fill up, proving items are counted not stacks', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    // Gather drops only 2 distinct items, so it occupies at most 2 stacks
    // forever. A stack-based cap would never bind and offline accrual
    // would be unbounded.
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 100_000);
    expect(next.heroes[0]!.pack.length).toBeLessThanOrEqual(2);
    expect(next.heroes[0]!.assignment!.blockedAt).not.toBeNull();
  });

  it('skips an already-blocked hero entirely', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 100);
    expect(next.completions[GATHER.id]).toBeUndefined();
    expect(countItems(next.heroes[0]!.pack)).toBe(400);
  });
});

describe('resolveUpTo — experience', () => {
  it('grants xp and levels up when a threshold is crossed', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs * 40);
    expect(next.heroes[0]!.xp).toBe(400);
    expect(next.heroes[0]!.level).toBe(levelFromXp(400));
    expect(events.some((e) => e.type === 'LeveledUp')).toBe(true);
  });

  it('applies a mid-gap level-up within the same resolution pass', () => {
    // A level-up raises carry capacity. Holding more than a level-1 hero
    // could ever hold proves the new level took effect during the pass,
    // not after it finished.
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const startingCapacity = carryCapacity(testHero());
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 5_000);
    expect(next.heroes[0]!.level).toBeGreaterThan(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(startingCapacity);
  });
});

describe('resolveUpTo — bookkeeping', () => {
  it('advances lastResolvedAt', () => {
    const { state: next } = resolveUpTo(testState(), T0 + 5_000);
    expect(next.lastResolvedAt).toBe(T0 + 5_000);
  });

  it('advances the rng cursor when loot was rolled', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.rng.cursor).toBeGreaterThan(0);
  });

  it('does not mutate the input state', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const snapshot = structuredClone(state);
    resolveUpTo(state, T0 + GATHER.durationMs);
    expect(state).toEqual(snapshot);
  });

  it('resolves each hero independently and concurrently', () => {
    const state = testState({
      heroes: [
        testHero({ id: 'a', assignment: {
          missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null } }),
        testHero({ id: 'b', assignment: {
          missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null } }),
        testHero({ id: 'c', assignment: null }),
      ],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.completions[GATHER.id]).toBe(2);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(countItems(next.heroes[1]!.pack)).toBeGreaterThan(0);
    expect(next.heroes[2]!.pack).toEqual([]);
  });

  it('drops an assignment referencing a mission no longer in the catalog', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: 'deleted_mission', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + 60_000);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(events.some((e) => e.type === 'AssignmentDropped')).toBe(true);
  });
});
