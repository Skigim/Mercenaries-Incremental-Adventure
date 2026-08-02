import { MISSIONS, getMission } from './catalog';
import type { GameState, MissionDef, MissionId } from './types';

export function isUnlocked(
  missionId: MissionId,
  completions: Record<MissionId, number>,
): boolean {
  const mission = getMission(missionId);
  if (!mission) return false;
  return mission.unlockedBy.every((id) => (completions[id] ?? 0) > 0);
}

export function availableMissions(state: GameState): MissionDef[] {
  return Object.values(MISSIONS).filter((m) => isUnlocked(m.id, state.completions));
}
