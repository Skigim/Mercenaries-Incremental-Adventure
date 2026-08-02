import type { GameEvent } from '../core/types';

export function WelcomeBack({
  events,
  onDismiss,
}: {
  events: GameEvent[];
  onDismiss: () => void;
}) {
  const completed = events.filter((e) => e.type === 'MissionCompleted').length;
  const levelUps = events.filter((e) => e.type === 'LeveledUp').length;
  const packFull = events.some((e) => e.type === 'PackFull');

  return (
    <div className="welcome" data-testid="welcome-back">
      <h2>While you were away</h2>
      <ul>
        <li>{completed} mission{completed === 1 ? '' : 's'} completed</li>
        {levelUps > 0 && <li>{levelUps} level-up{levelUps === 1 ? '' : 's'}</li>}
        {packFull && <li>A hero stopped with a full pack.</li>}
      </ul>
      <button onClick={onDismiss}>Continue</button>
    </div>
  );
}
