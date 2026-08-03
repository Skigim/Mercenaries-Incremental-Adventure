import { getMission } from '../../core/catalog';
import { capacityRemaining, carryCapacity } from '../../core/derive';
import { countItems } from '../../core/pack';
import { formatDuration, missionProgress } from '../format';
import type { Command } from '../../core/commands';
import type { GameEvent, Hero, HeroId } from '../../core/types';

export const CARD_ROTATIONS = ['-1.4deg', '0.9deg', '-0.5deg', '1.1deg'];

export function HeroCard({
  hero,
  now,
  run,
  justLeveledUp,
  rotation,
  onSendToQuest,
  selected,
  onSelect,
}: {
  hero: Hero;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: boolean;
  rotation: string;
  onSendToQuest: (heroId: HeroId) => void;
  selected: boolean;
  onSelect: (heroId: HeroId) => void;
}) {
  const assignment = hero.assignment;
  const mission = assignment ? getMission(assignment.missionId) : undefined;
  const held = countItems(hero.pack);
  const capacity = carryCapacity(hero);

  let status = 'Idle — send him somewhere';
  let progress = 0;
  let showBar = false;
  if (assignment && mission) {
    showBar = true;
    if (assignment.blockedAt !== null) {
      status = `${mission.name} — pack full, waiting on you`;
      progress = 1;
    } else {
      progress = missionProgress(assignment.startedAt, mission.durationMs, now);
      const remaining = assignment.startedAt + mission.durationMs - now;
      status = `${mission.name} — ${formatDuration(remaining)} left`;
    }
  }

  return (
    <article
      className={`card elev-md hero-card${selected ? ' hero-card-selected' : ''}`}
      style={{ transform: `rotate(${rotation})` }}
      data-testid="hero-card"
      data-hero-id={hero.id}
      onClick={() => onSelect(hero.id)}
    >
      {justLeveledUp && <span className="tag tag-accent-2 hero-badge">Ding! Level up</span>}

      <div className="hero-card-header">
        <div className="hero-portrait" aria-hidden="true" />
        <div>
          <strong className="hero-card-name" data-testid="hero-name">{hero.name}</strong>
          <div className="tag tag-accent hero-level">Lv {hero.level}</div>
        </div>
      </div>

      <p className="hero-status" data-testid="hero-status">{status}</p>

      {showBar && (
        <div className="bar" aria-hidden="true">
          <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <p className="hero-pack" data-testid="hero-pack">
        Pack {held} / {capacity}
        {capacityRemaining(hero) === 0 && ' (full)'}
      </p>

      {held > 0 && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          data-testid="hero-collect"
          onClick={() => run({ type: 'collect', heroId: hero.id })}
        >
          Collect
        </button>
      )}

      {!assignment && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          data-testid="hero-send-job"
          onClick={() => onSendToQuest(hero.id)}
        >
          Send on a job
        </button>
      )}

      {assignment && (
        <div className="hero-actions">
          <button type="button" className="btn btn-ghost" onClick={() => run({ type: 'toggleRepeat', heroId: hero.id })}>
            Repeat: {assignment.repeat ? 'on' : 'off'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => run({ type: 'recall', heroId: hero.id })}>
            Recall
          </button>
        </div>
      )}
    </article>
  );
}
