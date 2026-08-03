import { CARD_ROTATIONS, HeroCard } from './HeroCard';
import { QuestBoard } from './QuestBoard';
import { SupplyCrate } from './SupplyCrate';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

export function CampBoardDesktop({
  state,
  now,
  run,
  justLeveledUp,
  selectedHeroId,
  onSelectHero,
  onSendToQuest,
}: {
  state: GameState;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  onSendToQuest: (id: HeroId) => void;
}) {
  return (
    <div className="camp-desktop-body">
      <div className="hero-grid">
        {state.heroes.map((hero, i) => (
          <HeroCard
            key={hero.id}
            hero={hero}
            now={now}
            run={run}
            justLeveledUp={justLeveledUp.has(hero.id)}
            rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]!}
            onSendToQuest={onSendToQuest}
          />
        ))}
      </div>

      <div className="board-row">
        <QuestBoard state={state} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} run={run} variant="desktop" />
        <SupplyCrate state={state} selectedHeroId={selectedHeroId} run={run} variant="desktop" />
      </div>
    </div>
  );
}
