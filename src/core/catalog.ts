import type { ItemDef, ItemId, MissionDef, MissionId } from './types';

const itemList: ItemDef[] = [
  { id: 'copper_ore', name: 'Copper Ore', kind: 'material', baseValue: 1 },
  { id: 'iron_ore', name: 'Iron Ore', kind: 'material', baseValue: 8 },
  { id: 'oak_log', name: 'Oak Log', kind: 'material', baseValue: 1 },
  { id: 'wolf_pelt', name: 'Wolf Pelt', kind: 'material', baseValue: 12 },
  { id: 'silver_ore', name: 'Silver Ore', kind: 'material', baseValue: 20 },
  { id: 'ancient_shard', name: 'Ancient Shard', kind: 'material', baseValue: 40 },
  { id: 'copper_band', name: 'Copper Band', kind: 'trinket', baseValue: 60, yieldBonus: 0.05 },
  { id: 'jade_charm', name: 'Jade Charm', kind: 'trinket', baseValue: 150, yieldBonus: 0.1 },
  { id: 'gilded_signet', name: 'Gilded Signet', kind: 'trinket', baseValue: 500, yieldBonus: 0.2 },
];

const missionList: MissionDef[] = [
  {
    id: 'tuvale_gather',
    name: 'Gather by the Roadside',
    regionId: 'tuvale',
    tags: ['forest'],
    durationMs: 30_000,
    rollsPerRun: 1,
    xpReward: 10,
    unlockedBy: [],
    lootTable: [
      { itemId: 'copper_ore', weight: 60, minQty: 1, maxQty: 3 },
      { itemId: 'oak_log', weight: 40, minQty: 1, maxQty: 2 },
    ],
  },
  {
    id: 'tuvale_thicket',
    name: 'Clear the Thicket',
    regionId: 'tuvale',
    tags: ['forest'],
    durationMs: 300_000,
    rollsPerRun: 3,
    xpReward: 60,
    unlockedBy: ['tuvale_gather'],
    lootTable: [
      { itemId: 'oak_log', weight: 50, minQty: 2, maxQty: 5 },
      { itemId: 'copper_ore', weight: 30, minQty: 2, maxQty: 4 },
      { itemId: 'wolf_pelt', weight: 19, minQty: 1, maxQty: 2 },
      { itemId: 'copper_band', weight: 1, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'tuvale_mine',
    name: 'Work the Old Mine',
    regionId: 'tuvale',
    tags: ['cave'],
    durationMs: 3_600_000,
    rollsPerRun: 8,
    xpReward: 420,
    unlockedBy: ['tuvale_thicket'],
    lootTable: [
      { itemId: 'iron_ore', weight: 55, minQty: 3, maxQty: 7 },
      { itemId: 'copper_ore', weight: 30, minQty: 4, maxQty: 8 },
      { itemId: 'silver_ore', weight: 13, minQty: 1, maxQty: 3 },
      { itemId: 'jade_charm', weight: 2, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'yarsol_ruins',
    name: 'Delve the Sunken Ruins',
    regionId: 'yarsol',
    tags: ['ruin'],
    durationMs: 28_800_000,
    rollsPerRun: 20,
    xpReward: 2_400,
    unlockedBy: ['tuvale_mine'],
    lootTable: [
      { itemId: 'ancient_shard', weight: 40, minQty: 2, maxQty: 6 },
      { itemId: 'silver_ore', weight: 35, minQty: 4, maxQty: 9 },
      { itemId: 'iron_ore', weight: 22, minQty: 5, maxQty: 10 },
      { itemId: 'gilded_signet', weight: 3, minQty: 1, maxQty: 1 },
    ],
  },
];

export const ITEMS: Record<ItemId, ItemDef> = Object.fromEntries(
  itemList.map((i) => [i.id, i]),
);

export const MISSIONS: Record<MissionId, MissionDef> = Object.fromEntries(
  missionList.map((m) => [m.id, m]),
);

export const STARTING_MISSION_IDS: MissionId[] = missionList
  .filter((m) => m.unlockedBy.length === 0)
  .map((m) => m.id);

export function getItem(id: ItemId): ItemDef | undefined {
  return ITEMS[id];
}

export function getMission(id: MissionId): MissionDef | undefined {
  return MISSIONS[id];
}
