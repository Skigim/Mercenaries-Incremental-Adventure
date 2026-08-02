import { describe, it, expect } from 'vitest';
import { availableMissions, isUnlocked } from '../../src/core/unlocks';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('isUnlocked', () => {
  it('unlocks a mission that requires nothing', () => {
    expect(isUnlocked('tuvale_gather', {})).toBe(true);
  });

  it('locks a mission whose prerequisite is uncompleted', () => {
    expect(isUnlocked('tuvale_thicket', {})).toBe(false);
  });

  it('unlocks once the prerequisite has one completion', () => {
    expect(isUnlocked('tuvale_thicket', { tuvale_gather: 1 })).toBe(true);
  });

  it('treats a zero count as uncompleted', () => {
    expect(isUnlocked('tuvale_thicket', { tuvale_gather: 0 })).toBe(false);
  });

  it('returns false for an unknown mission id', () => {
    expect(isUnlocked('nonexistent', {})).toBe(false);
  });
});

describe('availableMissions', () => {
  it('starts with only the no-prerequisite missions', () => {
    const ids = availableMissions(testState()).map((m) => m.id);
    expect(ids).toEqual(['tuvale_gather']);
  });

  it('grows as completions accumulate', () => {
    const state = testState({ completions: { tuvale_gather: 1 } });
    const ids = availableMissions(state).map((m) => m.id);
    expect(ids).toContain('tuvale_thicket');
  });

  it('ignores stale completion keys for missions no longer in the catalog', () => {
    const state = testState({ completions: { deleted_mission: 5 } });
    expect(() => availableMissions(state)).not.toThrow();
    expect(availableMissions(state).map((m) => m.id)).toEqual(['tuvale_gather']);
  });

  it('a completion during resolution unlocks the next mission', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    expect(availableMissions(state).map((m) => m.id)).not.toContain('tuvale_thicket');
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(availableMissions(next).map((m) => m.id)).toContain('tuvale_thicket');
  });
});
