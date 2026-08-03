import { CARD_ROTATIONS, HeroCard } from './HeroCard';
import type { Command } from '../../core/commands';
import type { GameEvent, Hero, HeroId } from '../../core/types';

export function HeroList({
  heroes,
  now,
  run,
  justLeveledUp,
  onSendToQuest,
  selectedHeroId,
  onSelect,
  className,
}: {
  heroes: Hero[];
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  onSendToQuest: (id: HeroId) => void;
  selectedHeroId: HeroId;
  onSelect: (id: HeroId) => void;
  className: string;
}) {
  return (
    <div className={className}>
      {heroes.map((hero, i) => (
        <HeroCard
          key={hero.id}
          hero={hero}
          now={now}
          run={run}
          justLeveledUp={justLeveledUp.has(hero.id)}
          rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]!}
          onSendToQuest={onSendToQuest}
          selected={selectedHeroId === hero.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
