export interface Clock {
  now(): number;
}

/** The only place in the app allowed to read wall-clock time. */
export const systemClock: Clock = { now: () => Date.now() };

export function fixedClock(t: number): Clock & { set(next: number): void } {
  let current = t;
  return {
    now: () => current,
    set(next: number) {
      current = next;
    },
  };
}
