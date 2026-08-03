import type { GameEvent } from '../../core/types';

export function WelcomeDialog({
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
    <div className="welcome-scrim">
      <div className="card elev-lg dialog welcome-dialog" data-testid="welcome-back">
        <div className="dialog-title">While you were away</div>
        <div className="dialog-body">
          <span>⚔ {completed} mission{completed === 1 ? '' : 's'} completed</span>
          {levelUps > 0 && <span>⭐ {levelUps} level-up{levelUps === 1 ? '' : 's'}</span>}
          {packFull && <span>🎒 A hero stopped with a full pack.</span>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onDismiss}>
            Nice, continue
          </button>
        </div>
      </div>
    </div>
  );
}
