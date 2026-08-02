import { availableMissions } from '../core/unlocks';
import type { Command } from '../core/commands';
import type { GameState, HeroId } from '../core/types';
import { formatDuration } from './format';

export function MissionList({
  state,
  selectedHeroId,
  onSelectHero,
  run,
}: {
  state: GameState;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  run: (cmd: Command) => void;
}) {
  return (
    <section className="missions">
      <h2>Missions</h2>

      <label>
        Send{' '}
        <select value={selectedHeroId} onChange={(e) => onSelectHero(e.target.value)}>
          {state.heroes.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </label>

      <ul>
        {availableMissions(state).map((mission) => (
          <li key={mission.id}>
            <div>
              <strong>{mission.name}</strong>
              <span> — {formatDuration(mission.durationMs)}</span>
            </div>
            <button
              data-testid={`dispatch-${mission.id}`}
              onClick={() =>
                run({
                  type: 'dispatch',
                  heroId: selectedHeroId,
                  missionId: mission.id,
                  repeat: true,
                })
              }
            >
              Dispatch
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
