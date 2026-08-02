import { getMission, maxItemsPerRun } from './catalog';
import { capacityRemaining, levelFromXp } from './derive';
import { rollLoot } from './loot';
import { addItems } from './pack';
import { createRng } from './rng';
import type { GameEvent, GameState } from './types';

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

  for (const hero of s.heroes) {
    const assignment = hero.assignment;
    if (!assignment || assignment.blockedAt !== null) continue;

    const mission = getMission(assignment.missionId);
    if (!mission) {
      hero.assignment = null;
      events.push({ type: 'AssignmentDropped', heroId: hero.id, reason: 'unknown-mission' });
      continue;
    }

    let cursor = assignment.startedAt;

    while (cursor + mission.durationMs <= now) {
      if (capacityRemaining(hero) < maxItemsPerRun(mission, hero)) {
        assignment.blockedAt = cursor;
        events.push({ type: 'PackFull', heroId: hero.id, at: cursor });
        break;
      }

      const completedAt = cursor + mission.durationMs;
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

      // Advance before the non-repeat break so the completed run's end
      // time is never misattributed to the next one.
      cursor = completedAt;
      if (!assignment.repeat) {
        hero.assignment = null;
        break;
      }
    }

    // Guarded: a non-repeat completion cleared the assignment above, and
    // an unconditional write would dereference null.
    if (hero.assignment) hero.assignment.startedAt = cursor;
  }

  s.rng.cursor = rng.cursor;
  s.lastResolvedAt = now;
  return { state: s, events };
}
