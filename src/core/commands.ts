import { getItem } from './catalog';
import { addItems, takeItem } from './pack';
import { resolveUpTo } from './resolve';
import { isUnlocked } from './unlocks';
import type { GameEvent, GameState, HeroId, ItemId, MissionId } from './types';

export type Command =
  | { type: 'dispatch'; heroId: HeroId; missionId: MissionId; repeat: boolean }
  | { type: 'toggleRepeat'; heroId: HeroId }
  | { type: 'recall'; heroId: HeroId }
  | { type: 'collect'; heroId: HeroId }
  | { type: 'collectAll' }
  | { type: 'equip'; heroId: HeroId; itemId: ItemId }
  | { type: 'unequip'; heroId: HeroId };

/**
 * Every command resolves to `now` before it applies. A command can never
 * act on a stale world — which is also why recall is never destructive
 * and equip is never retroactive.
 */
export function applyCommand(
  state: GameState,
  cmd: Command,
  now: number,
): { state: GameState; events: GameEvent[] } {
  const resolved = resolveUpTo(state, now);
  const s = resolved.state;
  const events = [...resolved.events];

  const heroOf = (id: HeroId) => s.heroes.find((h) => h.id === id);

  switch (cmd.type) {
    case 'dispatch': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      if (!isUnlocked(cmd.missionId, s.completions)) break;
      hero.assignment = {
        missionId: cmd.missionId,
        startedAt: now,
        repeat: cmd.repeat,
        blockedAt: null,
      };
      break;
    }

    case 'toggleRepeat': {
      const hero = heroOf(cmd.heroId);
      const assignment = hero?.assignment;
      if (!hero || !assignment) break;
      assignment.repeat = !assignment.repeat;
      // A blocked hero has no run in flight, so there is no partial
      // progress to preserve and a dead assignment would only confuse.
      if (!assignment.repeat && assignment.blockedAt !== null) hero.assignment = null;
      break;
    }

    case 'recall': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      hero.assignment = null;
      break;
    }

    case 'collect': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      collectFrom(s, cmd.heroId, now, events);
      break;
    }

    case 'collectAll': {
      for (const hero of s.heroes) collectFrom(s, hero.id, now, events);
      break;
    }

    case 'equip': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      if (getItem(cmd.itemId)?.kind !== 'trinket') break;
      const remaining = takeItem(s.warehouse, cmd.itemId, 1);
      if (!remaining) break; // not in the warehouse; packs must be collected first
      s.warehouse = remaining;
      if (hero.trinket) s.warehouse = addItems(s.warehouse, [{ itemId: hero.trinket, qty: 1 }]);
      hero.trinket = cmd.itemId;
      break;
    }

    case 'unequip': {
      const hero = heroOf(cmd.heroId);
      if (!hero?.trinket) break;
      s.warehouse = addItems(s.warehouse, [{ itemId: hero.trinket, qty: 1 }]);
      hero.trinket = null;
      break;
    }
  }

  return { state: s, events };
}

function collectFrom(
  s: GameState,
  heroId: HeroId,
  now: number,
  events: GameEvent[],
): void {
  const hero = s.heroes.find((h) => h.id === heroId);
  if (!hero || hero.pack.length === 0) return;

  const collected = hero.pack;
  s.warehouse = addItems(s.warehouse, collected);
  hero.pack = [];
  events.push({ type: 'Collected', heroId, items: collected });

  if (hero.assignment) {
    // Restart from now: a hero who stood idle with a full pack must not
    // instantly bank the missions they never ran while blocked.
    hero.assignment.blockedAt = null;
    hero.assignment.startedAt = now;
  }
}
