import { describe, it, expect } from 'vitest';
import { formatDuration, missionProgress } from '../../src/ui/format';

describe('formatDuration', () => {
  it('renders seconds', () => expect(formatDuration(30_000)).toBe('30s'));
  it('renders minutes and seconds', () => expect(formatDuration(305_000)).toBe('5m 5s'));
  it('renders hours and minutes', () => expect(formatDuration(3_900_000)).toBe('1h 5m'));
  it('renders long spans', () => expect(formatDuration(28_800_000)).toBe('8h 0m'));
  it('clamps negatives to zero', () => expect(formatDuration(-5)).toBe('0s'));
});

describe('missionProgress', () => {
  it('is 0 at the start', () => expect(missionProgress(100, 50, 100)).toBe(0));
  it('is 0.5 halfway', () => expect(missionProgress(100, 50, 125)).toBe(0.5));
  it('clamps to 1 past the end', () => expect(missionProgress(100, 50, 999)).toBe(1));
  it('clamps to 0 before the start', () => expect(missionProgress(100, 50, 0)).toBe(0));
  it('is 1 for a zero duration rather than dividing by zero', () => {
    expect(missionProgress(100, 0, 100)).toBe(1);
  });
});
