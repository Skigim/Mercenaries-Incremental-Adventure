import { getMission, maxItemsPerRun } from './catalog';
import { capacityRemaining, levelFromXp } from './derive';
import { rollLoot } from './loot';
import { addItems } from './pack';
import { createRng } from './rng';
import type { Assignment, GameEvent, GameState, Hero, MissionDef } from './types';

/** One hero's in-flight run, carried through the chronological loop. */
interface PendingRun {
  hero: Hero;
  assignment: Assignment;
  mission: MissionDef;
  /** Start time of this hero's next run; advances to each completedAt. */
  cursor: number;
  /** False once the hero can produce no further completions before `now`. */
  active: boolean;
}

/**
 * Replays everything that finished between state.lastResolvedAt and `now`.
 * Nothing ticks: eight hours closed and eight hours open are the same
 * arithmetic, so there is no second code path for offline progress.
 */
export function resolveUpTo(
  state: GameState,
  now: number,
): { state: GameState; events: GameEvent[] } {
  const s = structuredClone(state);
  const events: GameEvent[] = [];

  // A backwards clock (NTP correction, or the user changing system time)
  // must grant nothing. Clamping lastResolvedAt alone is not enough: a
  // hero dispatched while the clock was set ahead carries a future
  // startedAt, and would sit inert until real time caught up — potentially
  // for months. Clamp the assignments too, so the run restarts from the
  // corrected present rather than granting time that never passed.
  if (now < s.lastResolvedAt) {
    for (const hero of s.heroes) {
      const assignment = hero.assignment;
      if (!assignment) continue;
      assignment.startedAt = Math.min(assignment.startedAt, now);
      if (assignment.blockedAt !== null) {
        assignment.blockedAt = Math.min(assignment.blockedAt, now);
      }
    }
    s.lastResolvedAt = now;
    events.push({ type: 'ClockRewound', to: now });
    return { state: s, events };
  }

  const rng = createRng(s.rng.seed, s.rng.cursor);

  // Pre-pass: settle everything that costs no draws, so the draw-consuming
  // loop below sees a stable pool. Blocked heroes are skipped entirely,
  // exactly as before — a blocked hero is inert whatever its mission id.
  const runs: PendingRun[] = [];
  for (const hero of s.heroes) {
    const assignment = hero.assignment;
    if (!assignment || assignment.blockedAt !== null) continue;

    const mission = getMission(assignment.missionId);
    if (!mission) {
      hero.assignment = null;
      events.push({ type: 'AssignmentDropped', heroId: hero.id, reason: 'unknown-mission' });
      continue;
    }

    runs.push({ hero, assignment, mission, cursor: assignment.startedAt, active: true });
  }

  // Completions are processed in global chronological order — earliest
  // completedAt first, hero order breaking ties — rather than one hero to
  // exhaustion then the next. Both orders grant the same totals, but only
  // this one makes the cursor→(hero, completion) mapping independent of
  // where resolution boundaries fall: the set of completions at or before
  // any boundary is a prefix of the chronological sequence, so resolving a
  // gap in one hop and resolving it in two deal identical draws to
  // identical heroes. That is what keeps "a reload never rerolls" true
  // with more than one hero on the board.
  for (;;) {
    let next: PendingRun | undefined;
    let nextAt = Infinity;
    for (const run of runs) {
      if (!run.active) continue;
      const completedAt = run.cursor + run.mission.durationMs;
      if (completedAt > now) {
        // A cursor only moves forward, so this hero is done for this pass.
        run.active = false;
        continue;
      }
      if (completedAt < nextAt) {
        nextAt = completedAt;
        next = run;
      }
    }
    if (!next) break;

    const { hero, assignment, mission } = next;

    // Capacity depends only on this hero's own pack and level, so the gate
    // is evaluated when its run comes due rather than up front.
    if (capacityRemaining(hero) < maxItemsPerRun(mission, hero)) {
      assignment.blockedAt = next.cursor;
      events.push({ type: 'PackFull', heroId: hero.id, at: next.cursor });
      next.active = false;
      continue;
    }

    const completedAt = nextAt;
    const loot = rollLoot(mission, hero, rng);
    hero.pack = addItems(hero.pack, loot);
    events.push({ type: 'LootGained', heroId: hero.id, at: completedAt, items: loot });

    const previousLevel = hero.level;
    hero.xp += mission.xpReward;
    hero.level = levelFromXp(hero.xp);
    if (hero.level > previousLevel) {
      events.push({ type: 'LeveledUp', heroId: hero.id, level: hero.level });
    }

    s.completions[mission.id] = (s.completions[mission.id] ?? 0) + 1;
    events.push({
      type: 'MissionCompleted',
      heroId: hero.id,
      missionId: mission.id,
      at: completedAt,
    });

    // Advance before the non-repeat retirement so the completed run's end
    // time is never misattributed to the next one.
    next.cursor = completedAt;
    if (!assignment.repeat) {
      hero.assignment = null;
      next.active = false;
    }
  }

  for (const run of runs) {
    // Guarded: a non-repeat completion cleared the assignment above, and
    // an unconditional write would dereference null.
    if (run.hero.assignment) run.hero.assignment.startedAt = run.cursor;
  }

  s.rng.cursor = rng.cursor;
  s.lastResolvedAt = now;
  return { state: s, events };
}
