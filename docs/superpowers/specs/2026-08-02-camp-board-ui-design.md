# Camp Board UI — Design Spec

## Overview

Replace MerchantNext's placeholder text UI (`src/ui/App.tsx` and its current children) with the "Camp Board" design delivered by Design's handoff package (`design_handoff_game_ui/`, unzipped to the scratchpad this session): a themed hero roster, quest-dispatch board, and warehouse/supply crate, in one responsive screen — a 3-column desktop dashboard above 820px, a bottom-tabbed mobile layout below it.

The handoff's `Game.dc.html` + `README.md` are the primary design reference (high-fidelity: colors, type, spacing, radii, and copy are final). This spec translates that reference into an implementation plan for the existing React/TypeScript/Vite codebase, wired to the existing `useGame` hook and `src/core/*` engine — not the prototype's illustrative fake game loop.

## Goals

- Recreate the Camp Board design (desktop dashboard + mobile tabbed) in `src/ui/`, built together as one responsive component tree (not phased, not two separate routes).
- Port the "Organic" design system's tokens (colors, fonts, radii, shadows, spacing) into the app's existing plain-CSS styling approach.
- Wire every interaction to the existing engine commands (`dispatch`, `collect`, `collectAll`, `toggleRepeat`, `recall`, `equip`) and `useGame`'s existing timing (`resolveUpTo`/`now`) — no second timing source, no `GameState` shape changes.
- Preserve existing Playwright e2e coverage by keeping current `data-testid`s on their new elements.

## Out of Scope

- Real hero/region illustrations — portraits and region art render as flat tinted CSS placeholders until real art exists.
- Regions beyond Tuvale.
- `Main Screen (option explorations).dc.html` — earlier explored directions, reference only, not built.
- Any `src/core/*` engine or `GameState` shape change. This is a UI-layer replacement; the engine is used as-is.

## File Structure

New `src/ui/camp/` folder holds the rebuild. The current `HeroCard.tsx`, `MissionList.tsx`, `Warehouse.tsx`, `WelcomeBack.tsx` are replaced (not kept alongside the new tree). `useGame.ts` is unchanged except for one addition (see Data Flow below).

```
src/ui/
  camp/
    CampBoard.tsx          # top-level: useMediaQuery(820px) branch, owns UI-only state
    CampBoardDesktop.tsx   # 3-col hero grid + Quest Board + Supply Crate, single card layout
    CampBoardMobile.tsx    # active-tab state + bottom nav, renders the active tab's panel
    HeroCard.tsx            # shared component, used by both breakpoints
    QuestBoard.tsx          # shared component (desktop card / mobile panel)
    SupplyCrate.tsx         # shared component (renamed from "Warehouse" per design copy)
    WelcomeDialog.tsx       # restyled WelcomeBack
    BottomNav.tsx           # mobile-only, Lucide icons, 3 tabs
    useMediaQuery.ts        # matchMedia hook, 820px breakpoint
  format.ts                 # unchanged
  useGame.ts                 # unchanged except run() return value (see Data Flow)
  App.tsx                    # shrinks to rendering <CampBoard game={useGame()} />
  styles.css                 # replaced with ported design tokens + component classes
```

## Data Flow

All game state and commands continue to come from `useGame()`, threaded down as props — no new React context introduced at this size.

