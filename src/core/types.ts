export type HeroId = string;
export type ItemId = string;
export type MissionId = string;
export type RegionId = string;
export type MissionTag = string;

/** Reserved for the Part 2 specialization system. Nothing reads this. */
export interface Skill {
  id: string;
}

export interface ItemStack {
  itemId: ItemId;
  qty: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: 'material' | 'trinket';
  baseValue: number;
  yieldBonus?: number;
}

export interface WeightedEntry {
  itemId: ItemId;
  weight: number;
  minQty: number;
  maxQty: number;
}

export interface MissionDef {
  id: MissionId;
  name: string;
  regionId: RegionId;
  /** Reserved for the Part 2 specialization system. Nothing reads this. */
  tags: MissionTag[];
  durationMs: number;
  rollsPerRun: number;
  lootTable: WeightedEntry[];
  xpReward: number;
  unlockedBy: MissionId[];
}

export interface Assignment {
  missionId: MissionId;
  startedAt: number;
  repeat: boolean;
  blockedAt: number | null;
}

export interface Hero {
  id: HeroId;
  name: string;
  level: number;
  xp: number;
  /** Reserved. Always [] in Part 1. */
  skills: Skill[];
  trinket: ItemId | null;
  pack: ItemStack[];
  assignment: Assignment | null;
}

export interface GameState {
  version: number;
  heroes: Hero[];
  warehouse: ItemStack[];
  completions: Record<MissionId, number>;
  rng: { seed: number; cursor: number };
  lastResolvedAt: number;
}

export type GameEvent =
  | { type: 'MissionCompleted'; heroId: HeroId; missionId: MissionId; at: number }
  | { type: 'LootGained'; heroId: HeroId; at: number; items: ItemStack[] }
  | { type: 'LeveledUp'; heroId: HeroId; level: number }
  | { type: 'PackFull'; heroId: HeroId; at: number }
  | { type: 'Collected'; heroId: HeroId; items: ItemStack[] }
  | { type: 'ClockRewound'; to: number }
  | { type: 'AssignmentDropped'; heroId: HeroId; reason: 'unknown-mission' };
