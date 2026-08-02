import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';

describe('createRng', () => {
  it('is positional: the same seed and cursor always give the same number', () => {
    const a = createRng(1234, 7);
    const b = createRng(1234, 7);
    expect(a.next()).toBe(b.next());
  });

  it('advances its cursor by one per draw', () => {
    const rng = createRng(1, 0);
    rng.next();
    rng.next();
    rng.next();
    expect(rng.cursor).toBe(3);
  });

  it('resumes exactly where a previous instance stopped', () => {
    const first = createRng(99, 0);
    first.next();
    first.next();
    const resumed = createRng(99, first.cursor);

    const uninterrupted = createRng(99, 0);
    uninterrupted.next();
    uninterrupted.next();

    expect(resumed.next()).toBe(uninterrupted.next());
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(5, 0);
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different values at different cursors', () => {
    const rng = createRng(42, 0);
    const values = new Set(Array.from({ length: 100 }, () => rng.next()));
    expect(values.size).toBeGreaterThan(90);
  });
});
