# Camp Board Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three structural cleanups to `src/ui/camp/` flagged in the Camp Board UI review — dedupe the hero-grid mapping, fix a crash-on-empty-array edge case in `QuestBoard`'s loot-tag derivation, and restore the `showWelcome`/`welcomeBack` separation the original spec called for.

**Architecture:** No new subsystems. Task 1 extracts a shared presentational component; Task 2 hardens a pure function against an edge case; Task 3 splits one piece of state into two. Each task is independent — order doesn't matter functionally, but they're sequenced smallest-diff-first.

**Tech Stack:** React 18 + TypeScript, Vitest (unit), Playwright (e2e). No new dependencies.

## Global Constraints

- No visible UI or behavior change from this pass — every task must leave the rendered output and game behavior identical to before.
- No new tests are added; the existing suite (146 unit tests via `npm test`, 8 e2e specs via `npm run test:e2e`) plus `npm run build` (which runs `tsc --noEmit`) is the acceptance bar for every task.
- Follow existing code style: no comments unless explaining non-obvious *why*, named props destructured in the function signature (matching `HeroCard`/`QuestBoard`'s existing style).

---

### Task 1: Extract shared `HeroList` component

**Files:**
- Create: `src/ui/camp/HeroList.tsx`
- Modify: `src/ui/camp/CampBoardDesktop.tsx`
- Modify: `src/ui/camp/CampBoardMobile.tsx`

**Interfaces:**
- Consumes: `HeroCard` and `CARD_ROTATIONS` from `./HeroCard` (existing, unchanged); `Command` from `../../core/commands`; `GameEvent`, `Hero`, `HeroId` from `../../core/types` (existing, unchanged).
- Produces: `HeroList` — a component with props `{ heroes: Hero[]; now: number; run: (cmd: Command) => GameEvent[]; justLeveledUp: Set<HeroId>; onSendToQuest: (id: HeroId) => void; className: string }`. Renders a `<div className={className}>` wrapping the mapped `HeroCard` list. No default export — named export only, matching the rest of `src/ui/camp/`.

- [ ] **Step 1: Create `HeroList.tsx`**

```tsx
import { CARD_ROTATIONS, HeroCard } from './HeroCard';
import type { Command } from '../../core/commands';
import type { GameEvent, Hero, HeroId } from '../../core/types';

export function HeroList({
  heroes,
  now,
  run,
  justLeveledUp,
  onSendToQuest,
  className,
}: {
  heroes: Hero[];
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  onSendToQuest: (id: HeroId) => void;
  className: string;
}) {
  return (
    <div className={className}>
      {heroes.map((hero, i) => (
        <HeroCard
          key={hero.id}
          hero={hero}
          now={now}
          run={run}
          justLeveledUp={justLeveledUp.has(hero.id)}
          rotation={CARD_ROTATIONS[i % CARD_ROTATIONS.length]!}
          onSendToQuest={onSendToQuest}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update `CampBoardDesktop.tsx` to use `HeroList`**

Replace the `HeroCard`/`CARD_ROTATIONS` import and the `hero-grid` div (current lines 1, 26-38) with:

```tsx
import { HeroList } from './HeroList';
import { QuestBoard } from './QuestBoard';
import { SupplyCrate } from './SupplyCrate';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

export function CampBoardDesktop({
  state,
  now,
  run,
  justLeveledUp,
  selectedHeroId,
  onSelectHero,
  onSendToQuest,
}: {
  state: GameState;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  onSendToQuest: (id: HeroId) => void;
}) {
  return (
    <div className="camp-desktop-body">
      <HeroList
        heroes={state.heroes}
        now={now}
        run={run}
        justLeveledUp={justLeveledUp}
        onSendToQuest={onSendToQuest}
        className="hero-grid"
      />

      <div className="board-row">
        <QuestBoard state={state} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} run={run} variant="desktop" />
        <SupplyCrate state={state} selectedHeroId={selectedHeroId} run={run} variant="desktop" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `CampBoardMobile.tsx` to use `HeroList`**

Replace the `HeroCard`/`CARD_ROTATIONS` import and the `activeTab === 'heroes'` block (current lines 1, 31-45) with:

```tsx
import { HeroList } from './HeroList';
import { QuestBoard } from './QuestBoard';
import { SupplyCrate } from './SupplyCrate';
import { BottomNav, type TabId } from './BottomNav';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

export function CampBoardMobile({
  state,
  now,
  run,
  justLeveledUp,
  selectedHeroId,
  onSelectHero,
  onSendToQuest,
  activeTab,
  onChangeTab,
}: {
  state: GameState;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  onSendToQuest: (id: HeroId) => void;
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}) {
  return (
    <div className="camp-mobile-body">
      {activeTab === 'heroes' && (
        <HeroList
          heroes={state.heroes}
          now={now}
          run={run}
          justLeveledUp={justLeveledUp}
          onSendToQuest={onSendToQuest}
          className="mobile-hero-list"
        />
      )}

      {activeTab === 'quests' && (
        <QuestBoard state={state} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} run={run} variant="mobile" />
      )}

      {activeTab === 'warehouse' && (
        <SupplyCrate state={state} selectedHeroId={selectedHeroId} run={run} variant="mobile" />
      )}

      <BottomNav activeTab={activeTab} onChangeTab={onChangeTab} />
    </div>
  );
}
```

- [ ] **Step 4: Run full verification**

Run: `npm run build && npm test && npm run test:e2e`
Expected: `tsc --noEmit` clean, all 146 unit tests pass, all 8 e2e specs pass — no behavior change.

- [ ] **Step 5: Commit**

```bash
git add src/ui/camp/HeroList.tsx src/ui/camp/CampBoardDesktop.tsx src/ui/camp/CampBoardMobile.tsx
git commit -m "Extract shared HeroList component from CampBoardDesktop/Mobile"
```

---

### Task 2: Fix `primaryLoot` crash on empty materials list

**Files:**
- Modify: `src/ui/camp/QuestBoard.tsx:8-16`

**Interfaces:**
- Consumes: `MissionDef` from `../../core/types` (existing, unchanged); `getItem` from `../../core/catalog` (existing, unchanged).
- Produces: `primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null }` — same signature as before; now returns `itemTag: ''` instead of throwing when `mission.lootTable` has no `material`-kind entry.

- [ ] **Step 1: Replace `primaryLoot`**

In `QuestBoard.tsx`, replace lines 8-16:

```ts
function primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null } {
  const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
  const top = materials.reduce((best, e) => (e.weight > best.weight ? e : best), materials[0]!);
  const rare = mission.lootTable.find((e) => getItem(e.itemId)?.kind === 'trinket');
  return {
    itemTag: getItem(top.itemId)?.name ?? '',
    rareTag: rare ? (getItem(rare.itemId)?.name ?? null) : null,
  };
}
```

with:

```ts
function primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null } {
  const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
  const top = materials.length > 0 ? materials.reduce((best, e) => (e.weight > best.weight ? e : best)) : null;
  const rare = mission.lootTable.find((e) => getItem(e.itemId)?.kind === 'trinket');
  return {
    itemTag: top ? (getItem(top.itemId)?.name ?? '') : '',
    rareTag: rare ? (getItem(rare.itemId)?.name ?? null) : null,
  };
}
```

- [ ] **Step 2: Run full verification**

Run: `npm run build && npm test && npm run test:e2e`
Expected: `tsc --noEmit` clean, all 146 unit tests pass, all 8 e2e specs pass — every current mission still has a material entry, so no rendered tag changes; the fix only affects the previously-unreachable empty-materials path.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/QuestBoard.tsx
git commit -m "Fix primaryLoot crash when a mission's lootTable has no material entry"
```

---

### Task 3: Restore `showWelcome` as a separate dismissal flag

**Files:**
- Modify: `src/ui/useGame.ts`
- Modify: `src/ui/camp/CampBoard.tsx`

**Interfaces:**
- Consumes: existing `Game` interface fields (`state`, `now`, `welcomeBack`, `dismissWelcome`, `run`) — all unchanged in type/meaning except as noted below.
- Produces: `Game` interface gains `showWelcome: boolean`. `welcomeBack: GameEvent[] | null` keeps its current type but is no longer nulled by `dismissWelcome` — it persists until the next boot, holding the same value across a dismiss. `dismissWelcome()` now flips `showWelcome` to `false` instead of nulling `welcomeBack`.

- [ ] **Step 1: Add `showWelcome` state to `useGame.ts`**

In `useGame.ts`, after the existing `welcomeBack` state declaration (line 41-43):

```ts
  const [welcomeBack, setWelcomeBack] = useState<GameEvent[] | null>(
    boot.events.length > 0 ? boot.events : null,
  );
  const [showWelcome, setShowWelcome] = useState(boot.events.length > 0);
```

- [ ] **Step 2: Update `dismissWelcome` and the `Game` interface/return**

Replace the `dismissWelcome` definition (line 109):

```ts
  const dismissWelcome = useCallback(() => setShowWelcome(false), []);
```

Add `showWelcome: boolean;` to the `Game` interface (after `welcomeBack: GameEvent[] | null;` on line 21):

```ts
export interface Game {
  state: GameState;
  now: number;
  welcomeBack: GameEvent[] | null;
  showWelcome: boolean;
  dismissWelcome(): void;
  run(cmd: Command): GameEvent[];
}
```

Update the return statement (line 111):

```ts
  return { state, now, welcomeBack, showWelcome, dismissWelcome, run };
```

- [ ] **Step 3: Update `CampBoard.tsx` to render on `showWelcome`**

Update the destructure (line 15):

```ts
  const { state, now, welcomeBack, showWelcome, dismissWelcome, run } = game;
```

Update the render condition (line 55):

```tsx
        {showWelcome && welcomeBack && <WelcomeDialog events={welcomeBack} onDismiss={dismissWelcome} />}
```

- [ ] **Step 4: Run full verification**

Run: `npm run build && npm test && npm run test:e2e`
Expected: `tsc --noEmit` clean, all 146 unit tests pass, all 8 e2e specs pass — the welcome dialog still appears on boot when there are boot events and still dismisses on "Nice, continue" (covered by the existing e2e `welcome-back` coverage), now via `showWelcome` rather than nulling `welcomeBack`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/useGame.ts src/ui/camp/CampBoard.tsx
git commit -m "Restore showWelcome as a dismissal flag separate from welcomeBack data"
```
