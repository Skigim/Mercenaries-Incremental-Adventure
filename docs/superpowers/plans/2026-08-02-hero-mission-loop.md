# Hero Mission Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MerchantNext Part 1 — dispatch a hero on a wall-clock mission, resolve elapsed time lazily from timestamps, and return materials, trinkets, and XP.

**Architecture:** A pure `src/core/` module holds every game rule and touches no browser API — no `Date`, no `Math.random`, no `localStorage`, no DOM. Time and randomness are injected, so an eight-hour offline gap is a synchronous unit test. Nothing ticks: `resolveUpTo(state, now)` replays whatever finished since the last resolution, which makes offline progress a consequence of the model rather than a second code path. A thin `src/ui/` React layer renders state and dispatches commands; it never contains rules.

**Tech Stack:** TypeScript (strict), React 18, Vite, Vitest for unit tests, Playwright for end-to-end, `localStorage` for persistence.

**Spec:** [`docs/superpowers/specs/2026-08-02-hero-mission-loop-design.md`](../specs/2026-08-02-hero-mission-loop-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript strict mode on.** No `any`. No non-null assertions (`!`) in `src/core/`.
- **`src/core/` imports nothing from `src/ui/`.** The dependency runs one way, always.
- **`src/core/` must never reference `Date`, `Math.random`, `localStorage`, `window`, or `document`.** A guard test enforces this (Task 2). The sole exception is `src/core/persistence.ts`, which takes a storage object as a parameter rather than reaching for the global.
- **All core functions are pure.** They take state, return new state. Clone at the top, mutate the clone, return it.
- **RNG draws are positional and unconditional.** A given `(seed, cursor)` always yields the same number, and the number of draws per operation never varies with the data. This is what makes save/load reproducible.
- **Unit tests:** `npm test`. **E2E:** `npm run test:e2e`. Both must pass before any commit.
- **Commit after every task** using conventional-commit prefixes (`feat:`, `test:`, `chore:`, `fix:`).

## Deviation From The Spec

The spec defines `maxItemsPerRun(mission)` as "computed statically from the table." That is not sufficient once yield scaling exists: the worst-case haul depends on the hero's `yieldMultiplier`, so a level-20 hero's worst case exceeds a level-1 hero's from the identical table. A static value would under-reserve capacity and reintroduce the mid-mission overflow the spec eliminates.

This plan therefore implements **`maxItemsPerRun(mission, hero)`**, computed as `rollsPerRun * (floor(maxQty * yieldMultiplier(hero)) + 1)`. The `+ 1` covers probabilistic rounding's possible extra item. Everything the spec guarantees — loot never rolled unless it already fits, nothing lost mid-mission — holds exactly as written; only the signature changes.

## File Structure

```
package.json  tsconfig.json  vite.config.ts  playwright.config.ts  index.html

src/core/
  types.ts        all domain types and the event union
  clock.ts        Clock interface, systemClock, fixedClock
  rng.ts          positional seeded RNG
  catalog.ts      item and mission catalogs, lookups, maxItemsPerRun
  derive.ts       level curve, carryCapacity, yieldMultiplier, capacityRemaining
  pack.ts         ItemStack arithmetic (add, count, take, merge)
  loot.ts         rollLoot — weighted draw + probabilistic rounding
  unlocks.ts      isUnlocked, availableMissions
  resolve.ts      resolveUpTo — the resolution engine
  commands.ts     Command union, applyCommand
  newGame.ts      starting state
  persistence.ts  serialize, deserialize, migrate, sanitize

src/ui/
  useGame.ts      React binding: boot, render interval, debounced autosave
  HeroCard.tsx    one hero: status, progress, controls
  MissionList.tsx available missions, dispatch
  Warehouse.tsx   collected items
  WelcomeBack.tsx offline summary from the boot event log
  App.tsx         layout
  main.tsx        entry point

tests/core/*.test.ts        unit tests, one file per core module
tests/e2e/loop.spec.ts      Playwright
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/ui/main.tsx`, `tests/core/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` and `npm run dev`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "merchantnext",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `index.html` and `src/ui/main.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MerchantNext</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/main.tsx"></script>
  </body>
</html>
```

`src/ui/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1>MerchantNext</h1>
  </StrictMode>,
);
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: Write the smoke test**

`tests/core/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Install and verify**

Run: `npm install && npm test`
Expected: 1 test passes.

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts index.html src tests
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest"
```

---

### Task 2: Core primitives — types, clock, RNG

**Files:**
- Create: `src/core/types.ts`, `src/core/clock.ts`, `src/core/rng.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/purity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: every domain type used by later tasks; `createRng(seed, cursor): Rng` with `next(): number` and a readable `cursor`; `systemClock` and `fixedClock(t)`.

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/core/clock.ts`**

```ts
export interface Clock {
  now(): number;
}

/** The only place in the app allowed to read wall-clock time. */
export const systemClock: Clock = { now: () => Date.now() };

export function fixedClock(t: number): Clock & { set(next: number): void } {
  let current = t;
  return {
    now: () => current,
    set(next: number) {
      current = next;
    },
  };
}
```

Note: `clock.ts` is exempt from the no-`Date` guard, since it exists precisely to isolate that access. The guard test in Step 6 excludes it by name.

- [ ] **Step 3: Write the failing RNG test**

`tests/core/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';

describe('createRng', () => {
  it('is positional: the same seed and cursor always give the same number', () => {
    const a = createRng(1234, 7);
    const b = createRng(1234, 7);
    expect(a.next()).toBe(b.next());
  });

  it('advances its cursor by one per draw', () => {
    const rng = createRng(1, 0);
    rng.next();
    rng.next();
    rng.next();
    expect(rng.cursor).toBe(3);
  });

  it('resumes exactly where a previous instance stopped', () => {
    const first = createRng(99, 0);
    first.next();
    first.next();
    const resumed = createRng(99, first.cursor);

    const uninterrupted = createRng(99, 0);
    uninterrupted.next();
    uninterrupted.next();

    expect(resumed.next()).toBe(uninterrupted.next());
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(5, 0);
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different values at different cursors', () => {
    const rng = createRng(42, 0);
    const values = new Set(Array.from({ length: 100 }, () => rng.next()));
    expect(values.size).toBeGreaterThan(90);
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test -- rng`
Expected: FAIL — cannot resolve `../../src/core/rng`.

- [ ] **Step 5: Write `src/core/rng.ts`**

```ts
export interface Rng {
  next(): number;
  readonly cursor: number;
}

/**
 * Positional hash: a pure function of (seed, cursor). Because it derives
 * rather than accumulates, a saved cursor resumes the exact sequence —
 * which is what stops a reload from rerolling already-resolved loot.
 */
function hash(seed: number, cursor: number): number {
  let t = (seed + cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRng(seed: number, cursor: number): Rng {
  let c = cursor;
  return {
    next(): number {
      return hash(seed, c++);
    },
    get cursor(): number {
      return c;
    },
  };
}
```

- [ ] **Step 6: Write the purity guard test**

`tests/core/purity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_DIR = join(process.cwd(), 'src', 'core');

// clock.ts isolates Date; persistence.ts receives storage as a parameter.
const EXEMPT = new Set(['clock.ts']);

const FORBIDDEN = [
  { name: 'Date', pattern: /\bDate\s*\./ },
  { name: 'Math.random', pattern: /\bMath\s*\.\s*random\b/ },
  { name: 'localStorage', pattern: /\blocalStorage\b/ },
  { name: 'window', pattern: /\bwindow\b/ },
  { name: 'document', pattern: /\bdocument\b/ },
];

describe('core purity', () => {
  const files = readdirSync(CORE_DIR).filter(
    (f) => f.endsWith('.ts') && !EXEMPT.has(f),
  );

  it('has core files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} touches no ambient browser state`, () => {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      for (const { name, pattern } of FORBIDDEN) {
        expect(
          pattern.test(source),
          `${file} references ${name}; inject it instead`,
        ).toBe(false);
      }
    });
  }

  it('never imports from the ui layer', () => {
    for (const file of files) {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      expect(source.includes('../ui'), `${file} imports from ui`).toBe(false);
    }
  });
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all RNG and purity tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/core/clock.ts src/core/rng.ts tests/core/rng.test.ts tests/core/purity.test.ts
git commit -m "feat: add core domain types, injected clock, and positional seeded RNG"
```

---

### Task 3: Catalog and its validation

**Files:**
- Create: `src/core/catalog.ts`
- Test: `tests/core/catalog.test.ts`

**Interfaces:**
- Consumes: `ItemDef`, `MissionDef`, `MissionId`, `ItemId` from `types.ts`
- Produces: `ITEMS: Record<ItemId, ItemDef>`, `MISSIONS: Record<MissionId, MissionDef>`, `getItem(id): ItemDef | undefined`, `getMission(id): MissionDef | undefined`, `STARTING_MISSION_IDS: MissionId[]`

`maxItemsPerRun` lands in Task 4, because it depends on `yieldMultiplier`.

- [ ] **Step 1: Write the failing catalog validation test**

`tests/core/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
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
      if (state.get(id) === 'done') return;
      expect(state.get(id), `cycle: ${[...trail, id].join(' -> ')}`).not.toBe('visiting');
      state.set(id, 'visiting');
      for (const next of MISSIONS[id]?.unlockedBy ?? []) walk(next, [...trail, id]);
      state.set(id, 'done');
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
      expect(reachable.has(id), `${id} is unreachable and strands its content`).toBe(true);
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
    expect(getItem('nope')).toBeUndefined();
    expect(getMission('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- catalog`
Expected: FAIL — cannot resolve `../../src/core/catalog`.

- [ ] **Step 3: Write `src/core/catalog.ts`**

Durations honour the spec's ~30s–8h span. Longer missions carry a better haul per hour, authored directly into the tables rather than derived from a formula.

```ts
import type { ItemDef, ItemId, MissionDef, MissionId } from './types';

const itemList: ItemDef[] = [
  { id: 'copper_ore', name: 'Copper Ore', kind: 'material', baseValue: 2 },
  { id: 'iron_ore', name: 'Iron Ore', kind: 'material', baseValue: 5 },
  { id: 'oak_log', name: 'Oak Log', kind: 'material', baseValue: 3 },
  { id: 'wolf_pelt', name: 'Wolf Pelt', kind: 'material', baseValue: 8 },
  { id: 'silver_ore', name: 'Silver Ore', kind: 'material', baseValue: 14 },
  { id: 'ancient_shard', name: 'Ancient Shard', kind: 'material', baseValue: 30 },
  { id: 'copper_band', name: 'Copper Band', kind: 'trinket', baseValue: 45, yieldBonus: 0.05 },
  { id: 'jade_charm', name: 'Jade Charm', kind: 'trinket', baseValue: 120, yieldBonus: 0.1 },
  { id: 'gilded_signet', name: 'Gilded Signet', kind: 'trinket', baseValue: 400, yieldBonus: 0.2 },
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- catalog`
Expected: PASS, all nine cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/catalog.ts tests/core/catalog.test.ts
git commit -m "feat: add item and mission catalogs with build-time integrity validation"
```

---

### Task 4: Derived stats and pack arithmetic

**Files:**
- Create: `src/core/derive.ts`, `src/core/pack.ts`
- Modify: `src/core/catalog.ts` (add `maxItemsPerRun`)
- Test: `tests/core/derive.test.ts`, `tests/core/pack.test.ts`

**Interfaces:**
- Consumes: `Hero`, `ItemStack`, `MissionDef` from `types.ts`; `getItem` from `catalog.ts`
- Produces:
  - `derive.ts`: `xpToReach(level): number`, `levelFromXp(xp): number`, `carryCapacity(hero): number`, `yieldMultiplier(hero): number`, `capacityRemaining(hero): number`
  - `pack.ts`: `countItems(stacks): number`, `addItems(stacks, additions): ItemStack[]`, `takeItem(stacks, itemId, qty): ItemStack[] | null`
  - `catalog.ts`: `maxItemsPerRun(mission, hero): number`

- [ ] **Step 1: Write the failing pack test**

`tests/core/pack.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { addItems, countItems, takeItem } from '../../src/core/pack';

describe('pack arithmetic', () => {
  it('counts total items, not stacks', () => {
    expect(countItems([
      { itemId: 'copper_ore', qty: 40 },
      { itemId: 'wolf_pelt', qty: 3 },
    ])).toBe(43);
  });

  it('counts an empty pack as zero', () => {
    expect(countItems([])).toBe(0);
  });

  it('merges additions into an existing stack', () => {
    const result = addItems(
      [{ itemId: 'copper_ore', qty: 5 }],
      [{ itemId: 'copper_ore', qty: 3 }],
    );
    expect(result).toEqual([{ itemId: 'copper_ore', qty: 8 }]);
  });

  it('appends a new stack for an unseen item', () => {
    const result = addItems(
      [{ itemId: 'copper_ore', qty: 5 }],
      [{ itemId: 'oak_log', qty: 2 }],
    );
    expect(result).toEqual([
      { itemId: 'copper_ore', qty: 5 },
      { itemId: 'oak_log', qty: 2 },
    ]);
  });

  it('does not mutate its inputs', () => {
    const original = [{ itemId: 'copper_ore', qty: 5 }];
    addItems(original, [{ itemId: 'copper_ore', qty: 5 }]);
    expect(original).toEqual([{ itemId: 'copper_ore', qty: 5 }]);
  });

  it('takes a quantity and drops emptied stacks', () => {
    const result = takeItem([{ itemId: 'jade_charm', qty: 1 }], 'jade_charm', 1);
    expect(result).toEqual([]);
  });

  it('takes a partial quantity and keeps the remainder', () => {
    const result = takeItem([{ itemId: 'copper_ore', qty: 5 }], 'copper_ore', 2);
    expect(result).toEqual([{ itemId: 'copper_ore', qty: 3 }]);
  });

  it('returns null when there is not enough to take', () => {
    expect(takeItem([{ itemId: 'copper_ore', qty: 1 }], 'copper_ore', 2)).toBeNull();
    expect(takeItem([], 'copper_ore', 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- pack`
Expected: FAIL — cannot resolve `../../src/core/pack`.

- [ ] **Step 3: Write `src/core/pack.ts`**

```ts
import type { ItemId, ItemStack } from './types';

/**
 * Total items, not stacks. Counting stacks would defeat the carry cap:
 * a hero repeating one mission draws from the same small table forever
 * and would occupy the same few stacks indefinitely.
 */
export function countItems(stacks: ItemStack[]): number {
  return stacks.reduce((sum, s) => sum + s.qty, 0);
}

export function addItems(stacks: ItemStack[], additions: ItemStack[]): ItemStack[] {
  const result = stacks.map((s) => ({ ...s }));
  for (const addition of additions) {
    if (addition.qty <= 0) continue;
    const existing = result.find((s) => s.itemId === addition.itemId);
    if (existing) existing.qty += addition.qty;
    else result.push({ ...addition });
  }
  return result;
}

/** Returns null — never a partial take — if the quantity is not available. */
export function takeItem(
  stacks: ItemStack[],
  itemId: ItemId,
  qty: number,
): ItemStack[] | null {
  const existing = stacks.find((s) => s.itemId === itemId);
  if (!existing || existing.qty < qty) return null;
  return stacks
    .map((s) => (s.itemId === itemId ? { ...s, qty: s.qty - qty } : { ...s }))
    .filter((s) => s.qty > 0);
}
```

- [ ] **Step 4: Write the failing derive test**

`tests/core/derive.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  capacityRemaining,
  carryCapacity,
  levelFromXp,
  xpToReach,
  yieldMultiplier,
} from '../../src/core/derive';
import { maxItemsPerRun, MISSIONS } from '../../src/core/catalog';
import type { Hero } from '../../src/core/types';

function hero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1',
    name: 'Test',
    level: 1,
    xp: 0,
    skills: [],
    trinket: null,
    pack: [],
    assignment: null,
    ...overrides,
  };
}

describe('level curve', () => {
  it('starts level 1 at zero xp', () => {
    expect(xpToReach(1)).toBe(0);
    expect(levelFromXp(0)).toBe(1);
  });

  it('is strictly increasing', () => {
    for (let l = 1; l < 40; l++) {
      expect(xpToReach(l + 1)).toBeGreaterThan(xpToReach(l));
    }
  });

  it('round-trips: xp exactly at a threshold yields that level', () => {
    for (let l = 1; l <= 30; l++) {
      expect(levelFromXp(xpToReach(l))).toBe(l);
    }
  });

  it('one xp short of a threshold stays at the lower level', () => {
    expect(levelFromXp(xpToReach(5) - 1)).toBe(4);
  });
});

describe('carryCapacity', () => {
  it('grows with level', () => {
    expect(carryCapacity(hero({ level: 2 }))).toBeGreaterThan(
      carryCapacity(hero({ level: 1 })),
    );
  });

  it('is positive at level 1', () => {
    expect(carryCapacity(hero())).toBeGreaterThan(0);
  });
});

describe('capacityRemaining', () => {
  it('subtracts items held, counting quantity not stacks', () => {
    const h = hero({ pack: [{ itemId: 'copper_ore', qty: 10 }] });
    expect(capacityRemaining(h)).toBe(carryCapacity(h) - 10);
  });

  it('never reports negative room', () => {
    const h = hero({ pack: [{ itemId: 'copper_ore', qty: 99_999 }] });
    expect(capacityRemaining(h)).toBe(0);
  });
});

describe('yieldMultiplier', () => {
  it('is 1 for a level 1 hero with no trinket', () => {
    expect(yieldMultiplier(hero())).toBe(1);
  });

  it('increases with level', () => {
    expect(yieldMultiplier(hero({ level: 10 }))).toBeGreaterThan(1);
  });

  it('adds the equipped trinket bonus', () => {
    const bare = yieldMultiplier(hero({ level: 3 }));
    const adorned = yieldMultiplier(hero({ level: 3, trinket: 'jade_charm' }));
    expect(adorned).toBeCloseTo(bare + 0.1, 10);
  });

  it('ignores an unknown trinket id rather than throwing', () => {
    expect(yieldMultiplier(hero({ trinket: 'nonexistent' }))).toBe(1);
  });
});

describe('maxItemsPerRun', () => {
  it('covers the largest possible haul including the rounding bonus', () => {
    const mission = MISSIONS.tuvale_thicket!;
    // 3 rolls, largest maxQty is 5, level 1 multiplier is 1.
    expect(maxItemsPerRun(mission, hero())).toBe(3 * (5 + 1));
  });

  it('grows with the hero yield multiplier', () => {
    const mission = MISSIONS.tuvale_thicket!;
    expect(maxItemsPerRun(mission, hero({ level: 20 }))).toBeGreaterThan(
      maxItemsPerRun(mission, hero({ level: 1 })),
    );
  });

  it('every mission is runnable by a level 1 hero', () => {
    // If a mission's worst case exceeds starting capacity, the capacity
    // gate blocks it on every attempt and the content is unreachable.
    const fresh = hero();
    for (const mission of Object.values(MISSIONS)) {
      expect(
        maxItemsPerRun(mission, fresh),
        `${mission.id} can never start: worst case exceeds level 1 capacity`,
      ).toBeLessThanOrEqual(carryCapacity(fresh));
    }
  });
});
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `npm test -- derive`
Expected: FAIL — cannot resolve `../../src/core/derive`.

- [ ] **Step 6: Write `src/core/derive.ts`**

```ts
import { getItem } from './catalog';
import { countItems } from './pack';
import type { Hero } from './types';

const XP_STEP = 100;
// Base capacity must exceed every mission's level-1 worst case, or that
// mission can never start — the capacity gate would block it forever.
// The catalog test enforces this.
const BASE_CAPACITY = 300;
const CAPACITY_PER_LEVEL = 25;
const YIELD_PER_LEVEL = 0.05;

/** Triangular curve: 0, 100, 300, 600, 1000 … */
export function xpToReach(level: number): number {
  return (XP_STEP * (level - 1) * level) / 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  return level;
}

/**
 * Capacity is the offline cap. Raising it with level is the real reward
 * for levelling in a game built around absence: a stronger hero stays
 * productive unattended for longer.
 */
export function carryCapacity(hero: Hero): number {
  return BASE_CAPACITY + (hero.level - 1) * CAPACITY_PER_LEVEL;
}

export function capacityRemaining(hero: Hero): number {
  return Math.max(0, carryCapacity(hero) - countItems(hero.pack));
}

export function yieldMultiplier(hero: Hero): number {
  const bonus = hero.trinket ? (getItem(hero.trinket)?.yieldBonus ?? 0) : 0;
  return 1 + (hero.level - 1) * YIELD_PER_LEVEL + bonus;
}
```

- [ ] **Step 7: Add `maxItemsPerRun` to `src/core/catalog.ts`**

Add `Hero` to the existing type import so there is only one `./types` import, add a value import for `./derive`, then append the function:

```ts
// replace the existing types import with this one
import type { Hero, ItemDef, ItemId, MissionDef, MissionId } from './types';
// new value import
import { yieldMultiplier } from './derive';

/**
 * The largest total quantity one run of this mission can produce for this
 * hero. A run only starts if this already fits, which is what makes
 * "nothing lost mid-mission" true by construction rather than by cleanup.
 * The +1 per roll covers probabilistic rounding's possible extra item.
 */
export function maxItemsPerRun(mission: MissionDef, hero: Hero): number {
  const largest = Math.max(...mission.lootTable.map((e) => e.maxQty));
  const scaled = Math.floor(largest * yieldMultiplier(hero)) + 1;
  return mission.rollsPerRun * scaled;
}
```

Note: `catalog.ts` and `derive.ts` import from each other. This is fine — `derive` uses `getItem` (a value available at module init) and `catalog` uses `yieldMultiplier` only inside a function body, so no circular initialisation occurs. If the bundler complains, move `maxItemsPerRun` into `derive.ts` and re-export it from `catalog.ts`.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: all pack, derive, catalog, RNG, and purity tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/derive.ts src/core/pack.ts src/core/catalog.ts tests/core/derive.test.ts tests/core/pack.test.ts
git commit -m "feat: add level curve, carry capacity, yield multiplier, and pack arithmetic"
```

---

### Task 5: Loot rolling

**Files:**
- Create: `src/core/loot.ts`
- Test: `tests/core/loot.test.ts`

**Interfaces:**
- Consumes: `Rng` from `rng.ts`; `yieldMultiplier` from `derive.ts`; `MissionDef`, `Hero`, `ItemStack` from `types.ts`
- Produces: `rollLoot(mission, hero, rng): ItemStack[]`, `scaleQuantity(base, multiplier, rng): number`

**Draw ordering is part of the contract.** Each roll consumes exactly three draws in this order: entry selection, quantity, rounding. Always three, regardless of the data — if the count varied with the outcome, a replay from a saved cursor would desynchronise.

- [ ] **Step 1: Write the failing loot test**

`tests/core/loot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rollLoot, scaleQuantity } from '../../src/core/loot';
import { createRng } from '../../src/core/rng';
import { countItems } from '../../src/core/pack';
import { maxItemsPerRun, MISSIONS } from '../../src/core/catalog';
import type { Hero } from '../../src/core/types';

function hero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'h1', name: 'Test', level: 1, xp: 0, skills: [],
    trinket: null, pack: [], assignment: null, ...overrides,
  };
}

describe('scaleQuantity', () => {
  it('returns the base quantity when the multiplier is exactly 1', () => {
    const rng = createRng(1, 0);
    expect(scaleQuantity(4, 1, rng)).toBe(4);
  });

  it('never floors a fractional gain away', () => {
    // 1 x 1.25 must average above 1, not truncate to 1 every time.
    const rng = createRng(7, 0);
    let total = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) total += scaleQuantity(1, 1.25, rng);
    expect(total / runs).toBeGreaterThan(1.15);
    expect(total / runs).toBeLessThan(1.35);
  });

  it('yields either floor or floor+1, never anything else', () => {
    const rng = createRng(3, 0);
    for (let i = 0; i < 500; i++) {
      const v = scaleQuantity(3, 1.5, rng);
      expect([4, 5]).toContain(v);
    }
  });

  it('consumes exactly one draw regardless of outcome', () => {
    const rng = createRng(11, 0);
    scaleQuantity(2, 1.0, rng);
    scaleQuantity(2, 1.9, rng);
    expect(rng.cursor).toBe(2);
  });
});

describe('rollLoot', () => {
  it('is deterministic for a given seed and cursor', () => {
    const mission = MISSIONS.tuvale_thicket!;
    const a = rollLoot(mission, hero(), createRng(42, 0));
    const b = rollLoot(mission, hero(), createRng(42, 0));
    expect(a).toEqual(b);
  });

  it('consumes exactly three draws per roll', () => {
    const mission = MISSIONS.tuvale_thicket!; // rollsPerRun: 3
    const rng = createRng(42, 0);
    rollLoot(mission, hero(), rng);
    expect(rng.cursor).toBe(3 * 3);
  });

  it('never exceeds maxItemsPerRun, across many seeds', () => {
    const mission = MISSIONS.tuvale_mine!;
    const h = hero({ level: 12 });
    const ceiling = maxItemsPerRun(mission, h);
    for (let seed = 0; seed < 300; seed++) {
      const loot = rollLoot(mission, h, createRng(seed, 0));
      expect(countItems(loot)).toBeLessThanOrEqual(ceiling);
    }
  });

  it('only produces items from the mission loot table', () => {
    const mission = MISSIONS.tuvale_mine!;
    const allowed = new Set(mission.lootTable.map((e) => e.itemId));
    for (let seed = 0; seed < 100; seed++) {
      for (const stack of rollLoot(mission, hero(), createRng(seed, 0))) {
        expect(allowed.has(stack.itemId)).toBe(true);
      }
    }
  });

  it('returns merged stacks rather than duplicate entries', () => {
    const mission = MISSIONS.yarsol_ruins!; // 20 rolls, 4 entries — collisions certain
    const loot = rollLoot(mission, hero(), createRng(5, 0));
    const ids = loot.map((s) => s.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects weighting: a heavily weighted item appears far more often', () => {
    const mission = MISSIONS.tuvale_thicket!; // oak_log 50 vs copper_band 1
    const counts = new Map<string, number>();
    const rng = createRng(1, 0);
    for (let i = 0; i < 400; i++) {
      for (const stack of rollLoot(mission, hero(), rng)) {
        counts.set(stack.itemId, (counts.get(stack.itemId) ?? 0) + 1);
      }
    }
    expect(counts.get('oak_log') ?? 0).toBeGreaterThan(counts.get('copper_band') ?? 0);
  });

  it('grants more on average to a higher level hero', () => {
    const mission = MISSIONS.tuvale_mine!;
    const total = (h: Hero) => {
      const rng = createRng(9, 0);
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += countItems(rollLoot(mission, h, rng));
      return sum;
    };
    expect(total(hero({ level: 20 }))).toBeGreaterThan(total(hero({ level: 1 })));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- loot`
Expected: FAIL — cannot resolve `../../src/core/loot`.

- [ ] **Step 3: Write `src/core/loot.ts`**

```ts
import { addItems } from './pack';
import { yieldMultiplier } from './derive';
import type { Rng } from './rng';
import type { Hero, ItemStack, MissionDef, WeightedEntry } from './types';

/**
 * Probabilistic rounding. floor() alone would discard every fractional
 * gain, making the first several levels feel inert: 1 x 1.25 would stay 1
 * forever. Consumes exactly one draw whatever the outcome.
 */
export function scaleQuantity(base: number, multiplier: number, rng: Rng): number {
  const exact = base * multiplier;
  const whole = Math.floor(exact);
  const remainder = exact - whole;
  return rng.next() < remainder ? whole + 1 : whole;
}

function pickEntry(table: WeightedEntry[], roll: number): WeightedEntry {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let target = roll * total;
  let last: WeightedEntry | undefined;
  for (const entry of table) {
    last = entry;
    target -= entry.weight;
    if (target < 0) return entry;
  }
  // Only reachable through floating-point drift at the very top of the
  // range. The catalog test guarantees no table is empty.
  if (!last) throw new Error('loot table is empty');
  return last;
}

/**
 * Exactly three draws per roll, always in this order: entry, quantity,
 * rounding. A varying draw count would desynchronise a replay resumed
 * from a saved cursor.
 */
export function rollLoot(mission: MissionDef, hero: Hero, rng: Rng): ItemStack[] {
  const multiplier = yieldMultiplier(hero);
  let loot: ItemStack[] = [];

  for (let i = 0; i < mission.rollsPerRun; i++) {
    const entry = pickEntry(mission.lootTable, rng.next());
    const span = entry.maxQty - entry.minQty + 1;
    const base = entry.minQty + Math.floor(rng.next() * span);
    const qty = scaleQuantity(base, multiplier, rng);
    if (qty > 0) loot = addItems(loot, [{ itemId: entry.itemId, qty }]);
  }

  return loot;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- loot`
Expected: PASS, all twelve cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/loot.ts tests/core/loot.test.ts
git commit -m "feat: add seeded loot rolling with probabilistic yield rounding"
```

---

### Task 6: Resolution engine

**Files:**
- Create: `src/core/resolve.ts`
- Test: `tests/core/resolve.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5
- Produces: `resolveUpTo(state, now): { state: GameState; events: GameEvent[] }`

Backwards-clock handling arrives in Task 7. This task covers forward resolution only.

- [ ] **Step 1: Create the shared test fixture**

`tests/core/fixtures.ts`:

```ts
import { xpToReach } from '../../src/core/derive';
import type { GameState, Hero } from '../../src/core/types';

export const T0 = 1_700_000_000_000;

/**
 * Passing `level` alone also sets a consistent `xp`. Resolution recomputes
 * level from xp, so a hero built with level 30 and xp 0 would silently
 * collapse to level 1 on the first completion.
 */
export function testHero(overrides: Partial<Hero> = {}): Hero {
  const level = overrides.level ?? 1;
  return {
    id: 'h1', name: 'Bryn', level, xp: xpToReach(level), skills: [],
    trinket: null, pack: [], assignment: null, ...overrides,
  };
}

export function testState(overrides: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    heroes: [testHero()],
    warehouse: [],
    completions: {},
    rng: { seed: 42, cursor: 0 },
    lastResolvedAt: T0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing resolution test**

`tests/core/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { countItems } from '../../src/core/pack';
import { carryCapacity, levelFromXp } from '../../src/core/derive';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!; // 30s, 1 roll, 10 xp
const MINE = MISSIONS.tuvale_mine!;     // 1h

describe('resolveUpTo — single completion', () => {
  it('completes a run whose duration has elapsed', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.completions[GATHER.id]).toBe(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'MissionCompleted')).toBe(true);
  });

  it('does not complete a run still in flight', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs - 1);
    expect(next.completions[GATHER.id]).toBeUndefined();
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.heroes[0]!.assignment).not.toBeNull();
  });

  it('clears the assignment on a non-repeat completion without dereferencing null', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 10);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(next.completions[GATHER.id]).toBe(1); // exactly one, not ten
  });

  it('leaves a hero with no assignment untouched', () => {
    const { state: next } = resolveUpTo(testState(), T0 + 99_999_999);
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.heroes[0]!.assignment).toBeNull();
  });
});

describe('resolveUpTo — repeat across an offline gap', () => {
  it('runs exactly the number of times that fit in a nine-hour gap', () => {
    const state = testState({
      heroes: [testHero({
        level: 100, // capacity 2775, far above nine hours of hauling
        assignment: { missionId: MINE.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const nineHours = 9 * 3_600_000;
    const { state: next } = resolveUpTo(state, T0 + nineHours);
    expect(next.completions[MINE.id]).toBe(9);
    expect(next.heroes[0]!.assignment!.blockedAt).toBeNull();
  });

  it('preserves partial progress into the next resolution', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = GATHER.durationMs * 2 + 10_000;
    const { state: next } = resolveUpTo(state, T0 + gap);
    expect(next.completions[GATHER.id]).toBe(2);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0 + GATHER.durationMs * 2);
  });

  it('resolving in two hops equals resolving in one', () => {
    const make = () => testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = GATHER.durationMs * 20;
    const oneHop = resolveUpTo(make(), T0 + gap).state;
    const first = resolveUpTo(make(), T0 + gap / 2).state;
    const twoHops = resolveUpTo(first, T0 + gap).state;
    expect(twoHops.completions).toEqual(oneHop.completions);
    expect(twoHops.heroes[0]!.pack).toEqual(oneHop.heroes[0]!.pack);
    expect(twoHops.rng.cursor).toBe(oneHop.rng.cursor);
  });
});

describe('resolveUpTo — carry capacity', () => {
  it('blocks the hero once the worst-case haul no longer fits', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs * 10_000);
    expect(next.heroes[0]!.assignment!.blockedAt).not.toBeNull();
    expect(events.some((e) => e.type === 'PackFull')).toBe(true);
  });

  it('never exceeds carry capacity', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 10_000);
    const hero = next.heroes[0]!;
    // Compare against the hero's *final* capacity: they level up during
    // the gap, so a literal starting figure would be the wrong bar.
    expect(countItems(hero.pack)).toBeLessThanOrEqual(carryCapacity(hero));
  });

  it('a hero repeating one mission does eventually fill up, proving items are counted not stacks', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    // Gather drops only 2 distinct items, so it occupies at most 2 stacks
    // forever. A stack-based cap would never bind and offline accrual
    // would be unbounded.
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 100_000);
    expect(next.heroes[0]!.pack.length).toBeLessThanOrEqual(2);
    expect(next.heroes[0]!.assignment!.blockedAt).not.toBeNull();
  });

  it('skips an already-blocked hero entirely', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 100);
    expect(next.completions[GATHER.id]).toBeUndefined();
    expect(countItems(next.heroes[0]!.pack)).toBe(400);
  });
});

describe('resolveUpTo — experience', () => {
  it('grants xp and levels up when a threshold is crossed', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + GATHER.durationMs * 40);
    expect(next.heroes[0]!.xp).toBe(400);
    expect(next.heroes[0]!.level).toBe(levelFromXp(400));
    expect(events.some((e) => e.type === 'LeveledUp')).toBe(true);
  });

  it('applies a mid-gap level-up within the same resolution pass', () => {
    // A level-up raises carry capacity. Holding more than a level-1 hero
    // could ever hold proves the new level took effect during the pass,
    // not after it finished.
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const startingCapacity = carryCapacity(testHero());
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs * 5_000);
    expect(next.heroes[0]!.level).toBeGreaterThan(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(startingCapacity);
  });
});

describe('resolveUpTo — bookkeeping', () => {
  it('advances lastResolvedAt', () => {
    const { state: next } = resolveUpTo(testState(), T0 + 5_000);
    expect(next.lastResolvedAt).toBe(T0 + 5_000);
  });

  it('advances the rng cursor when loot was rolled', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.rng.cursor).toBeGreaterThan(0);
  });

  it('does not mutate the input state', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const snapshot = structuredClone(state);
    resolveUpTo(state, T0 + GATHER.durationMs);
    expect(state).toEqual(snapshot);
  });

  it('resolves each hero independently and concurrently', () => {
    const state = testState({
      heroes: [
        testHero({ id: 'a', assignment: {
          missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null } }),
        testHero({ id: 'b', assignment: {
          missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null } }),
        testHero({ id: 'c', assignment: null }),
      ],
    });
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(next.completions[GATHER.id]).toBe(2);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(countItems(next.heroes[1]!.pack)).toBeGreaterThan(0);
    expect(next.heroes[2]!.pack).toEqual([]);
  });

  it('drops an assignment referencing a mission no longer in the catalog', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: 'deleted_mission', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 + 60_000);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(events.some((e) => e.type === 'AssignmentDropped')).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -- resolve`
Expected: FAIL — cannot resolve `../../src/core/resolve`.

- [ ] **Step 4: Write `src/core/resolve.ts`**

```ts
import { getMission, maxItemsPerRun } from './catalog';
import { capacityRemaining, levelFromXp } from './derive';
import { rollLoot } from './loot';
import { addItems } from './pack';
import { createRng } from './rng';
import type { GameEvent, GameState } from './types';

/**
 * Replays everything that finished between state.lastResolvedAt and `now`.
 * Nothing ticks: eight hours closed and eight hours open are the same
 * arithmetic, so there is no second code path for offline progress.
 */
export function resolveUpTo(
  state: GameState,
  now: number,
): { state: GameState; events: GameEvent[] } {
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  const rng = createRng(s.rng.seed, s.rng.cursor);

  for (const hero of s.heroes) {
    const assignment = hero.assignment;
    if (!assignment || assignment.blockedAt !== null) continue;

    const mission = getMission(assignment.missionId);
    if (!mission) {
      hero.assignment = null;
      events.push({ type: 'AssignmentDropped', heroId: hero.id, reason: 'unknown-mission' });
      continue;
    }

    let cursor = assignment.startedAt;

    while (cursor + mission.durationMs <= now) {
      if (capacityRemaining(hero) < maxItemsPerRun(mission, hero)) {
        assignment.blockedAt = cursor;
        events.push({ type: 'PackFull', heroId: hero.id, at: cursor });
        break;
      }

      const completedAt = cursor + mission.durationMs;
      const loot = rollLoot(mission, hero, rng);
      hero.pack = addItems(hero.pack, loot);
      events.push({ type: 'LootGained', heroId: hero.id, at: completedAt, items: loot });

      const previousLevel = hero.level;
      hero.xp += mission.xpReward;
      hero.level = levelFromXp(hero.xp);
      if (hero.level > previousLevel) {
        events.push({ type: 'LeveledUp', heroId: hero.id, level: hero.level });
      }

      s.completions[mission.id] = (s.completions[mission.id] ?? 0) + 1;
      events.push({
        type: 'MissionCompleted',
        heroId: hero.id,
        missionId: mission.id,
        at: completedAt,
      });

      // Advance before the non-repeat break so the completed run's end
      // time is never misattributed to the next one.
      cursor = completedAt;
      if (!assignment.repeat) {
        hero.assignment = null;
        break;
      }
    }

    // Guarded: a non-repeat completion cleared the assignment above, and
    // an unconditional write would dereference null.
    if (hero.assignment) hero.assignment.startedAt = cursor;
  }

  s.rng.cursor = rng.cursor;
  s.lastResolvedAt = now;
  return { state: s, events };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- resolve`
Expected: PASS, all seventeen cases.

- [ ] **Step 6: Commit**

```bash
git add src/core/resolve.ts tests/core/resolve.test.ts tests/core/fixtures.ts
git commit -m "feat: add timestamp-derived resolution engine with capacity blocking"
```

---

### Task 7: Backwards-clock handling

**Files:**
- Modify: `src/core/resolve.ts`
- Test: `tests/core/resolve-clock.test.ts`

**Interfaces:**
- Consumes: `resolveUpTo` from Task 6
- Produces: no new exports; `resolveUpTo` gains its backwards-clock branch

- [ ] **Step 1: Write the failing test**

`tests/core/resolve-clock.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('resolveUpTo — clock moved backwards', () => {
  it('grants nothing when now precedes lastResolvedAt', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0 - 60_000, repeat: true, blockedAt: null },
      })],
    });
    const { state: next, events } = resolveUpTo(state, T0 - 100_000);
    expect(next.completions).toEqual({});
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(events.some((e) => e.type === 'ClockRewound')).toBe(true);
  });

  it('rewinds lastResolvedAt to the corrected time', () => {
    const { state: next } = resolveUpTo(testState(), T0 - 100_000);
    expect(next.lastResolvedAt).toBe(T0 - 100_000);
  });

  it('clamps a future startedAt so the hero is not frozen until real time catches up', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0);
  });

  it('clamps a future blockedAt as well', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: farFuture },
      })],
    });
    const { state: next } = resolveUpTo(state, T0);
    expect(next.heroes[0]!.assignment!.blockedAt).toBe(T0);
  });

  it('leaves a past startedAt alone', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0 - 500_000, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = resolveUpTo(state, T0 - 100_000);
    expect(next.heroes[0]!.assignment!.startedAt).toBe(T0 - 500_000);
  });

  it('a clamped hero resumes on the next forward resolution instead of stalling', () => {
    const farFuture = T0 + 365 * 24 * 3_600_000;
    const state = testState({
      lastResolvedAt: farFuture,
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: farFuture, repeat: true, blockedAt: null },
      })],
    });
    const corrected = resolveUpTo(state, T0).state;
    const { state: next } = resolveUpTo(corrected, T0 + GATHER.durationMs * 3);
    expect(next.completions[GATHER.id]).toBe(3);
  });

  it('does not advance the rng cursor on a rewind', () => {
    const state = testState({ rng: { seed: 42, cursor: 17 } });
    const { state: next } = resolveUpTo(state, T0 - 1);
    expect(next.rng.cursor).toBe(17);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- resolve-clock`
Expected: FAIL — no `ClockRewound` event and `startedAt` is not clamped.

- [ ] **Step 3: Add the branch to `src/core/resolve.ts`**

Insert immediately after `const events: GameEvent[] = [];` and before the `createRng` line:

```ts
  // A backwards clock (NTP correction, or the user changing system time)
  // must grant nothing. Clamping lastResolvedAt alone is not enough: a
  // hero dispatched while the clock was set ahead carries a future
  // startedAt, and would sit inert until real time caught up — potentially
  // for months. Clamp the assignments too, so the run restarts from the
  // corrected present rather than granting time that never passed.
  if (now < s.lastResolvedAt) {
    for (const hero of s.heroes) {
      const assignment = hero.assignment;
      if (!assignment) continue;
      assignment.startedAt = Math.min(assignment.startedAt, now);
      if (assignment.blockedAt !== null) {
        assignment.blockedAt = Math.min(assignment.blockedAt, now);
      }
    }
    s.lastResolvedAt = now;
    events.push({ type: 'ClockRewound', to: now });
    return { state: s, events };
  }
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. Confirm Task 6's tests still pass — the new branch must not affect forward resolution.

- [ ] **Step 5: Commit**

```bash
git add src/core/resolve.ts tests/core/resolve-clock.test.ts
git commit -m "fix: clamp future assignment timestamps when the clock moves backwards"
```

---

### Task 8: Mission unlocks

**Files:**
- Create: `src/core/unlocks.ts`
- Test: `tests/core/unlocks.test.ts`

**Interfaces:**
- Consumes: `MISSIONS` from `catalog.ts`; `GameState`, `MissionDef`, `MissionId` from `types.ts`
- Produces: `isUnlocked(missionId, completions): boolean`, `availableMissions(state): MissionDef[]`

- [ ] **Step 1: Write the failing test**

`tests/core/unlocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { availableMissions, isUnlocked } from '../../src/core/unlocks';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('isUnlocked', () => {
  it('unlocks a mission that requires nothing', () => {
    expect(isUnlocked('tuvale_gather', {})).toBe(true);
  });

  it('locks a mission whose prerequisite is uncompleted', () => {
    expect(isUnlocked('tuvale_thicket', {})).toBe(false);
  });

  it('unlocks once the prerequisite has one completion', () => {
    expect(isUnlocked('tuvale_thicket', { tuvale_gather: 1 })).toBe(true);
  });

  it('treats a zero count as uncompleted', () => {
    expect(isUnlocked('tuvale_thicket', { tuvale_gather: 0 })).toBe(false);
  });

  it('returns false for an unknown mission id', () => {
    expect(isUnlocked('nonexistent', {})).toBe(false);
  });
});

describe('availableMissions', () => {
  it('starts with only the no-prerequisite missions', () => {
    const ids = availableMissions(testState()).map((m) => m.id);
    expect(ids).toEqual(['tuvale_gather']);
  });

  it('grows as completions accumulate', () => {
    const state = testState({ completions: { tuvale_gather: 1 } });
    const ids = availableMissions(state).map((m) => m.id);
    expect(ids).toContain('tuvale_thicket');
  });

  it('ignores stale completion keys for missions no longer in the catalog', () => {
    const state = testState({ completions: { deleted_mission: 5 } });
    expect(() => availableMissions(state)).not.toThrow();
    expect(availableMissions(state).map((m) => m.id)).toEqual(['tuvale_gather']);
  });

  it('a completion during resolution unlocks the next mission', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    expect(availableMissions(state).map((m) => m.id)).not.toContain('tuvale_thicket');
    const { state: next } = resolveUpTo(state, T0 + GATHER.durationMs);
    expect(availableMissions(next).map((m) => m.id)).toContain('tuvale_thicket');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- unlocks`
Expected: FAIL — cannot resolve `../../src/core/unlocks`.

- [ ] **Step 3: Write `src/core/unlocks.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- unlocks`
Expected: PASS, all nine cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/unlocks.ts tests/core/unlocks.test.ts
git commit -m "feat: gate mission availability on prior completions"
```

---

### Task 9: Commands

**Files:**
- Create: `src/core/commands.ts`
- Test: `tests/core/commands.test.ts`

**Interfaces:**
- Consumes: `resolveUpTo`, `addItems`, `takeItem`, `getItem`, `isUnlocked`
- Produces: `Command` union and `applyCommand(state, cmd, now): { state: GameState; events: GameEvent[] }`

- [ ] **Step 1: Write the failing test**

`tests/core/commands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyCommand } from '../../src/core/commands';
import { MISSIONS } from '../../src/core/catalog';
import { countItems } from '../../src/core/pack';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

describe('dispatch', () => {
  it('assigns an unlocked mission starting now', () => {
    const { state } = applyCommand(
      testState(),
      { type: 'dispatch', heroId: 'h1', missionId: GATHER.id, repeat: true },
      T0,
    );
    expect(state.heroes[0]!.assignment).toEqual({
      missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null,
    });
  });

  it('refuses a locked mission', () => {
    const { state } = applyCommand(
      testState(),
      { type: 'dispatch', heroId: 'h1', missionId: 'tuvale_thicket', repeat: false },
      T0,
    );
    expect(state.heroes[0]!.assignment).toBeNull();
  });

  it('refuses an unknown hero without throwing', () => {
    expect(() =>
      applyCommand(
        testState(),
        { type: 'dispatch', heroId: 'ghost', missionId: GATHER.id, repeat: false },
        T0,
      ),
    ).not.toThrow();
  });

  it('resolves outstanding time before assigning', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: false, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(
      state,
      { type: 'dispatch', heroId: 'h1', missionId: GATHER.id, repeat: true },
      T0 + GATHER.durationMs,
    );
    // The finished run banked its loot before the new dispatch replaced it.
    expect(next.completions[GATHER.id]).toBe(1);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
  });
});

describe('recall', () => {
  it('keeps completed runs and discards only the partial one', () => {
    const state = testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(
      state,
      { type: 'recall', heroId: 'h1' },
      T0 + GATHER.durationMs * 3 + 5_000,
    );
    expect(next.completions[GATHER.id]).toBe(3);
    expect(countItems(next.heroes[0]!.pack)).toBeGreaterThan(0);
    expect(next.heroes[0]!.assignment).toBeNull();
  });
});

describe('collect', () => {
  it('moves the pack into the warehouse', () => {
    const state = testState({
      heroes: [testHero({ pack: [{ itemId: 'copper_ore', qty: 7 }] })],
    });
    const { state: next, events } = applyCommand(state, { type: 'collect', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.pack).toEqual([]);
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 7 }]);
    expect(events.some((e) => e.type === 'Collected')).toBe(true);
  });

  it('merges into an existing warehouse stack', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 3 }],
      heroes: [testHero({ pack: [{ itemId: 'copper_ore', qty: 7 }] })],
    });
    const { state: next } = applyCommand(state, { type: 'collect', heroId: 'h1' }, T0);
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 10 }]);
  });

  it('unblocks a blocked hero and restarts the run from now', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const sixHoursLater = T0 + 6 * 3_600_000;
    const { state: next } = applyCommand(state, { type: 'collect', heroId: 'h1' }, sixHoursLater);
    expect(next.heroes[0]!.assignment!.blockedAt).toBeNull();
    expect(next.heroes[0]!.assignment!.startedAt).toBe(sixHoursLater);
    // Idle hours are not retroactively converted into completions.
    expect(next.completions[GATHER.id]).toBeUndefined();
  });
});

describe('collectAll', () => {
  it('empties every hero pack in one operation', () => {
    const state = testState({
      heroes: [
        testHero({ id: 'a', pack: [{ itemId: 'copper_ore', qty: 2 }] }),
        testHero({ id: 'b', pack: [{ itemId: 'oak_log', qty: 4 }] }),
        testHero({ id: 'c', pack: [] }),
      ],
    });
    const { state: next } = applyCommand(state, { type: 'collectAll' }, T0);
    expect(next.heroes.every((h) => h.pack.length === 0)).toBe(true);
    expect(countItems(next.warehouse)).toBe(6);
  });
});

describe('toggleRepeat', () => {
  it('flips the flag on an active assignment', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const { state: next } = applyCommand(state, { type: 'toggleRepeat', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.assignment!.repeat).toBe(false);
  });

  it('clears the assignment when switched off on a blocked hero, preserving the pack', () => {
    const state = testState({
      heroes: [testHero({
        pack: [{ itemId: 'copper_ore', qty: 400 }],
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: T0 },
      })],
    });
    const { state: next } = applyCommand(state, { type: 'toggleRepeat', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.assignment).toBeNull();
    expect(countItems(next.heroes[0]!.pack)).toBe(400);
  });
});

describe('equip / unequip', () => {
  it('moves a trinket out of the warehouse onto the hero', () => {
    const state = testState({ warehouse: [{ itemId: 'jade_charm', qty: 1 }] });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBe('jade_charm');
    expect(next.warehouse).toEqual([]);
  });

  it('returns a displaced trinket to the warehouse in the same operation', () => {
    const state = testState({
      warehouse: [{ itemId: 'jade_charm', qty: 1 }],
      heroes: [testHero({ trinket: 'copper_band' })],
    });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBe('jade_charm');
    expect(next.warehouse).toEqual([{ itemId: 'copper_band', qty: 1 }]);
  });

  it('refuses to equip an item absent from the warehouse', () => {
    const { state } = applyCommand(
      testState(), { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(state.heroes[0]!.trinket).toBeNull();
  });

  it('refuses to equip a material', () => {
    const state = testState({ warehouse: [{ itemId: 'copper_ore', qty: 5 }] });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'copper_ore' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBeNull();
    expect(next.warehouse).toEqual([{ itemId: 'copper_ore', qty: 5 }]);
  });

  it('cannot equip from a pack — the item must be collected first', () => {
    const state = testState({
      heroes: [testHero({ pack: [{ itemId: 'jade_charm', qty: 1 }] })],
    });
    const { state: next } = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'jade_charm' }, T0,
    );
    expect(next.heroes[0]!.trinket).toBeNull();
  });

  it('returns the trinket to the warehouse on unequip', () => {
    const state = testState({ heroes: [testHero({ trinket: 'jade_charm' })] });
    const { state: next } = applyCommand(state, { type: 'unequip', heroId: 'h1' }, T0);
    expect(next.heroes[0]!.trinket).toBeNull();
    expect(next.warehouse).toEqual([{ itemId: 'jade_charm', qty: 1 }]);
  });

  it('never applies retroactively to loot already resolved from a gap', () => {
    const state = testState({
      warehouse: [{ itemId: 'gilded_signet', qty: 1 }],
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = T0 + GATHER.durationMs * 5;

    const resolvedFirst = applyCommand(state, { type: 'unequip', heroId: 'h1' }, gap).state;
    const equippedAfter = applyCommand(
      state, { type: 'equip', heroId: 'h1', itemId: 'gilded_signet' }, gap,
    ).state;

    // Both resolve the same gap before the command lands, so the loot from
    // that gap is identical; only future runs differ.
    expect(equippedAfter.heroes[0]!.pack).toEqual(resolvedFirst.heroes[0]!.pack);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- commands`
Expected: FAIL — cannot resolve `../../src/core/commands`.

- [ ] **Step 3: Write `src/core/commands.ts`**

```ts
import { getItem } from './catalog';
import { addItems, takeItem } from './pack';
import { resolveUpTo } from './resolve';
import { isUnlocked } from './unlocks';
import type { GameEvent, GameState, HeroId, ItemId, MissionId } from './types';

export type Command =
  | { type: 'dispatch'; heroId: HeroId; missionId: MissionId; repeat: boolean }
  | { type: 'toggleRepeat'; heroId: HeroId }
  | { type: 'recall'; heroId: HeroId }
  | { type: 'collect'; heroId: HeroId }
  | { type: 'collectAll' }
  | { type: 'equip'; heroId: HeroId; itemId: ItemId }
  | { type: 'unequip'; heroId: HeroId };

/**
 * Every command resolves to `now` before it applies. A command can never
 * act on a stale world — which is also why recall is never destructive
 * and equip is never retroactive.
 */
export function applyCommand(
  state: GameState,
  cmd: Command,
  now: number,
): { state: GameState; events: GameEvent[] } {
  const resolved = resolveUpTo(state, now);
  const s = resolved.state;
  const events = [...resolved.events];

  const heroOf = (id: HeroId) => s.heroes.find((h) => h.id === id);

  switch (cmd.type) {
    case 'dispatch': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      if (!isUnlocked(cmd.missionId, s.completions)) break;
      hero.assignment = {
        missionId: cmd.missionId,
        startedAt: now,
        repeat: cmd.repeat,
        blockedAt: null,
      };
      break;
    }

    case 'toggleRepeat': {
      const hero = heroOf(cmd.heroId);
      const assignment = hero?.assignment;
      if (!hero || !assignment) break;
      assignment.repeat = !assignment.repeat;
      // A blocked hero has no run in flight, so there is no partial
      // progress to preserve and a dead assignment would only confuse.
      if (!assignment.repeat && assignment.blockedAt !== null) hero.assignment = null;
      break;
    }

    case 'recall': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      hero.assignment = null;
      break;
    }

    case 'collect': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      collectFrom(s, cmd.heroId, now, events);
      break;
    }

    case 'collectAll': {
      for (const hero of s.heroes) collectFrom(s, hero.id, now, events);
      break;
    }

    case 'equip': {
      const hero = heroOf(cmd.heroId);
      if (!hero) break;
      if (getItem(cmd.itemId)?.kind !== 'trinket') break;
      const remaining = takeItem(s.warehouse, cmd.itemId, 1);
      if (!remaining) break; // not in the warehouse; packs must be collected first
      s.warehouse = remaining;
      if (hero.trinket) s.warehouse = addItems(s.warehouse, [{ itemId: hero.trinket, qty: 1 }]);
      hero.trinket = cmd.itemId;
      break;
    }

    case 'unequip': {
      const hero = heroOf(cmd.heroId);
      if (!hero?.trinket) break;
      s.warehouse = addItems(s.warehouse, [{ itemId: hero.trinket, qty: 1 }]);
      hero.trinket = null;
      break;
    }
  }

  return { state: s, events };
}

function collectFrom(
  s: GameState,
  heroId: HeroId,
  now: number,
  events: GameEvent[],
): void {
  const hero = s.heroes.find((h) => h.id === heroId);
  if (!hero || hero.pack.length === 0) return;

  const collected = hero.pack;
  s.warehouse = addItems(s.warehouse, collected);
  hero.pack = [];
  events.push({ type: 'Collected', heroId, items: collected });

  if (hero.assignment) {
    // Restart from now: a hero who stood idle with a full pack must not
    // instantly bank the missions they never ran while blocked.
    hero.assignment.blockedAt = null;
    hero.assignment.startedAt = now;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- commands`
Expected: PASS, all eighteen cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/commands.ts tests/core/commands.test.ts
git commit -m "feat: add player commands with resolve-before-apply invariant"
```

---

### Task 10: Starting state and persistence

**Files:**
- Create: `src/core/newGame.ts`, `src/core/persistence.ts`
- Test: `tests/core/persistence.test.ts`

**Interfaces:**
- Consumes: `GameState` from `types.ts`; `MISSIONS`, `ITEMS` from `catalog.ts`
- Produces:
  - `newGame.ts`: `HERO_COUNT: number`, `newGame(seed: number): GameState`, `CURRENT_VERSION: number`
  - `persistence.ts`: `Storage` interface, `SAVE_KEY`, `BACKUP_KEY`, `save(storage, state)`, `load(storage, seed): { state: GameState; recovered: boolean }`, `sanitize(state): GameState`

- [ ] **Step 1: Write the failing test**

`tests/core/persistence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BACKUP_KEY, SAVE_KEY, load, sanitize, save, type Storage,
} from '../../src/core/persistence';
import { CURRENT_VERSION, HERO_COUNT, newGame } from '../../src/core/newGame';
import { resolveUpTo } from '../../src/core/resolve';
import { MISSIONS } from '../../src/core/catalog';
import { T0, testHero, testState } from './fixtures';

const GATHER = MISSIONS.tuvale_gather!;

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('newGame', () => {
  it('creates the configured roster with no assignments', () => {
    const state = newGame(1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(state.heroes.every((h) => h.assignment === null)).toBe(true);
    expect(state.heroes.every((h) => h.level === 1 && h.xp === 0)).toBe(true);
  });

  it('gives every hero a distinct id', () => {
    const ids = new Set(newGame(1).heroes.map((h) => h.id));
    expect(ids.size).toBe(HERO_COUNT);
  });

  it('stamps the current version', () => {
    expect(newGame(1).version).toBe(CURRENT_VERSION);
  });
});

describe('save and load round-trip', () => {
  it('restores an equivalent state', () => {
    const storage = memoryStorage();
    const original = testState({ completions: { tuvale_gather: 3 } });
    save(storage, original);
    const { state, recovered } = load(storage, 1);
    expect(recovered).toBe(false);
    expect(state).toEqual(original);
  });

  it('reproduces identical resolution results after a reload', () => {
    const storage = memoryStorage();
    const original = testState({
      heroes: [testHero({
        level: 30,
        assignment: { missionId: GATHER.id, startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const gap = T0 + GATHER.durationMs * 12;

    const direct = resolveUpTo(original, gap).state;
    save(storage, original);
    const reloaded = resolveUpTo(load(storage, 1).state, gap).state;

    expect(reloaded.heroes[0]!.pack).toEqual(direct.heroes[0]!.pack);
    expect(reloaded.rng.cursor).toBe(direct.rng.cursor);
  });

  it('preserves the rng cursor so a reload does not reroll', () => {
    const storage = memoryStorage();
    save(storage, testState({ rng: { seed: 42, cursor: 137 } }));
    expect(load(storage, 1).state.rng.cursor).toBe(137);
  });
});

describe('load failure modes', () => {
  it('falls back to a fresh game when nothing is stored', () => {
    const { state, recovered } = load(memoryStorage(), 1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(recovered).toBe(false);
  });

  it('falls back to a fresh game on unparseable json and flags recovery', () => {
    const { state, recovered } = load(memoryStorage({ [SAVE_KEY]: '{not json' }), 1);
    expect(state.heroes).toHaveLength(HERO_COUNT);
    expect(recovered).toBe(true);
  });

  it('preserves the unreadable save under the backup key rather than overwriting it', () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{not json' });
    load(storage, 1);
    expect(storage.getItem(BACKUP_KEY)).toBe('{not json');
  });

  it('refuses a save newer than the running code', () => {
    const future = JSON.stringify({ ...testState(), version: CURRENT_VERSION + 1 });
    const { state, recovered } = load(memoryStorage({ [SAVE_KEY]: future }), 1);
    expect(state.version).toBe(CURRENT_VERSION);
    expect(recovered).toBe(true);
  });

  it('rejects a structurally invalid save', () => {
    const bad = JSON.stringify({ version: CURRENT_VERSION, heroes: 'not an array' });
    expect(load(memoryStorage({ [SAVE_KEY]: bad }), 1).recovered).toBe(true);
  });
});

describe('sanitize', () => {
  it('drops an assignment naming a mission no longer in the catalog', () => {
    const state = testState({
      heroes: [testHero({
        assignment: { missionId: 'deleted', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    expect(sanitize(state).heroes[0]!.assignment).toBeNull();
  });

  it('keeps the hero and the warehouse when dropping an assignment', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 9 }],
      heroes: [testHero({
        pack: [{ itemId: 'oak_log', qty: 2 }],
        assignment: { missionId: 'deleted', startedAt: T0, repeat: true, blockedAt: null },
      })],
    });
    const clean = sanitize(state);
    expect(clean.warehouse).toEqual([{ itemId: 'copper_ore', qty: 9 }]);
    expect(clean.heroes[0]!.pack).toEqual([{ itemId: 'oak_log', qty: 2 }]);
  });

  it('drops stacks of items no longer in the catalog', () => {
    const state = testState({
      warehouse: [{ itemId: 'copper_ore', qty: 1 }, { itemId: 'deleted_item', qty: 4 }],
    });
    expect(sanitize(state).warehouse).toEqual([{ itemId: 'copper_ore', qty: 1 }]);
  });

  it('unequips a trinket no longer in the catalog', () => {
    const state = testState({ heroes: [testHero({ trinket: 'deleted_item' })] });
    expect(sanitize(state).heroes[0]!.trinket).toBeNull();
  });

  it('leaves stale completion keys alone, since pruning could retract an earned unlock', () => {
    const state = testState({ completions: { deleted: 3, tuvale_gather: 1 } });
    expect(sanitize(state).completions).toEqual({ deleted: 3, tuvale_gather: 1 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- persistence`
Expected: FAIL — cannot resolve `../../src/core/persistence`.

- [ ] **Step 3: Write `src/core/newGame.ts`**

```ts
import type { GameState, Hero } from './types';

export const CURRENT_VERSION = 1;

/**
 * A placeholder, not a decision. The right roster size is a feel question
 * that cannot be answered before the loop is playable.
 */
export const HERO_COUNT = 3;

const NAMES = ['Bryn', 'Corvin', 'Maela', 'Toller', 'Isolde'];

function makeHero(index: number): Hero {
  return {
    id: `hero_${index + 1}`,
    name: NAMES[index] ?? `Hero ${index + 1}`,
    level: 1,
    xp: 0,
    skills: [],
    trinket: null,
    pack: [],
    assignment: null,
  };
}

export function newGame(seed: number, startedAt = 0): GameState {
  return {
    version: CURRENT_VERSION,
    heroes: Array.from({ length: HERO_COUNT }, (_, i) => makeHero(i)),
    warehouse: [],
    completions: {},
    rng: { seed, cursor: 0 },
    lastResolvedAt: startedAt,
  };
}
```

- [ ] **Step 4: Write `src/core/persistence.ts`**

```ts
import { getItem, getMission } from './catalog';
import { CURRENT_VERSION, newGame } from './newGame';
import type { GameState } from './types';

export const SAVE_KEY = 'merchantnext.save.v1';
export const BACKUP_KEY = 'merchantnext.save.backup';

/** Injected rather than reaching for the global, so core stays pure. */
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function save(storage: Storage, state: GameState): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

function looksLikeGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.version === 'number' &&
    Array.isArray(s.heroes) &&
    Array.isArray(s.warehouse) &&
    typeof s.completions === 'object' && s.completions !== null &&
    typeof s.rng === 'object' && s.rng !== null &&
    typeof s.rng.seed === 'number' && typeof s.rng.cursor === 'number' &&
    typeof s.lastResolvedAt === 'number'
  );
}

/**
 * Removes references to catalog entries that no longer exist. Completion
 * counts are deliberately left alone: they are inert, and pruning them
 * could retract an unlock the player already earned.
 */
export function sanitize(state: GameState): GameState {
  const s = structuredClone(state);

  s.warehouse = s.warehouse.filter((stack) => getItem(stack.itemId) !== undefined);

  for (const hero of s.heroes) {
    hero.pack = hero.pack.filter((stack) => getItem(stack.itemId) !== undefined);
    if (hero.trinket && !getItem(hero.trinket)) hero.trinket = null;
    if (hero.assignment && !getMission(hero.assignment.missionId)) hero.assignment = null;
  }

  return s;
}

export function load(
  storage: Storage,
  seed: number,
): { state: GameState; recovered: boolean } {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { state: newGame(seed), recovered: false };

  const quarantine = (): { state: GameState; recovered: boolean } => {
    storage.setItem(BACKUP_KEY, raw);
    return { state: newGame(seed), recovered: true };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return quarantine();
  }

  if (!looksLikeGameState(parsed)) return quarantine();
  // A save from a newer build may contain fields this code cannot honour.
  if (parsed.version > CURRENT_VERSION) return quarantine();
  // Migration chain for older versions goes here as versions accrue.

  return { state: sanitize(parsed), recovered: false };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- persistence`
Expected: PASS, all sixteen cases.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: everything green.

- [ ] **Step 7: Commit**

```bash
git add src/core/newGame.ts src/core/persistence.ts tests/core/persistence.test.ts
git commit -m "feat: add starting state and resilient localStorage persistence"
```

---

### Task 11: React binding

**Files:**
- Create: `src/ui/useGame.ts`
- Test: `tests/core/format.test.ts`
- Create: `src/ui/format.ts`

**Interfaces:**
- Consumes: `load`, `save` from `persistence.ts`; `applyCommand`, `Command` from `commands.ts`; `resolveUpTo`; `systemClock`
- Produces:
  - `format.ts`: `formatDuration(ms): string`, `missionProgress(startedAt, durationMs, now): number`
  - `useGame.ts`: `useGame(): { state, run, welcomeBack, dismissWelcome, now }`

`format.ts` lives in `ui/` but is pure, so it is unit tested alongside core.

- [ ] **Step 1: Write the failing format test**

`tests/core/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatDuration, missionProgress } from '../../src/ui/format';

describe('formatDuration', () => {
  it('renders seconds', () => expect(formatDuration(30_000)).toBe('30s'));
  it('renders minutes and seconds', () => expect(formatDuration(305_000)).toBe('5m 5s'));
  it('renders hours and minutes', () => expect(formatDuration(3_900_000)).toBe('1h 5m'));
  it('renders long spans', () => expect(formatDuration(28_800_000)).toBe('8h 0m'));
  it('clamps negatives to zero', () => expect(formatDuration(-5)).toBe('0s'));
});

describe('missionProgress', () => {
  it('is 0 at the start', () => expect(missionProgress(100, 50, 100)).toBe(0));
  it('is 0.5 halfway', () => expect(missionProgress(100, 50, 125)).toBe(0.5));
  it('clamps to 1 past the end', () => expect(missionProgress(100, 50, 999)).toBe(1));
  it('clamps to 0 before the start', () => expect(missionProgress(100, 50, 0)).toBe(0));
  it('is 1 for a zero duration rather than dividing by zero', () => {
    expect(missionProgress(100, 0, 100)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- format`
Expected: FAIL — cannot resolve `../../src/ui/format`.

- [ ] **Step 3: Write `src/ui/format.ts`**

```ts
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function missionProgress(
  startedAt: number,
  durationMs: number,
  now: number,
): number {
  if (durationMs <= 0) return 1;
  const elapsed = now - startedAt;
  return Math.min(1, Math.max(0, elapsed / durationMs));
}
```

- [ ] **Step 4: Run the format tests**

Run: `npm test -- format`
Expected: PASS, all ten cases.

- [ ] **Step 5: Write `src/ui/useGame.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyCommand, type Command } from '../core/commands';
import { resolveUpTo } from '../core/resolve';
import { load, save, type Storage } from '../core/persistence';
import { systemClock } from '../core/clock';
import type { GameEvent, GameState } from '../core/types';

const RENDER_INTERVAL_MS = 500;
const SAVE_DEBOUNCE_MS = 1_000;

function browserStorage(): Storage {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
  };
}

export interface Game {
  state: GameState;
  now: number;
  welcomeBack: GameEvent[] | null;
  dismissWelcome(): void;
  run(cmd: Command): void;
}

export function useGame(storage: Storage = browserStorage()): Game {
  const [boot] = useState(() => {
    const loaded = load(storage, Math.floor(Math.random() * 2 ** 31));
    // The boot resolution is what the welcome-back summary reports.
    return resolveUpTo(loaded.state, systemClock.now());
  });

  const [state, setState] = useState<GameState>(boot.state);
  const [now, setNow] = useState(() => systemClock.now());
  const [welcomeBack, setWelcomeBack] = useState<GameEvent[] | null>(
    boot.events.length > 0 ? boot.events : null,
  );

  // Re-derive on an interval. This drives progress bars and picks up
  // completions; it is a display concern, never a source of truth.
  useEffect(() => {
    const id = setInterval(() => {
      const t = systemClock.now();
      setNow(t);
      setState((prev) => resolveUpTo(prev, t).state);
    }, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(storage, state), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, storage]);

  const run = useCallback((cmd: Command) => {
    setState((prev) => applyCommand(prev, cmd, systemClock.now()).state);
  }, []);

  const dismissWelcome = useCallback(() => setWelcomeBack(null), []);

  return { state, now, welcomeBack, dismissWelcome, run };
}
```

- [ ] **Step 6: Verify types compile**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: everything green, including the purity guard (`useGame.ts` is in `ui/`, so its `window` usage is allowed).

- [ ] **Step 8: Commit**

```bash
git add src/ui/format.ts src/ui/useGame.ts tests/core/format.test.ts
git commit -m "feat: add React game binding with render interval and debounced autosave"
```

---

### Task 12: UI components

**Files:**
- Create: `src/ui/HeroCard.tsx`, `src/ui/MissionList.tsx`, `src/ui/Warehouse.tsx`, `src/ui/WelcomeBack.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`
- Modify: `src/ui/main.tsx`

**Interfaces:**
- Consumes: `useGame`, `formatDuration`, `missionProgress`, `availableMissions`, `getItem`, `getMission`, `carryCapacity`, `capacityRemaining`, `countItems`
- Produces: a rendered app. `data-testid` attributes are the contract Task 13 depends on: `hero-card`, `hero-name`, `hero-status`, `hero-pack`, `dispatch-<missionId>`, `collect-all`, `warehouse-total`, `welcome-back`.

- [ ] **Step 1: Write `src/ui/WelcomeBack.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `src/ui/HeroCard.tsx`**

```tsx
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
```

- [ ] **Step 3: Write `src/ui/MissionList.tsx`**

```tsx
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
```

- [ ] **Step 4: Write `src/ui/Warehouse.tsx`**

```tsx
import { getItem } from '../core/catalog';
import { countItems } from '../core/pack';
import type { Command } from '../core/commands';
import type { GameState } from '../core/types';

export function Warehouse({
  state,
  run,
}: {
  state: GameState;
  run: (cmd: Command) => void;
}) {
  return (
    <section className="warehouse">
      <h2>Warehouse</h2>
      <p data-testid="warehouse-total">{countItems(state.warehouse)} items</p>

      <ul>
        {state.warehouse.map((stack) => {
          const def = getItem(stack.itemId);
          if (!def) return null;
          return (
            <li key={stack.itemId} data-testid={`warehouse-${stack.itemId}`}>
              {def.name} x{stack.qty}
              <span className="value"> ({def.baseValue}g each)</span>
              {def.kind === 'trinket' && (
                <button
                  onClick={() =>
                    run({
                      type: 'equip',
                      heroId: state.heroes[0]!.id,
                      itemId: stack.itemId,
                    })
                  }
                >
                  Equip to {state.heroes[0]!.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Write `src/ui/App.tsx` and `src/ui/styles.css`**

`src/ui/App.tsx`:

```tsx
import { useState } from 'react';
import { HeroCard } from './HeroCard';
import { MissionList } from './MissionList';
import { Warehouse } from './Warehouse';
import { WelcomeBack } from './WelcomeBack';
import { useGame } from './useGame';
import './styles.css';

export function App() {
  const { state, now, welcomeBack, dismissWelcome, run } = useGame();
  const [selectedHeroId, setSelectedHeroId] = useState(state.heroes[0]!.id);

  return (
    <main className="app">
      <h1>MerchantNext</h1>

      {welcomeBack && <WelcomeBack events={welcomeBack} onDismiss={dismissWelcome} />}

      <button data-testid="collect-all" onClick={() => run({ type: 'collectAll' })}>
        Collect all
      </button>

      <section className="heroes">
        {state.heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} now={now} run={run} />
        ))}
      </section>

      <MissionList
        state={state}
        selectedHeroId={selectedHeroId}
        onSelectHero={setSelectedHeroId}
        run={run}
      />

      <Warehouse state={state} run={run} />
    </main>
  );
}
```

`src/ui/styles.css`:

```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
.app { max-width: 60rem; margin: 0 auto; padding: 1.5rem; }
.heroes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.hero-card { border: 1px solid currentColor; border-radius: 0.5rem; padding: 1rem; }
.hero-card header { display: flex; justify-content: space-between; }
.bar { height: 0.5rem; background: rgba(127, 127, 127, 0.3); border-radius: 0.25rem; overflow: hidden; }
.bar-fill { height: 100%; background: currentColor; transition: width 0.4s linear; }
.actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
.missions ul, .warehouse ul { list-style: none; padding: 0; }
.missions li { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; }
.welcome { border: 1px solid currentColor; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
.value { opacity: 0.7; font-size: 0.9em; }
```

- [ ] **Step 6: Update `src/ui/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Verify the build and run manually**

Run: `npm run build`
Expected: no type errors.

Run: `npm run dev`, open the printed URL, dispatch a hero on "Gather by the Roadside", wait 30 seconds, confirm the progress bar fills, loot lands in the pack, and Collect moves it to the warehouse.

- [ ] **Step 8: Commit**

```bash
git add src/ui tests
git commit -m "feat: add hero, mission, warehouse, and welcome-back UI"
```

---

### Task 13: End-to-end test

**Files:**
- Create: `tests/e2e/loop.spec.ts`

**Interfaces:**
- Consumes: the `data-testid` attributes from Task 12; `SAVE_KEY` from `persistence.ts`

**Why this seeds `localStorage` rather than waiting.** The shortest mission is 30 seconds and the longest is 8 hours, so waiting for real completions would make the suite unusable. Planting a save whose `startedAt` lies in the past exercises the genuine boot-resolution path — the same code an eight-hour absence takes — in milliseconds, and needs no test-only hooks in production code.

- [ ] **Step 1: Write the E2E test**

`tests/e2e/loop.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const SAVE_KEY = 'merchantnext.save.v1';
const HOUR = 3_600_000;

function saveWithHeroDispatched(startedAgoMs: number) {
  return {
    version: 1,
    heroes: [
      {
        id: 'hero_1', name: 'Bryn', level: 1, xp: 0, skills: [],
        trinket: null, pack: [],
        assignment: {
          missionId: 'tuvale_gather',
          startedAt: Date.now() - startedAgoMs,
          repeat: true,
          blockedAt: null,
        },
      },
      { id: 'hero_2', name: 'Corvin', level: 1, xp: 0, skills: [],
        trinket: null, pack: [], assignment: null },
      { id: 'hero_3', name: 'Maela', level: 1, xp: 0, skills: [],
        trinket: null, pack: [], assignment: null },
    ],
    warehouse: [],
    completions: {},
    rng: { seed: 12345, cursor: 0 },
    lastResolvedAt: Date.now() - startedAgoMs,
  };
}

test('a fresh game shows three idle heroes and only the starting mission', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('hero-status').first()).toHaveText('Idle');
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('dispatch-tuvale_thicket')).toHaveCount(0);
});

test('dispatching a hero puts them to work', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dispatch-tuvale_gather').click();
  await expect(page.getByTestId('hero-status').first()).toContainText('Gather by the Roadside');
  await expect(page.getByTestId('hero-status').first()).toContainText('left');
});

test('an offline gap resolves on boot and collects to the warehouse', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key as string, save as string),
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');

  // The boot resolution reports the absence.
  await expect(page.getByTestId('welcome-back')).toBeVisible();
  await expect(page.getByTestId('welcome-back')).toContainText('missions completed');

  // The hero holds loot and has stopped with a full pack.
  await expect(page.getByTestId('hero-pack').first()).not.toContainText('Pack 0 /');

  await page.getByTestId('collect-all').click();
  await expect(page.getByTestId('hero-pack').first()).toContainText('Pack 0 /');
  await expect(page.getByTestId('warehouse-total')).not.toHaveText('0 items');
});

test('completing the starting mission unlocks the next one', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key as string, save as string),
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');
  await expect(page.getByTestId('dispatch-tuvale_thicket')).toBeVisible();
});

test('progress survives a reload without rerolling loot', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key as string, save as string),
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');
  await page.getByTestId('collect-all').click();
  const before = await page.getByTestId('warehouse-total').textContent();

  // Wait past the autosave debounce, then reload.
  await page.waitForTimeout(1_500);
  await page.reload();

  await expect(page.getByTestId('warehouse-total')).toHaveText(before ?? '');
});
```

- [ ] **Step 2: Install browsers and run**

Run: `npx playwright install chromium`
Run: `npm run test:e2e`
Expected: all five tests pass.

- [ ] **Step 3: Run everything one final time**

Run: `npm test && npm run build && npm run test:e2e`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/loop.spec.ts
git commit -m "test: add end-to-end coverage for dispatch, offline resolution, and collect"
```

---

## Spec Coverage

| Spec requirement | Task |
|---|---|
| Wall-clock durations ~30s–8h | 3 |
| Repeat toggle, not a count | 2 (type), 6 (resolution), 9 (command) |
| Carry capacity as the offline cap, counting items | 4, 6 |
| Worst-case check before each run | 4 (`maxItemsPerRun`), 6 |
| Missions always succeed | 6 (no failure branch exists) |
| Materials, trinkets, XP | 5, 6 |
| Probabilistic yield rounding | 5 |
| Long-mission superiority authored in tables | 3 |
| Access gated by prior completions | 8 |
| Level scales yield and capacity | 4 |
| Reserved seams: `tags`, `skills`, `baseValue` | 2, 3 |
| Three concurrent heroes, placeholder constant | 10 (`HERO_COUNT`) |
| Pure core, injected clock and RNG | 2 (+ purity guard) |
| Resolution derived from timestamps | 6 |
| Resolve-before-command invariant | 9 |
| Event log drives the welcome-back summary | 6, 11, 12 |
| RNG seed and cursor persist | 2, 10 |
| `recall` discards only the partial run | 9 |
| `equip` never retroactive | 9 |
| Trinkets move warehouse ↔ hero only | 9 |
| `toggleRepeat` off on a blocked hero clears it | 9 |
| `collectAll` ships in Part 1 | 9, 12 |
| Backwards clock clamps assignments | 7 |
| Corrupt save falls back, preserves backup | 10 |
| Newer version refused | 10 |
| Dangling save references sanitized, completions kept | 10 |
| Catalog validated at build time | 3 |
| Playwright pass over dispatch → collect | 13 |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-02-hero-mission-loop.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration.
2. **Inline Execution** — tasks executed in this session with checkpoints for review.
