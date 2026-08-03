import { useCallback, useState } from 'react';
import { countItems } from '../../core/pack';
import { useMediaQuery } from './useMediaQuery';
import { WelcomeDialog } from './WelcomeDialog';
import { CampBoardDesktop } from './CampBoardDesktop';
import { CampBoardMobile } from './CampBoardMobile';
import type { TabId } from './BottomNav';
import type { Command } from '../../core/commands';
import type { HeroId } from '../../core/types';
import type { Game } from '../useGame';

const LEVEL_UP_BADGE_MS = 900;

export function CampBoard({ game }: { game: Game }) {
  const { state, now, welcomeBack, showWelcome, dismissWelcome, run } = game;
  const isMobile = useMediaQuery('(max-width: 820px)');
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>(state.heroes[0]!.id);
  const [activeTab, setActiveTab] = useState<TabId>('heroes');
  const [justLeveledUp, setJustLeveledUp] = useState<Set<HeroId>>(new Set());

  const runTracked = useCallback(
    (cmd: Command) => {
      const events = run(cmd);
      const leveled = events.filter((e) => e.type === 'LeveledUp').map((e) => e.heroId);
      if (leveled.length > 0) {
        setJustLeveledUp((prev) => new Set([...prev, ...leveled]));
        leveled.forEach((heroId) => {
          setTimeout(() => {
            setJustLeveledUp((prev) => {
              if (!prev.has(heroId)) return prev;
              const next = new Set(prev);
              next.delete(heroId);
              return next;
            });
          }, LEVEL_UP_BADGE_MS);
        });
      }
      return events;
    },
    [run],
  );

  const onSendToQuest = useCallback((heroId: HeroId) => {
    setSelectedHeroId(heroId);
    setActiveTab('quests');
  }, []);

  const totalItems = countItems(state.warehouse);

  return (
    <div className="camp-page">
      <div className="camp-card">
        <div className="camp-region-art" aria-hidden="true" />

        {showWelcome && welcomeBack && <WelcomeDialog events={welcomeBack} onDismiss={dismissWelcome} />}

        <header className="camp-header">
          <div className="camp-header-brand">
            <span className="camp-header-title">Camp Tuvale</span>
            <span className="tag tag-accent-2">Tuvale</span>
          </div>
          <div className="camp-header-actions">
            <span className="camp-header-banked">{totalItems} items banked</span>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="collect-all"
              onClick={() => runTracked({ type: 'collectAll' })}
            >
              Collect everything
            </button>
          </div>
        </header>

        {isMobile ? (
          <CampBoardMobile
            state={state}
            now={now}
            run={runTracked}
            justLeveledUp={justLeveledUp}
            selectedHeroId={selectedHeroId}
            onSelectHero={setSelectedHeroId}
            onSendToQuest={onSendToQuest}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
          />
        ) : (
          <CampBoardDesktop
            state={state}
            now={now}
            run={runTracked}
            justLeveledUp={justLeveledUp}
            selectedHeroId={selectedHeroId}
            onSelectHero={setSelectedHeroId}
            onSendToQuest={setSelectedHeroId}
          />
        )}
      </div>
    </div>
  );
}
