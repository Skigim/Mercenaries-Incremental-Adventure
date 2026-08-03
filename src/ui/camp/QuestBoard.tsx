import { MISSIONS, getItem } from '../../core/catalog';
import { isUnlocked } from '../../core/unlocks';
import { formatDuration } from '../format';
import { CARD_ROTATIONS } from './HeroCard';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId, MissionDef } from '../../core/types';

function primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null } {
  const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
  const top = materials.reduce((best, e) => (e.weight > best.weight ? e : best), materials[0]!);
  const rare = mission.lootTable.find((e) => getItem(e.itemId)?.kind === 'trinket');
  return {
    itemTag: getItem(top.itemId)?.name ?? '',
    rareTag: rare ? (getItem(rare.itemId)?.name ?? null) : null,
  };
}

export function QuestBoard({
  state,
  selectedHeroId,
  onSelectHero,
  run,
  variant,
}: {
  state: GameState;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  run: (cmd: Command) => GameEvent[];
  variant: 'desktop' | 'mobile';
}) {
  const missions = Object.values(MISSIONS);

  const heroSelect = (
    <label className="hero-select-row">
      Sending
      <select className="hero-select" value={selectedHeroId} onChange={(e) => onSelectHero(e.target.value)}>
        {state.heroes.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      {variant === 'desktop' ? (
        <div className="quest-board-header">
          <div className="card-kicker">Quest board</div>
          {heroSelect}
        </div>
      ) : (
        <div className="mobile-quest-select-row">{heroSelect}</div>
      )}

      <div className={variant === 'desktop' ? 'mission-list' : 'mobile-tab-scroll'}>
        {missions.map((mission, i) => {
          const locked = !isUnlocked(mission.id, state.completions);
          const { itemTag, rareTag } = primaryLoot(mission);
          const rotation = CARD_ROTATIONS[i % CARD_ROTATIONS.length]!;

          const tags = (
            <div className="mission-row-tags">
              <span className="tag tag-neutral">{formatDuration(mission.durationMs)}</span>
              <span className="tag tag-neutral">{itemTag}</span>
              {rareTag && <span className="tag tag-accent-2">{rareTag}</span>}
            </div>
          );

          const dispatchButton = (
            <button
              type="button"
              className={`btn btn-primary${variant === 'mobile' ? ' btn-block' : ''}`}
              data-testid={`dispatch-${mission.id}`}
              onClick={() => run({ type: 'dispatch', heroId: selectedHeroId, missionId: mission.id, repeat: true })}
            >
              Dispatch
            </button>
          );

          if (variant === 'desktop') {
            return (
              <div key={mission.id} className={`mission-row${locked ? ' is-locked' : ''}`}>
                <div>
                  <span className="mission-name">{mission.name}</span>
                  {tags}
                </div>
                {locked ? <span className="mission-lock-text">Unlocks after the previous mission</span> : dispatchButton}
              </div>
            );
          }

          return (
            <div
              key={mission.id}
              className={`card elev-sm mission-card${locked ? ' is-locked' : ''}`}
              style={{ transform: `rotate(${rotation})` }}
            >
              <strong className="mission-name">{mission.name}</strong>
              {tags}
              {locked ? <p className="mission-lock-text">Unlocks after the previous mission</p> : dispatchButton}
            </div>
          );
        })}
      </div>
    </div>
  );
}
