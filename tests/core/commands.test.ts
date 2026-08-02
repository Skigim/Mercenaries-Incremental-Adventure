import { describe, it, expect } from 'vitest';
import { applyCommand } from '../../src/core/commands';
import { MISSIONS } from '../../src/core/catalog';
import { countItems } from '../../src/core/pack';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('dispatch', () => {
  it('assigns an unlocked mission starting now', () => {
    const { state } = applyCommand(
      testState(),
      { type: 'dispatch', heroId: 'h1', missionId: GATHER.id, repeat: true },
      T0,
    );
    expect(state.heroes[0]!.assignment).toEqual({
      missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null,
    });
  });

  it('refuses a locked mission', () => {
    const { state } = applyCommand(
      testState(),
      { type: 'dispatch', heroId: 'h1', missionId: 'tuvale_thicket', repeat: false },
      T0,
    );
    expect(state.heroes[0]!.assignment).toBeNull();
  });

  it('refuses an unknown hero without throwing', () => {
    expect(() =>
      applyCommand(
        testState(),
        { type: 'dispatch', heroId: 'ghost', missionId: GATHER.id, repeat: false },
        T0,
      ),
    ).not.toThrow();
  });

  it('resolves outstanding time before assigning', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(
      state,
      { type: 'dispatch', heroId: 'h1', missionId: GATHER.id, repeat: true },
      T0 + GATHER.durationMs,
    );
    // The finished run banked its loot before the new dispatch replaced it.
    expect(next.completions[GATHER.id]).toBe(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
  });
});

describe('recall', () => {
  it('keeps completed runs and discards only the partial one', () => {
    const state = testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(
      state,
      { type: 'recall', heroId: 'h1' },
      T0 + GATHER.durationMs * 3 + 5_000,
    );
    expect(next.completions[GATHER.id]).toBe(3);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(next.heroes[0]!.assignment).toBeNull();
  });
});

describe('collect', () => {
  it('moves the pack into the warehouse', () => {
    const state = testState({
      heroes: [testHero({ pack: [{ itemId: 'copper_ore', qty: 7 }] })],
    });
    const { state: next, events } = applyCommand(state, { type: 'collect', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 7 }]);
    expect(events.some((e) => e.type === 'Collected')).toBe(true);
  });

  it('merges into an existing warehouse stack', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 3 }],
      heroes: [testHero({ pack: [{ itemId: 'copper_ore', qty: 7 }] })],
    });
    const { state: next } = applyCommand(state, { type: 'collect', heroId: 'h1' }, T0);
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 10 }]);
  });

  it('unblocks a blocked hero and restarts the run from now', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const sixHoursLater = T0 + 6 * 3_600_000;
    const { state: next } = applyCommand(state, { type: 'collect', heroId: 'h1' }, sixHoursLater);
    expect(next.heroes[0]!.assignment!.blockedAt).toBeNull();
    expect(next.heroes[0]!.assignment!.startedAt).toBe(sixHoursLater);
    // Idle hours are not retroactively converted into completions.
    expect(next.completions[GATHER.id]).toBeUndefined();
  });

  it('leaves an in-flight run untouched when collecting from an unblocked hero', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 7 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const midRun = T0 + 10_000; // partway through the 30s run
    const { state: next } = applyCommand(state, { type: 'collect', heroId: 'h1' }, midRun);
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 7 }]);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0);
    expect(next.heroes[0]!.assignment!.blockedAt).toBeNull();
  });
});

describe('collectAll', () => {
  it('empties every hero pack in one operation', () => {
    const state = testState({
      heroes: [
        testHero({ id: 'a', pack: [{ itemId: 'copper_ore', qty: 2 }] }),
        testHero({ id: 'b', pack: [{ itemId: 'oak_log', qty: 4 }] }),
        testHero({ id: 'c', pack: [] }),
      ],
    });
    const { state: next } = applyCommand(state, { type: 'collectAll' }, T0);
    expect(next.heroes.every((h) => h.pack.length === 0)).toBe(true);
    expect(countItems(next.warehouse)).toBe(6);
  });
});

describe('toggleRepeat', () => {
  it('flips the flag on an active assignment', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(state, { type: 'toggleRepeat', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.assignment!.repeat).toBe(false);
  });

  it('clears the assignment when switched off on a blocked hero, preserving the pack', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const { state: next } = applyCommand(state, { type: 'toggleRepeat', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(countItems(next.heroes[0]!.pack)).toBe(400);
  });
});

describe('equip / unequip', () => {
  it('moves a trinket out of the warehouse onto the hero', () => {
    const state = testState({ warehouse: [{ itemId: 'jade_charm', qty: 1 }] });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBe('jade_charm');
    expect(next.warehouse).toEqual([]);
  });

  it('returns a displaced trinket to the warehouse in the same operation', () => {
    const state = testState({
      warehouse: [{ itemId: 'jade_charm', qty: 1 }],
      heroes: [testHero({ trinket: 'copper_band' })],
    });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBe('jade_charm');
    expect(next.warehouse).toEqual([{ itemId: 'copper_band', qty: 1 }]);
  });

  it('refuses to equip an item absent from the warehouse', () => {
    const { state } = applyCommand(
      testState(), { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(state.heroes[0]!.trinket).toBeNull();
  });

  it('refuses to equip a material', () => {
    const state = testState({ warehouse: [{ itemId: 'copper_ore', qty: 5 }] });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'copper_ore' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBeNull();
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 5 }]);
  });

  it('cannot equip from a pack — the item must be collected first', () => {
    const state = testState({
      heroes: [testHero({ pack: [{ itemId: 'jade_charm', qty: 1 }] })],
    });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBeNull();
  });

  it('returns the trinket to the warehouse on unequip', () => {
    const state = testState({ heroes: [testHero({ trinket: 'jade_charm' })] });
    const { state: next } = applyCommand(state, { type: 'unequip', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.trinket).toBeNull();
    expect(next.warehouse).toEqual([{ itemId: 'jade_charm', qty: 1 }]);
  });

  it('never applies retroactively to loot already resolved from a gap', () => {
    const state = testState({
      warehouse: [{ itemId: 'gilded_signet', qty: 1 }],
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = T0 + GATHER.durationMs * 5;

    const resolvedFirst = applyCommand(state, { type: 'unequip', heroId: 'h1' }, gap).state;
    const equippedAfter = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'gilded_signet' }, gap,
    ).state;

    // Both resolve the same gap before the command lands, so the loot from
    // that gap is identical; only future runs differ.
    expect(equippedAfter.heroes[0]!.pack).toEqual(resolvedFirst.heroes[0]!.pack);
  });
});
