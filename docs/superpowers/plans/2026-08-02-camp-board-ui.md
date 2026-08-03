# Camp Board UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MerchantNext's placeholder text UI with the "Camp Board" design — a themed hero roster, quest-dispatch board, and supply crate, in one responsive screen (3-column desktop dashboard above 820px, bottom-tabbed mobile layout below it) — wired to the existing `useGame` hook and `src/core/*` engine.

**Architecture:** A new `src/ui/camp/` component tree replaces the current flat `src/ui/*.tsx` components. Presentational leaf components (`HeroCard`, `QuestBoard`, `SupplyCrate`, `WelcomeDialog`, `BottomNav`) are shared between the desktop and mobile layouts; two composition components (`CampBoardDesktop`, `CampBoardMobile`) arrange them differently; a top-level `CampBoard` owns the responsive branch, the shared header, and new UI-only state (selected hero, active mobile tab, level-up badge timers). `App.tsx` shrinks to a single line rendering `<CampBoard game={useGame()} />`.

**Tech Stack:** React 18 + TypeScript (existing), one new dependency (`lucide-react`) for the mobile nav icons, plain CSS (existing `src/ui/styles.css`, replaced with ported design tokens) — no CSS-in-JS, no Tailwind.

## Global Constraints

- Design reference: `docs/superpowers/specs/2026-08-02-camp-board-ui-design.md` (approved spec) and the handoff's `Game.dc.html` (primary visual reference — colors, type, spacing, radii, and copy are final there).
- Responsive breakpoint is exactly `(max-width: 820px)`, checked both in CSS media queries (cosmetic sizing) and via a JS `matchMedia` hook (which component subtree renders) — per the spec, these must be the same breakpoint value so they never disagree.
- No `GameState` shape changes. No `src/core/*` behavior changes. This plan is UI-layer only.
- Preserve every existing Playwright `data-testid` on its new element: `hero-card`, `hero-name`, `hero-status`, `hero-pack`, `collect-all`, `dispatch-{missionId}`, `warehouse-total`, `warehouse-{itemId}`, `welcome-back`. Hero cards must render in `state.heroes` array order on both breakpoints (existing tests use `.first()` and assume `state.heroes[0]` is first in the DOM).
- Hero portraits and region art are flat tinted CSS placeholders — no `<img>`, no `image-slot.js`, no generated/procedural art.
- `lucide-react` icons used: `Users` (Heroes tab), `Compass` (Quest board tab), `Package` (Warehouse tab) — verified present in `lucide-react@1.28.0` by inspecting the installed package; install with `npm install lucide-react`.
- Design tokens (colors, fonts, spacing, radius, shadow custom properties) are copied verbatim from the handoff's vendored `_ds/organic-2404963c-8fb4-4709-b349-fe269ffeca7b/styles.css`.
- `npm run build` (runs `tsc --noEmit && vite build`) is the fast correctness gate for every task that adds TypeScript. `npm test` (Vitest, core only) must stay green throughout — this plan never touches `src/core/*`. `npm run test:e2e` (Playwright, builds+previews the app) is the real behavioral gate and is exercised fully in the final task.
- This plan intentionally does not add any `unequip` UI, hero-trinket display on the card, or Vitest component tests — none of these are in the approved design spec (YAGNI; the spec's own Testing section says no new Vitest coverage is needed for this presentational layer).

---

## Task 1: Design tokens & global styles

**Files:**
- Modify: `src/ui/styles.css` (full replacement)
- Test: `tests/e2e/loop.spec.ts` (add one test)

**Interfaces:**
- Produces: CSS custom properties (`--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`) and component classes (`.btn`, `.btn-primary/secondary/ghost`, `.btn-block`, `.card`, `.elev-sm/md/lg`, `.tag`, `.tag-accent/accent-2/neutral`, `.bar`/`.bar-fill`, `.is-locked`, plus every `camp-*`/`hero-*`/`mission-*`/`item-*`/`bottom-nav-*`/`mobile-*` class used by later tasks) that every subsequent task's JSX assumes exist.

This task fully replaces the current 12-line `src/ui/styles.css`. **The old placeholder components (`HeroCard.tsx`, `MissionList.tsx`, `Warehouse.tsx`, `WelcomeBack.tsx`) will look unstyled in a manual browser check from this task until Task 10**, because their old class names (`.app`, `.heroes`, `.missions`, `.warehouse`, `.welcome`, `.value`) are removed along with the rest of the old stylesheet. This is expected and does not affect any automated test — the existing Playwright suite only asserts on `data-testid`s and text content, never on styling. Task 10 swaps the old components out for the new `camp/` tree, at which point the new classes apply and the app looks correct end-to-end.

- [ ] **Step 1: Replace `src/ui/styles.css`**

```css
/* Design tokens — ported from Design's "Organic" system handoff
   (design_handoff_game_ui/_ds/organic-2404963c-8fb4-4709-b349-fe269ffeca7b/styles.css) */
@import url('https://fonts.googleapis.com/css2?family=Caprasimo:wght@400&family=Figtree:wght@400;600;700&display=swap');

:root {
  --color-bg: #f5ead8;
  --color-surface: #ebddc5;
  --color-text: #201e1d;
  --color-accent: #c67139;
  --color-accent-2: #7a8a5e;
  --color-divider: color-mix(in srgb, #201e1d 16%, transparent);

  --color-neutral-100: #f9f4ed;
  --color-neutral-200: #eee7db;
  --color-neutral-300: #dcd3c4;
  --color-neutral-400: #c0b6a5;
  --color-neutral-500: #a19786;
  --color-neutral-600: #82796a;
  --color-neutral-700: #645c50;
  --color-neutral-800: #474238;
  --color-neutral-900: #2e2b25;

  --color-accent-100: #fff2eb;
  --color-accent-200: #ffe1d0;
  --color-accent-300: #ffc6a5;
  --color-accent-400: #f6a06b;
  --color-accent-500: #d67f48;
  --color-accent-600: #b2622d;
  --color-accent-700: #8c491a;
  --color-accent-800: #643312;
  --color-accent-900: #402310;

  --color-accent-2-100: #f0fae1;
  --color-accent-2-200: #e1eecc;
  --color-accent-2-300: #ccdbb2;
  --color-accent-2-400: #aebf92;
  --color-accent-2-500: #8fa073;
  --color-accent-2-600: #728157;
  --color-accent-2-700: #56633f;
  --color-accent-2-800: #3d472b;
  --color-accent-2-900: #272e1b;

  --font-heading: "Caprasimo", system-ui, sans-serif;
  --font-heading-weight: 400;
  --font-body: "Figtree", system-ui, sans-serif;

  --space-1: 4.4px;
  --space-2: 8.8px;
  --space-3: 13.2px;
  --space-4: 17.6px;
  --space-6: 26.4px;
  --space-8: 35.2px;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 28px;

  --shadow-sm: 0 1px 2px color-mix(in srgb, #2e2b25 14%, transparent);
  --shadow-md: 0 3px 10px color-mix(in srgb, #2e2b25 16%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent);
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
}

h1, h2, h3, h4 { font-family: var(--font-heading); font-weight: var(--font-heading-weight); margin: 0; }

:focus { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

/* — buttons — */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer; text-decoration: none;
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 14px; line-height: 1.2; color: var(--color-text);
  background: transparent; border: 1px solid transparent;
  padding: var(--space-2) calc(var(--space-3) * 1.2);
  border-radius: 999px;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--color-accent); color: var(--color-bg); }
.btn-primary:hover:not(:disabled) { background: var(--color-accent-600); }
.btn-primary:active:not(:disabled) { background: var(--color-accent-700); }
.btn-secondary { border-color: var(--color-divider); }
.btn-secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.btn-ghost { color: var(--color-accent); padding-inline: var(--space-1); }
.btn-ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }
.btn-block { width: 100%; }

/* — cards — */
.card {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); border-radius: calc(var(--radius-lg) * 1.15);
  background: var(--color-surface);
}
.elev-sm { box-shadow: var(--shadow-sm); }
.elev-md { box-shadow: var(--shadow-md); }
.elev-lg { box-shadow: var(--shadow-lg); }

/* — tags — */
.tag {
  display: inline-flex; align-items: center; font-size: 11px;
  letter-spacing: 0.02em; padding: 3px 10px; border-radius: 999px;
}
.tag-accent { background: var(--color-accent-100); color: var(--color-accent-800); }
.tag-accent-2 { background: var(--color-accent-2-100); color: var(--color-accent-2-800); }
.tag-neutral { background: var(--color-neutral-100); color: var(--color-neutral-800); }

/* — dialog — */
.dialog { padding: var(--space-4); }
.dialog-title { font-family: var(--font-heading); font-size: 19px; }
.dialog-body {
  font-size: 14px; color: var(--color-neutral-700);
  display: flex; flex-direction: column; gap: 6px; margin-top: 8px;
}
.dialog-actions { margin-top: var(--space-3); }

/* — progress bar — */
.bar { height: 7px; border-radius: 999px; background: var(--color-neutral-300); overflow: hidden; margin-bottom: 8px; }
.bar-fill { height: 100%; background: var(--color-accent-500); }

.is-locked { opacity: .5; }

/* ══════ Camp Board layout ══════ */

.camp-page { min-height: 100vh; display: flex; justify-content: center; padding: 32px; }
.camp-card {
  position: relative; width: 100%; max-width: 1240px;
  background: var(--color-neutral-100); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg); overflow: hidden;
}
@media (max-width: 820px) {
  .camp-page { padding: 0; }
  .camp-card { max-width: 430px; }
}

.camp-region-art { position: absolute; inset: 0; opacity: .3; pointer-events: none; background: var(--color-accent-200); }

.welcome-scrim {
  position: absolute; inset: 0; z-index: 20;
  background: rgba(32, 30, 29, .35);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.welcome-dialog { max-width: 340px; width: 100%; }

.camp-header {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-neutral-300);
}
.camp-header-brand { display: flex; align-items: center; gap: var(--space-3); }
.camp-header-title { font-family: var(--font-heading); font-size: 22px; color: var(--color-accent-800); }
.camp-header-actions { display: flex; align-items: center; gap: var(--space-3); }
.camp-header-banked { font-size: 13px; color: var(--color-neutral-700); }

/* — hero cards — */
.hero-card { padding: var(--space-4); position: relative; }
.hero-card-header { display: flex; gap: 10px; align-items: center; }
.hero-portrait { width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--color-accent-200); }
.hero-card-name { font-family: var(--font-heading); }
.hero-level { margin-top: 3px; }
.hero-status { font-size: 13px; color: var(--color-neutral-700); margin: 10px 0 6px; }
.hero-pack { font-size: 12px; color: var(--color-neutral-600); margin: 0 0 8px; }
.hero-actions { display: flex; gap: 8px; }
.hero-actions .btn-ghost { flex: 1; font-size: 12px; }
.hero-badge {
  position: absolute; top: -8px; right: 14px;
  animation: sparkle-pop .5s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes sparkle-pop {
  0% { transform: scale(0.6) rotate(-8deg); opacity: 0; }
  60% { transform: scale(1.12) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.hero-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }

/* — desktop board — */
.camp-desktop-body { position: relative; padding: var(--space-6); }
.board-row { display: grid; grid-template-columns: 1.3fr 1fr; gap: var(--space-4); margin-top: var(--space-4); }
.quest-board, .supply-crate { padding: var(--space-4); }
.quest-board-header { display: flex; align-items: center; justify-content: space-between; }
.card-kicker { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent); }
.hero-select-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-neutral-700); }
.hero-select { font: inherit; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--color-neutral-400); background: var(--color-bg); }
.mission-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.mission-row { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: var(--radius-md); background: var(--color-neutral-100); }
.mission-row-tags { display: flex; gap: 6px; margin-top: 4px; }
.mission-name { font-size: 14px; font-weight: 600; }
.mission-lock-text { font-size: 12px; color: var(--color-neutral-600); }

.supply-crate-total { font-family: var(--font-heading); margin: 4px 0 10px; color: var(--color-accent-800); font-size: 22px; }
.item-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; border-radius: var(--radius-md); }
.item-row--trinket { background: var(--color-accent-100); }
.item-chip { width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex: none; }
.item-name { font-size: 13px; }
.item-value { font-size: 12px; color: var(--color-neutral-600); }
.item-left { display: flex; align-items: center; gap: 8px; }

/* — mobile board — */
.camp-mobile-body { position: relative; height: 640px; display: flex; flex-direction: column; }
.mobile-tab-fixed { padding: 14px 16px 0; }
.mobile-tab-scroll { flex: 1; overflow: auto; padding: 10px 16px 0; display: flex; flex-direction: column; gap: 12px; }
.mobile-hero-list { flex: 1; overflow: auto; padding: 14px 16px 0; display: flex; flex-direction: column; gap: 14px; }
.mobile-quest-select-row { padding: 12px 16px 0; }
.mobile-warehouse-total { font-size: 26px; font-family: var(--font-heading); margin: 0; color: var(--color-accent-800); }
.mobile-warehouse-total-label { font-size: 13px; font-family: var(--font-body); color: var(--color-neutral-600); }
.mission-card { padding: var(--space-4); }

.bottom-nav { display: flex; border-top: 1px solid var(--color-neutral-300); background: var(--color-bg); padding: 10px 8px; }
.bottom-nav-item { flex: 1; text-align: center; cursor: pointer; background: none; border: none; color: var(--color-neutral-600); font: inherit; }
.bottom-nav-item--active { color: var(--color-accent-700); }
.bottom-nav-label { font-size: 10px; margin-top: 2px; }
```

- [ ] **Step 2: Add a token-loaded regression test**

Add to the end of `tests/e2e/loop.spec.ts`:

```ts
test('Camp Board design tokens are loaded', async ({ page }) => {
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(245, 234, 216)'); // --color-bg: #f5ead8
});
```

- [ ] **Step 3: Run the full build and e2e suite**

Run: `npm run build && npm run test:e2e`
Expected: build succeeds; all e2e tests pass, including the new one. (The app will look unstyled if you open it manually — expected per the note above.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/styles.css tests/e2e/loop.spec.ts
git commit -m "Port Camp Board design tokens into styles.css"
```

---

## Task 2: `useMediaQuery` hook & `WelcomeDialog` component

**Files:**
- Create: `src/ui/camp/useMediaQuery.ts`
- Create: `src/ui/camp/WelcomeDialog.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; `WelcomeDialog({ events: GameEvent[], onDismiss: () => void }): JSX.Element`, rendering `data-testid="welcome-back"`.
- Consumes: `GameEvent` from `../../core/types` (existing).

- [ ] **Step 1: Write `useMediaQuery.ts`**

```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Write `WelcomeDialog.tsx`**

This restyles the current `src/ui/WelcomeBack.tsx` (same event-counting logic, new markup/classes) with the design's copy and emoji markers.

```tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (These components aren't wired into `App.tsx` yet, so there's nothing new to exercise in the browser until Task 9 — this is a structural/type-correctness check, consistent with the spec's testing section: no new Vitest coverage for presentational code, full behavioral verification happens once everything is wired together in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/camp/useMediaQuery.ts src/ui/camp/WelcomeDialog.tsx
git commit -m "Add useMediaQuery hook and WelcomeDialog component"
```

---

## Task 3: `HeroCard` component

**Files:**
- Create: `src/ui/camp/HeroCard.tsx`

**Interfaces:**
- Produces: `CARD_ROTATIONS: string[]` (4-entry rotation cycle, reused by `QuestBoard` in Task 4); `HeroCard(props): JSX.Element` with props `{ hero: Hero, now: number, run: (cmd: Command) => GameEvent[], justLeveledUp: boolean, rotation: string, onSendToQuest: (heroId: HeroId) => void }`. Renders `data-testid="hero-card"` (root), `"hero-name"`, `"hero-status"`, `"hero-pack"`, `"hero-collect"`, `"hero-send-job"`.
- Consumes: `getMission` from `../../core/catalog`; `capacityRemaining`, `carryCapacity` from `../../core/derive`; `countItems` from `../../core/pack`; `formatDuration`, `missionProgress` from `../format`; `Command` from `../../core/commands`; `GameEvent`, `Hero`, `HeroId` from `../../core/types`.

The status copy (`"Idle — send him somewhere"`, `"{mission} — pack full, waiting on you"`, `"{mission} — {time} left"`) and the `"Ding! Level up"` badge come directly from `Game.dc.html` (lines 402-441) — this is final copy per the spec's fidelity note, not placeholder text.

- [ ] **Step 1: Write `HeroCard.tsx`**

```tsx
import { getMission } from '../../core/catalog';
import { capacityRemaining, carryCapacity } from '../../core/derive';
import { countItems } from '../../core/pack';
import { formatDuration, missionProgress } from '../format';
import type { Command } from '../../core/commands';
import type { GameEvent, Hero, HeroId } from '../../core/types';

export const CARD_ROTATIONS = ['-1.4deg', '0.9deg', '-0.5deg', '1.1deg'];

export function HeroCard({
  hero,
  now,
  run,
  justLeveledUp,
  rotation,
  onSendToQuest,
}: {
  hero: Hero;
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: boolean;
  rotation: string;
  onSendToQuest: (heroId: HeroId) => void;
}) {
  const assignment = hero.assignment;
  const mission = assignment ? getMission(assignment.missionId) : undefined;
  const held = countItems(hero.pack);
  const capacity = carryCapacity(hero);

  let status = 'Idle — send him somewhere';
  let progress = 0;
  let showBar = false;
  if (assignment && mission) {
    showBar = true;
    if (assignment.blockedAt !== null) {
      status = `${mission.name} — pack full, waiting on you`;
      progress = 1;
    } else {
      progress = missionProgress(assignment.startedAt, mission.durationMs, now);
      const remaining = assignment.startedAt + mission.durationMs - now;
      status = `${mission.name} — ${formatDuration(remaining)} left`;
    }
  }

  return (
    <article
      className="card elev-md hero-card"
      style={{ transform: `rotate(${rotation})` }}
      data-testid="hero-card"
      data-hero-id={hero.id}
    >
      {justLeveledUp && <span className="tag tag-accent-2 hero-badge">Ding! Level up</span>}

      <div className="hero-card-header">
        <div className="hero-portrait" aria-hidden="true" />
        <div>
          <strong className="hero-card-name" data-testid="hero-name">{hero.name}</strong>
          <div className="tag tag-accent hero-level">Lv {hero.level}</div>
        </div>
      </div>

      <p className="hero-status" data-testid="hero-status">{status}</p>

      {showBar && (
        <div className="bar" aria-hidden="true">
          <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <p className="hero-pack" data-testid="hero-pack">
        Pack {held} / {capacity}
        {capacityRemaining(hero) === 0 && ' (full)'}
      </p>

      {held > 0 && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          data-testid="hero-collect"
          onClick={() => run({ type: 'collect', heroId: hero.id })}
        >
          Collect
        </button>
      )}

      {!assignment && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          data-testid="hero-send-job"
          onClick={() => onSendToQuest(hero.id)}
        >
          Send on a job
        </button>
      )}

      {assignment && (
        <div className="hero-actions">
          <button type="button" className="btn btn-ghost" onClick={() => run({ type: 'toggleRepeat', heroId: hero.id })}>
            Repeat: {assignment.repeat ? 'on' : 'off'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => run({ type: 'recall', heroId: hero.id })}>
            Recall
          </button>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/HeroCard.tsx
git commit -m "Add HeroCard component"
```

---

## Task 4: `QuestBoard` component

**Files:**
- Create: `src/ui/camp/QuestBoard.tsx`

**Interfaces:**
- Produces: `QuestBoard(props): JSX.Element` with props `{ state: GameState, selectedHeroId: HeroId, onSelectHero: (id: HeroId) => void, run: (cmd: Command) => GameEvent[], variant: 'desktop' | 'mobile' }`. Renders `data-testid="dispatch-{missionId}"` per unlocked mission (locked missions render no dispatch element at all, matching the current app's behavior of omitting locked missions' dispatch buttons).
- Consumes: `MISSIONS`, `getItem` from `../../core/catalog`; `isUnlocked` from `../../core/unlocks`; `formatDuration` from `../format`; `CARD_ROTATIONS` from `./HeroCard` (Task 3); `Command` from `../../core/commands`; `GameEvent`, `GameState`, `HeroId`, `MissionDef` from `../../core/types`.

Unlike the current `MissionList.tsx` (which calls `availableMissions()` to filter out locked missions entirely), this component iterates every mission in `MISSIONS` and shows locked ones greyed out with lock copy, per the design.

- [ ] **Step 1: Write `QuestBoard.tsx`**

```tsx
import { MISSIONS, getItem } from '../../core/catalog';
import { isUnlocked } from '../../core/unlocks';
import { formatDuration } from '../format';
import { CARD_ROTATIONS } from './HeroCard';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId, MissionDef } from '../../core/types';

function primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null } {
  const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
  const top = materials.reduce((best, e) => (e.weight > best.weight ? e : best), materials[0]!);
  const rare = mission.lootTable.find((e) => getItem(e.itemId)?.kind === 'trinket');
  return {
    itemTag: getItem(top.itemId)?.name ?? '',
    rareTag: rare ? (getItem(rare.itemId)?.name ?? null) : null,
  };
}

export function QuestBoard({
  state,
  selectedHeroId,
  onSelectHero,
  run,
  variant,
}: {
  state: GameState;
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  run: (cmd: Command) => GameEvent[];
  variant: 'desktop' | 'mobile';
}) {
  const missions = Object.values(MISSIONS);

  const heroSelect = (
    <label className="hero-select-row">
      Sending
      <select className="hero-select" value={selectedHeroId} onChange={(e) => onSelectHero(e.target.value)}>
        {state.heroes.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      {variant === 'desktop' ? (
        <div className="quest-board-header">
          <div className="card-kicker">Quest board</div>
          {heroSelect}
        </div>
      ) : (
        <div className="mobile-quest-select-row">{heroSelect}</div>
      )}

      <div className={variant === 'desktop' ? 'mission-list' : 'mobile-tab-scroll'}>
        {missions.map((mission, i) => {
          const locked = !isUnlocked(mission.id, state.completions);
          const { itemTag, rareTag } = primaryLoot(mission);
          const rotation = CARD_ROTATIONS[i % CARD_ROTATIONS.length]!;

          const tags = (
            <div className="mission-row-tags">
              <span className="tag tag-neutral">{formatDuration(mission.durationMs)}</span>
              <span className="tag tag-neutral">{itemTag}</span>
              {rareTag && <span className="tag tag-accent-2">{rareTag}</span>}
            </div>
          );

          const dispatchButton = (
            <button
              type="button"
              className={`btn btn-primary${variant === 'mobile' ? ' btn-block' : ''}`}
              data-testid={`dispatch-${mission.id}`}
              onClick={() => run({ type: 'dispatch', heroId: selectedHeroId, missionId: mission.id, repeat: true })}
            >
              Dispatch
            </button>
          );

          if (variant === 'desktop') {
            return (
              <div key={mission.id} className={`mission-row${locked ? ' is-locked' : ''}`}>
                <div>
                  <span className="mission-name">{mission.name}</span>
                  {tags}
                </div>
                {locked ? <span className="mission-lock-text">Unlocks after the previous mission</span> : dispatchButton}
              </div>
            );
          }

          return (
            <div
              key={mission.id}
              className={`card elev-sm mission-card${locked ? ' is-locked' : ''}`}
              style={{ transform: `rotate(${rotation})` }}
            >
              <strong className="mission-name">{mission.name}</strong>
              {tags}
              {locked ? <p className="mission-lock-text">Unlocks after the previous mission</p> : dispatchButton}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/QuestBoard.tsx
git commit -m "Add QuestBoard component"
```

---

## Task 5: `SupplyCrate` component

**Files:**
- Create: `src/ui/camp/SupplyCrate.tsx`

**Interfaces:**
- Produces: `SupplyCrate(props): JSX.Element` with props `{ state: GameState, selectedHeroId: HeroId, run: (cmd: Command) => GameEvent[], variant: 'desktop' | 'mobile' }`. Renders `data-testid="warehouse-total"` and `data-testid="warehouse-{itemId}"` per stack.
- Consumes: `getItem` from `../../core/catalog`; `countItems` from `../../core/pack`; `Command` from `../../core/commands`; `GameEvent`, `GameState`, `HeroId` from `../../core/types`.

This is also where the current app's hardcoded `state.heroes[0]` equip target (`src/ui/Warehouse.tsx:31`) gets fixed — `equip` now targets `selectedHeroId`, threaded down from `CampBoard`.

- [ ] **Step 1: Write `SupplyCrate.tsx`**

```tsx
import { getItem } from '../../core/catalog';
import { countItems } from '../../core/pack';
import type { Command } from '../../core/commands';
import type { GameEvent, GameState, HeroId } from '../../core/types';

function monogram(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function SupplyCrate({
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
  const totalItems = countItems(state.warehouse);

  const list = (
    <>
      {state.warehouse.map((stack) => {
        const def = getItem(stack.itemId);
        if (!def) return null;
        const isTrinket = def.kind === 'trinket';
        return (
          <div
            key={stack.itemId}
            className={`item-row${isTrinket ? ' item-row--trinket' : ''}`}
            data-testid={`warehouse-${stack.itemId}`}
          >
            <div className="item-left">
              <div
                className="item-chip"
                style={{
                  background: isTrinket ? 'var(--color-accent-500)' : 'var(--color-neutral-300)',
                  color: isTrinket ? '#fff' : 'var(--color-neutral-800)',
                }}
              >
                {monogram(def.name)}
              </div>
              <span className="item-name">{def.name} x{stack.qty}</span>
            </div>
            {isTrinket ? (
              <button
                type="button"
                className="btn btn-ghost"
                data-testid={`equip-${stack.itemId}`}
                onClick={() => run({ type: 'equip', heroId: selectedHeroId, itemId: stack.itemId })}
              >
                Equip
              </button>
            ) : (
              <span className="item-value">{def.baseValue}g</span>
            )}
          </div>
        );
      })}
    </>
  );

  if (variant === 'desktop') {
    return (
      <div className="card elev-sm supply-crate">
        <div className="card-kicker">Supply crate</div>
        <p className="supply-crate-total" data-testid="warehouse-total">
          {totalItems} <span className="mobile-warehouse-total-label">items</span>
        </p>
        {list}
      </div>
    );
  }

  return (
    <>
      <div className="mobile-tab-fixed">
        <p className="mobile-warehouse-total" data-testid="warehouse-total">
          {totalItems} <span className="mobile-warehouse-total-label">items</span>
        </p>
      </div>
      <div className="mobile-tab-scroll">
        <div className="card elev-sm">{list}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/SupplyCrate.tsx
git commit -m "Add SupplyCrate component"
```

---

## Task 6: `BottomNav` component (adds `lucide-react`)

**Files:**
- Create: `src/ui/camp/BottomNav.tsx`
- Modify: `package.json`, `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: `TabId = 'heroes' | 'quests' | 'warehouse'` (the canonical tab-id type, imported by `CampBoardMobile` and `CampBoard` in later tasks); `BottomNav(props): JSX.Element` with props `{ activeTab: TabId, onChangeTab: (tab: TabId) => void }`. Renders `data-testid="mobile-tab-heroes"`, `"mobile-tab-quests"`, `"mobile-tab-warehouse"`.
- Consumes: `Users`, `Compass`, `Package` from `lucide-react`.

- [ ] **Step 1: Install `lucide-react`**

Run: `npm install lucide-react`
Expected: `package.json` gains a `"lucide-react": "^1.28.0"` dependency (or whatever the installed range resolves to); `package-lock.json` updates.

- [ ] **Step 2: Write `BottomNav.tsx`**

```tsx
import { Compass, Package, Users } from 'lucide-react';

export type TabId = 'heroes' | 'quests' | 'warehouse';

const TABS: { id: TabId; label: string; Icon: typeof Users }[] = [
  { id: 'heroes', label: 'Heroes', Icon: Users },
  { id: 'quests', label: 'Quest board', Icon: Compass },
  { id: 'warehouse', label: 'Warehouse', Icon: Package },
];

export function BottomNav({
  activeTab,
  onChangeTab,
}: {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}) {
  return (
    <div className="bottom-nav">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav-item${activeTab === id ? ' bottom-nav-item--active' : ''}`}
          data-testid={`mobile-tab-${id}`}
          onClick={() => onChangeTab(id)}
        >
          <Icon size={20} strokeWidth={2.75} />
          <div className="bottom-nav-label">{label}</div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/ui/camp/BottomNav.tsx
git commit -m "Add BottomNav component and lucide-react dependency"
```

---

## Task 7: `CampBoardDesktop` component

**Files:**
- Create: `src/ui/camp/CampBoardDesktop.tsx`

**Interfaces:**
- Produces: `CampBoardDesktop(props): JSX.Element` with props `{ state: GameState, now: number, run: (cmd: Command) => GameEvent[], justLeveledUp: Set<HeroId>, selectedHeroId: HeroId, onSelectHero: (id: HeroId) => void, onSendToQuest: (id: HeroId) => void }`.
- Consumes: `CARD_ROTATIONS`, `HeroCard` from `./HeroCard` (Task 3); `QuestBoard` from `./QuestBoard` (Task 4); `SupplyCrate` from `./SupplyCrate` (Task 5); `Command` from `../../core/commands`; `GameEvent`, `GameState`, `HeroId` from `../../core/types`.

- [ ] **Step 1: Write `CampBoardDesktop.tsx`**

```tsx
import { CARD_ROTATIONS, HeroCard } from './HeroCard';
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
      <div className="hero-grid">
        {state.heroes.map((hero, i) => (
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

      <div className="board-row">
        <QuestBoard state={state} selectedHeroId={selectedHeroId} onSelectHero={onSelectHero} run={run} variant="desktop" />
        <SupplyCrate state={state} selectedHeroId={selectedHeroId} run={run} variant="desktop" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/CampBoardDesktop.tsx
git commit -m "Add CampBoardDesktop component"
```

---

## Task 8: `CampBoardMobile` component

**Files:**
- Create: `src/ui/camp/CampBoardMobile.tsx`

**Interfaces:**
- Produces: `CampBoardMobile(props): JSX.Element` with props `{ state: GameState, now: number, run: (cmd: Command) => GameEvent[], justLeveledUp: Set<HeroId>, selectedHeroId: HeroId, onSelectHero: (id: HeroId) => void, onSendToQuest: (id: HeroId) => void, activeTab: TabId, onChangeTab: (tab: TabId) => void }`.
- Consumes: `CARD_ROTATIONS`, `HeroCard` from `./HeroCard`; `QuestBoard` from `./QuestBoard`; `SupplyCrate` from `./SupplyCrate`; `BottomNav`, `TabId` from `./BottomNav` (Task 6); `Command` from `../../core/commands`; `GameEvent`, `GameState`, `HeroId` from `../../core/types`.

- [ ] **Step 1: Write `CampBoardMobile.tsx`**

```tsx
import { CARD_ROTATIONS, HeroCard } from './HeroCard';
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
        <div className="mobile-hero-list">
          {state.heroes.map((hero, i) => (
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/camp/CampBoardMobile.tsx
git commit -m "Add CampBoardMobile component"
```

---

## Task 9: `CampBoard` shell + `useGame` level-up plumbing

**Files:**
- Create: `src/ui/camp/CampBoard.tsx`
- Modify: `src/ui/useGame.ts:18-24` (the `Game` interface) and `:103-105` (the `run` implementation)

**Interfaces:**
- Produces: `CampBoard({ game: Game }): JSX.Element` (default export target for `App.tsx` in Task 10).
- Consumes: `useMediaQuery` from `./useMediaQuery` (Task 2); `WelcomeDialog` from `./WelcomeDialog` (Task 2); `CampBoardDesktop` from `./CampBoardDesktop` (Task 7); `CampBoardMobile` from `./CampBoardMobile` (Task 8); `TabId` from `./BottomNav` (Task 6); `countItems` from `../../core/pack`; `Command` from `../../core/commands`; `HeroId` from `../../core/types`; `Game` from `../useGame` (modified in this task).

`useGame`'s `run()` currently discards the events produced by `applyCommand` — only the boot resolution's events surface, as `welcomeBack`. `CampBoard` needs to detect a live `LeveledUp` event (e.g. right after a `collect` that crosses a level threshold) to drive the badge animation, so `run` starts returning `applyCommand`'s events.

- [ ] **Step 1: Update the `Game` interface in `useGame.ts`**

In `src/ui/useGame.ts`, change:

```ts
export interface Game {
  state: GameState;
  now: number;
  welcomeBack: GameEvent[] | null;
  dismissWelcome(): void;
  run(cmd: Command): void;
}
```

to:

```ts
export interface Game {
  state: GameState;
  now: number;
  welcomeBack: GameEvent[] | null;
  dismissWelcome(): void;
  run(cmd: Command): GameEvent[];
}
```

- [ ] **Step 2: Update the `run` implementation in `useGame.ts`**

Change:

```ts
  const run = useCallback((cmd: Command) => {
    setState((prev) => applyCommand(prev, cmd, systemClock.now()).state);
  }, []);
```

to:

```ts
  const run = useCallback((cmd: Command): GameEvent[] => {
    const { state: nextState, events } = applyCommand(stateRef.current, cmd, systemClock.now());
    setState(nextState);
    return events;
  }, []);
```

This reads from `stateRef.current` (already kept in sync every render a few lines above this callback, at `stateRef.current = state;`) instead of the functional `setState` updater, because the caller needs the resolved `events` synchronously — `setState`'s updater form only returns the next state, not a value the caller can capture.

- [ ] **Step 3: Run the unit suite to confirm nothing in `core` broke**

Run: `npm test`
Expected: all 146 tests still pass (this task touches only the UI hook, never `src/core/*`).

- [ ] **Step 4: Write `CampBoard.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { countItems } from '../../core/pack';
import { useMediaQuery } from './useMediaQuery';
import { WelcomeDialog } from './WelcomeDialog';
import { CampBoardDesktop } from './CampBoardDesktop';
import { CampBoardMobile } from './CampBoardMobile';
import type { TabId } from './BottomNav';
import type { Command } from '../../core/commands';
import type { HeroId } from '../../core/types';
import type { Game } from '../useGame';

const LEVEL_UP_BADGE_MS = 900;

export function CampBoard({ game }: { game: Game }) {
  const { state, now, welcomeBack, dismissWelcome, run } = game;
  const isMobile = useMediaQuery('(max-width: 820px)');
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>(state.heroes[0]!.id);
  const [activeTab, setActiveTab] = useState<TabId>('heroes');
  const [justLeveledUp, setJustLeveledUp] = useState<Set<HeroId>>(new Set());

  const runTracked = useCallback(
    (cmd: Command) => {
      const events = run(cmd);
      const leveled = events.filter((e) => e.type === 'LeveledUp').map((e) => e.heroId);
      if (leveled.length > 0) {
        setJustLeveledUp((prev) => new Set([...prev, ...leveled]));
        leveled.forEach((heroId) => {
          setTimeout(() => {
            setJustLeveledUp((prev) => {
              if (!prev.has(heroId)) return prev;
              const next = new Set(prev);
              next.delete(heroId);
              return next;
            });
          }, LEVEL_UP_BADGE_MS);
        });
      }
      return events;
    },
    [run],
  );

  const onSendToQuest = useCallback((heroId: HeroId) => {
    setSelectedHeroId(heroId);
    setActiveTab('quests');
  }, []);

  const totalItems = countItems(state.warehouse);

  return (
    <div className="camp-page">
      <div className="camp-card">
        <div className="camp-region-art" aria-hidden="true" />

        {welcomeBack && <WelcomeDialog events={welcomeBack} onDismiss={dismissWelcome} />}

        <header className="camp-header">
          <div className="camp-header-brand">
            <span className="camp-header-title">Camp Tuvale</span>
            <span className="tag tag-accent-2">Tuvale</span>
          </div>
          <div className="camp-header-actions">
            <span className="camp-header-banked">{totalItems} items banked</span>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="collect-all"
              onClick={() => runTracked({ type: 'collectAll' })}
            >
              Collect everything
            </button>
          </div>
        </header>

        {isMobile ? (
          <CampBoardMobile
            state={state}
            now={now}
            run={runTracked}
            justLeveledUp={justLeveledUp}
            selectedHeroId={selectedHeroId}
            onSelectHero={setSelectedHeroId}
            onSendToQuest={onSendToQuest}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
          />
        ) : (
          <CampBoardDesktop
            state={state}
            now={now}
            run={runTracked}
            justLeveledUp={justLeveledUp}
            selectedHeroId={selectedHeroId}
            onSelectHero={setSelectedHeroId}
            onSendToQuest={setSelectedHeroId}
          />
        )}
      </div>
    </div>
  );
}
```

Note the desktop branch passes `onSendToQuest={setSelectedHeroId}` directly (just selects the hero) rather than `onSendToQuest` (which also switches `activeTab` to `'quests'`) — there are no tabs on desktop, so switching tabs would be meaningless there.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/camp/CampBoard.tsx src/ui/useGame.ts
git commit -m "Add CampBoard shell and return events from useGame's run()"
```

---

## Task 10: Wire `App.tsx`, remove old components, extend e2e coverage

**Files:**
- Modify: `src/ui/App.tsx` (full replacement)
- Delete: `src/ui/HeroCard.tsx`, `src/ui/MissionList.tsx`, `src/ui/Warehouse.tsx`, `src/ui/WelcomeBack.tsx`
- Modify: `tests/e2e/loop.spec.ts` (one assertion update, two new tests)

**Interfaces:**
- Consumes: `CampBoard` from `./camp/CampBoard` (Task 9); `useGame` from `./useGame`.

This is the integration task: it's where the new component tree actually renders in place of the old one, and where the full Playwright suite becomes the real correctness gate per the spec's Testing section.

- [ ] **Step 1: Replace `App.tsx`**

```tsx
import { CampBoard } from './camp/CampBoard';
import { useGame } from './useGame';
import './styles.css';

export function App() {
  const game = useGame();
  return <CampBoard game={game} />;
}
```

- [ ] **Step 2: Delete the old placeholder components**

```bash
git rm src/ui/HeroCard.tsx src/ui/MissionList.tsx src/ui/Warehouse.tsx src/ui/WelcomeBack.tsx
```

- [ ] **Step 3: Update the one existing assertion whose copy changed**

In `tests/e2e/loop.spec.ts`, the design's final idle copy is `"Idle — send him somewhere"` (not the placeholder UI's plain `"Idle"`). Change:

```ts
  await expect(page.getByTestId('hero-status').first()).toHaveText('Idle');
```

to:

```ts
  await expect(page.getByTestId('hero-status').first()).toHaveText('Idle — send him somewhere');
```

Every other existing assertion in this file uses `toContainText`, `not.toContainText`, or compares against a captured `before` value — none of those depend on exact copy that changed, so no other edits are needed there.

- [ ] **Step 4: Add responsive-breakpoint and mobile-tab coverage**

Add to the end of `tests/e2e/loop.spec.ts`:

```ts
test('desktop layout shows the full dashboard with no bottom tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('mobile-tab-heroes')).toHaveCount(0);
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('warehouse-total')).toBeVisible();
});

test('mobile layout shows one tab at a time via the bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByTestId('mobile-tab-heroes')).toBeVisible();
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('dispatch-tuvale_gather')).toHaveCount(0);

  await page.getByTestId('mobile-tab-quests').click();
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('hero-card')).toHaveCount(0);

  await page.getByTestId('mobile-tab-warehouse').click();
  await expect(page.getByTestId('warehouse-total')).toBeVisible();
  await expect(page.getByTestId('dispatch-tuvale_gather')).toHaveCount(0);
});
```

- [ ] **Step 5: Run the full verification pass**

Run: `npm test`
Expected: all 146 unit tests pass (unaffected — nothing in `src/core/*` changed since Task 9's `npm test` run).

Run: `npm run build`
Expected: `tsc --noEmit` and `vite build` both succeed with no errors, including no unused-import/unused-local errors from the deleted files' former imports.

Run: `npm run test:e2e`
Expected: every test in `tests/e2e/loop.spec.ts` passes — the 5 original scenarios (now with the updated idle-copy assertion), the Task 1 token-loaded check, and the 2 new responsive/tab tests.

- [ ] **Step 6: Manually verify in the browser**

Start the dev server and open it at both a desktop and a mobile viewport width (across the 820px breakpoint) to confirm the Camp Board renders as designed: the 3-column desktop dashboard with washed region art behind the card, hero cards with slight rotation, and the mobile version's bottom-tabbed layout switching between Heroes / Quest board / Warehouse. Trigger a level-up (dispatch a hero on repeat, wait for a completion that crosses a level threshold, or seed a save via `localStorage` the way the existing e2e tests do) and confirm the "Ding! Level up" badge appears on the right hero card and clears itself after under a second.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Wire CampBoard into App, remove placeholder UI, extend e2e coverage"
```

---

## Self-Review Notes

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-02-camp-board-ui-design.md` maps to a task — design tokens (Task 1), shared Hero Card with level-up badge (Tasks 3, 9), Quest Board with locked-mission handling (Task 4), Supply Crate with the `selectedHeroId` equip fix (Task 5), Welcome dialog (Task 2), mobile bottom nav with `lucide-react` (Task 6), the two breakpoint-specific compositions (Tasks 7-8), the responsive shell and level-up event plumbing (Task 9), and final wiring plus preserved/extended e2e coverage (Task 10). The spec's "Out of Scope" items (real art, additional regions, `unequip` UI, `GameState` changes) are called out in Global Constraints so no task accidentally drifts into them.

**Type consistency:** `run: (cmd: Command) => GameEvent[]` is the same signature threaded through every component from Task 3 onward, matching the `Game.run` interface change in Task 9. `TabId` is defined once (Task 6) and imported everywhere it's used (Tasks 8, 9). `CARD_ROTATIONS` is defined once (Task 3) and imported by `QuestBoard` (Task 4) and both `CampBoardDesktop`/`CampBoardMobile` (Tasks 7-8) rather than redefined.

**Placeholder scan:** no TBDs; every code block is complete, runnable TypeScript/CSS; every test step names its exact command and expected result.
