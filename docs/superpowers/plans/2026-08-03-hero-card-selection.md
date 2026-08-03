# Hero Card Click-to-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Quest Board's "Sending" hero dropdown with click-to-select hero cards, while leaving the existing "Send on a job" button behavior untouched.

**Architecture:** `HeroCard` gains a generic `onSelect(heroId)` handler (fired by clicking the card) plus a `selected` boolean that drives a highlight class. `selectedHeroId` state stays in `CampBoard.tsx` exactly as it is today — only the thing that sets it changes, from a dropdown's `onChange` to a card's `onClick`. `QuestBoard.tsx` drops its `<select>` and shows a plain "Sending: {name}" label instead.

**Tech Stack:** React + TypeScript, Vite, Playwright for e2e. No unit tests exist for `src/ui/*` in this repo (see `tests/core/` — unit tests only cover core game logic); UI correctness here is verified via `tsc` and Playwright e2e specs in `tests/e2e/`, matching existing project convention.

## Global Constraints

- Do not change dispatch logic, `onSendToQuest` semantics, or persisted game state — `selectedHeroId` remains transient UI state (per spec's Non-goals section).
- Selection must work for any hero, busy or idle (per spec item 1) — this is a general "hero to act on" concept, not dispatch-specific.
- The "Send on a job" button's existing behavior (select + switch to Quests tab on mobile) must be preserved exactly (per spec item 2).
- No new `data-testid` naming conventions beyond what's already used (`hero-card`, `data-hero-id`, kebab-case testids).

---

### Task 1: Add click-to-select and highlight styling to `HeroCard`

**Files:**
- Modify: `src/ui/camp/HeroCard.tsx`
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `HeroCard` props gain `selected: boolean` and `onSelect: (id: HeroId) => void`. Later tasks (2, 3) must pass these two props when rendering `HeroCard`/`HeroList`.

- [ ] **Step 1: Add the `selected` and `onSelect` props and wire the card's click handler**

In `src/ui/camp/HeroCard.tsx`, update the props type and component signature:

```tsx
export function HeroCard({
  hero,
  now,
  run,
  justLeveledUp,
  rotation,
  onSendToQuest,
  selected,
  onSelect,
}: {
  hero: Hero;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: boolean;
  rotation: string;
  onSendToQuest: (heroId: HeroId) => void;
  selected: boolean;
  onSelect: (heroId: HeroId) => void;
}) {
```

Update the `<article>` root to call `onSelect` on click and add the conditional class:

```tsx
  return (
    <article
      className={`card elev-md hero-card${selected ? ' hero-card-selected' : ''}`}
      style={{ transform: `rotate(${rotation})` }}
      data-testid="hero-card"
      data-hero-id={hero.id}
      onClick={() => onSelect(hero.id)}
    >
```

- [ ] **Step 2: Add the selected-card CSS**

In `src/ui/styles.css`, add this rule right after the existing `.hero-card { ... }` rule (line 167):

```css
.hero-card-selected { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

- [ ] **Step 3: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: Fails right now — `HeroList.tsx` doesn't yet pass `selected`/`onSelect` to `HeroCard`. That's expected; Task 2 fixes it. Confirm the *only* errors are about missing `selected`/`onSelect` props on the `HeroCard` call site in `HeroList.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/camp/HeroCard.tsx src/ui/styles.css
git commit -m "Add click-to-select and highlight styling to HeroCard"
```

---

### Task 2: Thread selection through `HeroList`

**Files:**
- Modify: `src/ui/camp/HeroList.tsx`

**Interfaces:**
- Consumes: `HeroCard`'s new `selected`/`onSelect` props from Task 1.
- Produces: `HeroList` props gain `selectedHeroId: HeroId` and `onSelect: (id: HeroId) => void`. Later tasks (3) must pass these when rendering `HeroList`.

- [ ] **Step 1: Add `selectedHeroId` and `onSelect` props, pass through to each `HeroCard`**

Replace the full contents of `src/ui/camp/HeroList.tsx`:

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
  selectedHeroId,
  onSelect,
  className,
}: {
  heroes: Hero[];
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  onSendToQuest: (id: HeroId) => void;
  selectedHeroId: HeroId;
  onSelect: (id: HeroId) => void;
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
          selected={selectedHeroId === hero.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: Fails — `CampBoardDesktop.tsx` and `CampBoardMobile.tsx` don't yet pass `selectedHeroId`/`onSelect` to `HeroList`. Confirm errors are limited to those two call sites (Task 3 fixes them).

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/HeroList.tsx
git commit -m "Thread selectedHeroId and onSelect through HeroList"
```

---

### Task 3: Wire selection from `CampBoardDesktop`/`CampBoardMobile` into `HeroList`

**Files:**
- Modify: `src/ui/camp/CampBoardDesktop.tsx`
- Modify: `src/ui/camp/CampBoardMobile.tsx`

**Interfaces:**
- Consumes: `HeroList`'s new `selectedHeroId`/`onSelect` props from Task 2. Both components already receive `selectedHeroId: HeroId` and `onSelectHero: (id: HeroId) => void` as props from `CampBoard.tsx` — reuse `onSelectHero` as the `onSelect` handler passed to `HeroList` (no change needed in `CampBoard.tsx` itself).
- Produces: no new exported interface — this task only wires existing props through.

- [ ] **Step 1: Pass `selectedHeroId`/`onSelect` to `HeroList` in `CampBoardDesktop.tsx`**

In `src/ui/camp/CampBoardDesktop.tsx`, update the `<HeroList ... />` call:

```tsx
      <HeroList
        heroes={state.heroes}
        now={now}
        run={run}
        justLeveledUp={justLeveledUp}
        onSendToQuest={onSendToQuest}
        selectedHeroId={selectedHeroId}
        onSelect={onSelectHero}
        className="hero-grid"
      />
```

- [ ] **Step 2: Pass `selectedHeroId`/`onSelect` to `HeroList` in `CampBoardMobile.tsx`**

In `src/ui/camp/CampBoardMobile.tsx`, update the `<HeroList ... />` call:

```tsx
        <HeroList
          heroes={state.heroes}
          now={now}
          run={run}
          justLeveledUp={justLeveledUp}
          onSendToQuest={onSendToQuest}
          selectedHeroId={selectedHeroId}
          onSelect={onSelectHero}
          className="mobile-hero-list"
        />
```

- [ ] **Step 3: Verify the project typechecks cleanly**

Run: `npx tsc --noEmit`
Expected: PASS with no errors (Task 4 hasn't touched `QuestBoard.tsx` yet, and its existing `onSelectHero` prop is untouched here).

- [ ] **Step 4: Commit**

```bash
git add src/ui/camp/CampBoardDesktop.tsx src/ui/camp/CampBoardMobile.tsx
git commit -m "Wire hero-card selection through CampBoardDesktop and CampBoardMobile"
```

---

### Task 4: Replace the Quest Board dropdown with a static "Sending" label

**Files:**
- Modify: `src/ui/camp/QuestBoard.tsx`
- Modify: `src/ui/camp/CampBoardDesktop.tsx`
- Modify: `src/ui/camp/CampBoardMobile.tsx`
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: `state.heroes` (already available in `QuestBoard`'s `state` prop) to resolve `selectedHeroId` to a hero name.
- Produces: `QuestBoard` no longer accepts an `onSelectHero` prop. Its remaining props are `state`, `selectedHeroId`, `run`, `variant`.

- [ ] **Step 1: Replace the dropdown with a label in `QuestBoard.tsx`**

In `src/ui/camp/QuestBoard.tsx`, update the props type to drop `onSelectHero`, and replace the `heroSelect` block:

```tsx
export function QuestBoard({
  state,
  selectedHeroId,
  run,
  variant,
}: {
  state: GameState;
  selectedHeroId: HeroId;
  run: (cmd: Command) => GameEvent[];
  variant: 'desktop' | 'mobile';
}) {
  const missions = Object.values(MISSIONS);
  const selectedHero = state.heroes.find((h) => h.id === selectedHeroId);

  const heroSelect = (
    <div className="hero-select-row" data-testid="sending-hero">
      Sending: {selectedHero?.name ?? ''}
    </div>
  );
```

(The rest of the function — the `desktop`/`mobile` layout branches, `mission-list` rendering, `dispatchButton` — is unchanged; `heroSelect` is still referenced the same way in both branches.)

- [ ] **Step 2: Drop `onSelectHero` from the `QuestBoard` call sites**

In `src/ui/camp/CampBoardDesktop.tsx`, update the `<QuestBoard ... />` call:

```tsx
        <QuestBoard state={state} selectedHeroId={selectedHeroId} run={run} variant="desktop" />
```

In `src/ui/camp/CampBoardMobile.tsx`, update the `<QuestBoard ... />` call:

```tsx
        <QuestBoard state={state} selectedHeroId={selectedHeroId} run={run} variant="mobile" />
```

- [ ] **Step 3: Update the CSS for the label (drop the now-unused `<select>` styling)**

In `src/ui/styles.css`, replace line 195 (`.hero-select { ... }`) — delete it entirely, since there's no more `<select>` element. Leave `.hero-select-row` (line 194) as-is; it still applies to the label's flex layout.

- [ ] **Step 4: Verify the project typechecks cleanly**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/camp/QuestBoard.tsx src/ui/camp/CampBoardDesktop.tsx src/ui/camp/CampBoardMobile.tsx src/ui/styles.css
git commit -m "Replace Quest Board hero dropdown with a static Sending label"
```

---

### Task 5: E2E coverage for click-to-select

**Files:**
- Modify: `tests/e2e/loop.spec.ts`

**Interfaces:**
- Consumes: `data-testid="hero-card"` + `data-hero-id` attribute (existing, from `HeroCard.tsx`), `hero-card-selected` CSS class (Task 1), `data-testid="sending-hero"` (Task 4).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write the new e2e test**

Add this test to `tests/e2e/loop.spec.ts` (after the existing `'dispatching a hero puts them to work'` test, e.g. after line 45):

```ts
test('clicking a hero card selects them for dispatch', async ({ page }) => {
  await page.goto('/');

  // Default selection is the first hero, Warrior.
  await expect(page.getByTestId('sending-hero')).toContainText('Warrior');

  // Click the second hero's card (Ranger) to select them instead.
  const rangerCard = page.locator('[data-testid="hero-card"][data-hero-id="hero_2"]');
  await rangerCard.click();

  await expect(page.getByTestId('sending-hero')).toContainText('Ranger');
  await expect(rangerCard).toHaveClass(/hero-card-selected/);

  // Dispatching now sends Ranger, not Warrior.
  await page.getByTestId('dispatch-tuvale_gather').click();
  await expect(rangerCard.getByTestId('hero-status')).toContainText('Gather by the Roadside');
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npx playwright test tests/e2e/loop.spec.ts`
Expected: All tests PASS, including the new one.

- [ ] **Step 3: Run the full test suite (unit + e2e) as a final sanity check**

Run: `npm run test && npx playwright test`
Expected: All tests PASS (146+ unit tests, 9 e2e specs including the new one).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/loop.spec.ts
git commit -m "Add e2e coverage for click-to-select hero cards"
```
