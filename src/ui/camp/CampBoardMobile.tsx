import { HeroList } from './HeroList';
import { QuestBoard } from './QuestBoard';
import { SupplyCrate } from './SupplyCrate';
import { BottomNav, type TabId } from './BottomNav';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

export function CampBoardMobile({
  state,
  now,
  run,
  justLeveledUp,
  selectedHeroId,
  onSelectHero,
  onSendToQuest,
  activeTab,
  onChangeTab,
}: {
  state: GameState;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  onSendToQuest: (id: HeroId) => void;
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}) {
  return (
    <div className="camp-mobile-body">
      {activeTab === 'heroes' && (
        <HeroList
          heroes={state.heroes}
          now={now}
          run={run}
          justLeveledUp={justLeveledUp}
          onSendToQuest={onSendToQuest}
          className="mobile-hero-list"
        />
      )}

      {activeTab === 'quests' && (
        <QuestBoard state={state} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} run={run} variant="mobile" />
      )}

      {activeTab === 'warehouse' && (
        <SupplyCrate state={state} selectedHeroId={selectedHeroId} run={run} variant="mobile" />
      )}

      <BottomNav activeTab={activeTab} onChangeTab={onChangeTab} />
    </div>
  );
}
