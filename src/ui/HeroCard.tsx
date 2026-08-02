import { getMission } from '../core/catalog';
import { capacityRemaining, carryCapacity } from '../core/derive';
import { countItems } from '../core/pack';
import type { Command } from '../core/commands';
import type { Hero } from '../core/types';
import { formatDuration, missionProgress } from './format';

export function HeroCard({
  hero,
  now,
  run,
}: {
  hero: Hero;
  now: number;
  run: (cmd: Command) => void;
}) {
  const assignment = hero.assignment;
  const mission = assignment ? getMission(assignment.missionId) : undefined;
  const held = countItems(hero.pack);

  let status = 'Idle';
  let progress = 0;
  if (assignment && mission) {
    if (assignment.blockedAt !== null) {
      status = 'Pack full — waiting';
      progress = 1;
    } else {
      progress = missionProgress(assignment.startedAt, mission.durationMs, now);
      const remaining = assignment.startedAt + mission.durationMs - now;
      status = `${mission.name} — ${formatDuration(remaining)} left`;
    }
  }

  return (
    <article className="hero-card" data-testid="hero-card" data-hero-id={hero.id}>
      <header>
        <strong data-testid="hero-name">{hero.name}</strong>
        <span>Lv {hero.level}</span>
      </header>

      <p data-testid="hero-status">{status}</p>

      <div className="bar" aria-hidden="true">
        <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <p data-testid="hero-pack">
        Pack {held} / {carryCapacity(hero)}
        {capacityRemaining(hero) === 0 && ' (full)'}
      </p>

      <div className="actions">
        <button
          onClick={() => run({ type: 'collect', heroId: hero.id })}
          disabled={held === 0}
        >
          Collect
        </button>
        {assignment && (
          <>
            <button onClick={() => run({ type: 'toggleRepeat', heroId: hero.id })}>
              Repeat: {assignment.repeat ? 'on' : 'off'}
            </button>
            <button onClick={() => run({ type: 'recall', heroId: hero.id })}>
              Recall
            </button>
          </>
        )}
      </div>
    </article>
  );
}
