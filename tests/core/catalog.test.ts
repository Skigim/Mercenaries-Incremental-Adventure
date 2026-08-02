import { describe, it, expect } from 'vitest';
import type { MissionId } from '../../src/core/types';
import { ITEMS, MISSIONS, STARTING_MISSION_IDS, getItem, getMission } from '../../src/core/catalog';

describe('catalog integrity', () => {
  it('every unlockedBy reference resolves to a real mission', () => {
    for (const mission of Object.values(MISSIONS)) {
      for (const required of mission.unlockedBy) {
        expect(
          MISSIONS[required],
          `${mission.id} requires unknown mission ${required}`,
        ).toBeDefined();
      }
    }
  });

  it('every loot table item resolves to a real item', () => {
    for (const mission of Object.values(MISSIONS)) {
      for (const entry of mission.lootTable) {
        expect(
          ITEMS[entry.itemId],
          `${mission.id} drops unknown item ${entry.itemId}`,
        ).toBeDefined();
      }
    }
  });

  it('keys match their own ids', () => {
    for (const [key, item] of Object.entries(ITEMS)) expect(item.id).toBe(key);
    for (const [key, mission] of Object.entries(MISSIONS)) expect(mission.id).toBe(key);
  });

  it('starting missions require nothing', () => {
    expect(STARTING_MISSION_IDS.length).toBeGreaterThan(0);
    for (const id of STARTING_MISSION_IDS) {
      expect(MISSIONS[id]?.unlockedBy).toEqual([]);
    }
  });

  it('the unlock graph is acyclic', () => {
    const state = new Map<MissionId, 'visiting' | 'done'>();
    const walk = (id: string, trail: string[]): void => {
      if (state.get(id as MissionId) === 'done') return;
      expect(state.get(id as MissionId), `cycle: ${[...trail, id].join(' -> ')}`).not.toBe('visiting');
      state.set(id as MissionId, 'visiting');
      for (const next of MISSIONS[id as MissionId]?.unlockedBy ?? []) walk(next, [...trail, id]);
      state.set(id as MissionId, 'done');
    };
    for (const id of Object.keys(MISSIONS)) walk(id, []);
  });

  it('every mission is reachable from the starting set', () => {
    const reachable = new Set(STARTING_MISSION_IDS);
    let grew = true;
    while (grew) {
      grew = false;
      for (const mission of Object.values(MISSIONS)) {
        if (reachable.has(mission.id)) continue;
        if (mission.unlockedBy.every((id) => reachable.has(id))) {
          reachable.add(mission.id);
          grew = true;
        }
      }
    }
    for (const id of Object.keys(MISSIONS)) {
      expect(reachable.has(id as MissionId), `${id} is unreachable and strands its content`).toBe(true);
    }
  });

  it('loot entries are well formed', () => {
    for (const mission of Object.values(MISSIONS)) {
      expect(mission.lootTable.length).toBeGreaterThan(0);
      expect(mission.rollsPerRun).toBeGreaterThan(0);
      expect(mission.durationMs).toBeGreaterThan(0);
      for (const entry of mission.lootTable) {
        expect(entry.weight).toBeGreaterThan(0);
        expect(entry.minQty).toBeGreaterThan(0);
        expect(entry.maxQty).toBeGreaterThanOrEqual(entry.minQty);
      }
    }
  });

  it('only trinkets carry a yield bonus', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.kind === 'material') expect(item.yieldBonus).toBeUndefined();
    }
  });

  it('lookups return undefined for unknown ids rather than throwing', () => {
    expect(getItem('nope' as any)).toBeUndefined();
    expect(getMission('nope' as any)).toBeUndefined();
  });
});
