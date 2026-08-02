import { describe, it, expect } from 'vitest';
import { addItems, countItems, takeItem } from '../../src/core/pack';

describe('pack arithmetic', () => {
  it('counts total items, not stacks', () => {
    expect(countItems([
      { itemId: 'copper_ore', qty: 40 },
      { itemId: 'wolf_pelt', qty: 3 },
    ])).toBe(43);
  });

  it('counts an empty pack as zero', () => {
    expect(countItems([])).toBe(0);
  });

  it('merges additions into an existing stack', () => {
    const result = addItems(
      [{ itemId: 'copper_ore', qty: 5 }],
      [{ itemId: 'copper_ore', qty: 3 }],
    );
    expect(result).toEqual([{ itemId: 'copper_ore', qty: 8 }]);
  });

  it('appends a new stack for an unseen item', () => {
    const result = addItems(
      [{ itemId: 'copper_ore', qty: 5 }],
      [{ itemId: 'oak_log', qty: 2 }],
    );
    expect(result).toEqual([
      { itemId: 'copper_ore', qty: 5 },
      { itemId: 'oak_log', qty: 2 },
    ]);
  });

  it('does not mutate its inputs', () => {
    const original = [{ itemId: 'copper_ore', qty: 5 }];
    addItems(original, [{ itemId: 'copper_ore', qty: 5 }]);
    expect(original).toEqual([{ itemId: 'copper_ore', qty: 5 }]);
  });

  it('takes a quantity and drops emptied stacks', () => {
    const result = takeItem([{ itemId: 'jade_charm', qty: 1 }], 'jade_charm', 1);
    expect(result).toEqual([]);
  });

  it('takes a partial quantity and keeps the remainder', () => {
    const result = takeItem([{ itemId: 'copper_ore', qty: 5 }], 'copper_ore', 2);
    expect(result).toEqual([{ itemId: 'copper_ore', qty: 3 }]);
  });

  it('returns null when there is not enough to take', () => {
    expect(takeItem([{ itemId: 'copper_ore', qty: 1 }], 'copper_ore', 2)).toBeNull();
    expect(takeItem([], 'copper_ore', 1)).toBeNull();
  });
});