**New UI-only state** (owned by `CampBoard`/`CampBoardMobile`, not `GameState`):
- `activeTab: 'heroes' | 'quests' | 'warehouse'` — mobile only.
- `selectedHeroId` — which hero the Quest Board dispatches to (currently lives in `App.tsx`; moves down to `CampBoard`, threaded to both `QuestBoard` and `SupplyCrate`'s equip action, which today hardcodes `state.heroes[0]`).
- `showWelcome` — dismissed flag for the welcome dialog (replaces `welcomeBack !== null` as the direct render condition, to allow a dismiss animation later without forcing one now).
- `justLeveledUp: Set<HeroId>` — transient, cleared after each hero's badge animation completes (~0.5s after being set).

**Level-up detection:** `useGame`'s `run(cmd)` currently discards the events produced by that single `applyCommand` call — only the boot resolution's events surface, as `welcomeBack`. To detect a live `LeveledUp` event during the session (e.g. immediately after a `collect` that crosses a level threshold), `run` changes its return type from `void` to `GameEvent[]`, returning `applyCommand`'s events. `CampBoard` inspects that return value after every `run()` call it makes and adds any `LeveledUp` heroId to `justLeveledUp`, clearing it via `setTimeout` after the badge animation's duration. This is the one change to `useGame.ts`; its state/save/poll logic is otherwise untouched.

**Locked missions:** the design shows locked missions greyed out with lock copy, not hidden. `availableMissions()` in `src/core/unlocks.ts` filters to unlocked-only, so `QuestBoard` instead iterates the full `MISSIONS` catalog and calls `isUnlocked()` per mission to decide render state (enabled and clickable vs. `opacity: .5` with lock copy, no click target).

## Screens

### Desktop dashboard (`CampBoardDesktop`, ≥820px)
Single card, max-width 1240px, centered, washed region-art panel behind everything at low opacity. Header row: "Camp Tuvale" brand + region tag, left; "N items banked" + "Collect everything" button, right. Below: 3-column hero grid (each card rotated a few tenths of a degree, cycling, for the "pinned note" feel), then a 2-column row — Quest Board (1.3fr) and Supply Crate (1fr).

### Mobile (`CampBoardMobile`, <820px)
Full-bleed card, fixed content height with an internal scroll region per tab, 3-item bottom nav (Heroes / Quest board / Warehouse) via `BottomNav`. Heroes tab is a vertical stack of Hero Cards. Quest board tab has a hero `<select>` at top then one mission row per card. Warehouse tab shows a total count then a scrollable item list.

### Hero Card (`HeroCard`, shared)
Circular portrait placeholder + name + level tag; status line (flavor copy); progress bar (hidden when idle); pack line (`Pack {used}/{capacity}`, `(full)` at cap); mutually-exclusive action zone (Collect / Send on a job / Repeat+Recall pair); level-up badge (`justLeveledUp`-driven, `sparkle-pop` CSS keyframe animation, self-clearing).

### Welcome dialog (`WelcomeDialog`)
Full-card scrim overlay, centered dialog card, "While you were away" title, bullet summary from the `welcomeBack` events array (mission completions / level-ups / pack-full), "Nice, continue" button dismisses (`showWelcome = false`).

## Styling

`src/ui/styles.css` is replaced with the ported "Organic" design system tokens from the vendored `_ds/organic-.../styles.css`: CSS custom properties for `--color-*` (cream/sand ground, terracotta accent, sage accent-2, full 100–900 ramps), `--font-heading`/`--font-body` (Caprasimo/Figtree, loaded via the same Google Fonts `@import` the vendored bundle uses), `--space-*`, `--radius-*` (base + 999px pill), `--shadow-sm/md/lg`; plus component classes (`card`, `btn btn-primary/secondary/ghost`, `tag tag-accent/tag-accent-2`, `bar`/`bar-fill`) adapted from the same source. Still one global plain CSS file — no CSS modules, no Tailwind, no styled-components introduced, matching the project's existing approach.

**New dependency:** `lucide-react`, for the 3 mobile bottom-nav icons (stroke-width 2.75, per the design).

**Placeholder art:** hero portraits render as a flat tinted CSS circle; region art renders as a flat tinted panel (no background image). No `image-slot.js` (prototype-only tooling, not carried into production), no generated/procedural art. Both are swappable for real `<img>` sources later without a markup change (just filling in a `src`).

## Testing

Every `data-testid` the current Playwright suite (`tests/e2e/*`) depends on is preserved on its new element: `hero-card`, `hero-name`, `hero-status`, `hero-pack`, `collect-all`, `dispatch-{missionId}`, `warehouse-total`, `warehouse-{itemId}`, `welcome-back`. New interactive elements (tab buttons, hero-card-initiated dispatch, the equip button) get new `data-testid`s as needed. Add new Playwright coverage for the mobile tab switch and the responsive breakpoint (resize across 820px, assert the correct layout renders). No new Vitest unit coverage is needed beyond what already exists for `useGame`/`src/core` — this is a presentational layer with no new business logic.

## Risks / Notes

- `run()`'s return-type change is the only edit to `useGame.ts`; it's additive (existing call sites that ignore the return value are unaffected) and low-risk relative to the [[project_save_format_pre_launch]] guidance, since it touches UI-layer plumbing, not `GameState` shape or resolution semantics.
- The Google Fonts `@import` introduces a runtime network dependency for Caprasimo/Figtree; if that's ever undesirable (offline dev, stricter CSP), self-hosting the font files is a follow-up, not blocking this spec.
