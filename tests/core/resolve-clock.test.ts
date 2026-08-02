import { describe, it, expect } from 'vitest';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('resolveUpTo — clock moved backwards', () => {
  it('grants nothing when now precedes lastResolvedAt', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0 - 60_000, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 - 100_000);
    expect(next.completions).toEqual({});
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(events.some((e) => e.type === 'ClockRewound')).toBe(true);
  });

  it('rewinds lastResolvedAt to the corrected time', () => {
    const { state: next } = resolveUpTo(testState(), T0 - 100_000);
    expect(next.lastResolvedAt).toBe(T0 - 100_000);
  });

  it('clamps a future startedAt so the hero is not frozen until real time catches up', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0);
  });

  it('clamps a future blockedAt as well', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: farFuture },
      })],
    });
    const { state: next } = resolveUpTo(state, T0);
    expect(next.heroes[0]!.assignment!.blockedAt).toBe(T0);
  });

  it('leaves a past startedAt alone', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0 - 500_000, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 - 100_000);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0 - 500_000);
  });

  it('a clamped hero resumes on the next forward resolution instead of stalling', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: null },
      })],
    });
    const corrected = resolveUpTo(state, T0).state;
    const { state: next } = resolveUpTo(corrected, T0 + GATHER.durationMs * 3);
    expect(next.completions[GATHER.id]).toBe(3);
  });

  it('does not advance the rng cursor on a rewind', () => {
    const state = testState({ rng: { seed: 42, cursor: 17 } });
    const { state: next } = resolveUpTo(state, T0 - 1);
    expect(next.rng.cursor).toBe(17);
  });
});
