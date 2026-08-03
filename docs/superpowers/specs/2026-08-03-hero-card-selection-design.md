# Hero card click-to-select design

## Purpose

Replace the "Sending" hero dropdown in the Quest Board with click-to-select hero cards. Selecting a hero to act on (currently only used for dispatch) should be a direct interaction with the hero's own card, not a separate dropdown control disconnected from the hero grid.

## Current behavior (baseline)

- `QuestBoard.tsx` renders a `<select>` ("Sending: ...") bound to `selectedHeroId` / `onSelectHero`, used as the hero argument when dispatching a mission.
- `HeroCard.tsx` has a "Send on a job" button (idle heroes only) that calls `onSendToQuest(heroId)`, which sets `selectedHeroId` and, on mobile, also switches the active tab to Quests.
- `selectedHeroId` state lives in `CampBoard.tsx` (`useState`), passed down through `CampBoardDesktop` / `CampBoardMobile` to both `HeroList`/`HeroCard` and `QuestBoard`.

## Changes

1. **Card click selects the hero.** `HeroCard` gains an `onSelect: (heroId: HeroId) => void` prop. Clicking anywhere on the card body calls `onSelect(hero.id)`. This works for any hero, busy or idle — selection is a general "hero to act on" concept, not dispatch-specific, to leave room for future per-hero actions beyond dispatch.
2. **"Send on a job" is unchanged.** The existing `onSendToQuest` prop/handler keeps its current behavior exactly: selects the hero AND (on mobile) switches to the Quests tab. It is a distinct action from the new generic `onSelect`.
3. **Dropdown removed.** `QuestBoard.tsx`'s `<select>` is replaced with a static text label: `Sending: {selectedHero.name}`. No interactive control in `QuestBoard` sets the hero anymore — selection only happens via hero cards.
4. **Selected-card styling.** The currently-selected hero's card gets a visually distinct treatment (accent border/outline), added via a conditional class (e.g. `hero-card-selected`) driven by `selected={selectedHeroId === hero.id}`.
5. **State ownership unchanged.** `selectedHeroId` stays as `useState` in `CampBoard.tsx`. Only how it gets set changes (card `onClick` instead of dropdown `onChange`).

## Component-level changes

- `HeroCard.tsx`: add `selected: boolean` and `onSelect: (id: HeroId) => void` props. Add `onClick` on the card root calling `onSelect(hero.id)`. Add conditional `hero-card-selected` class.
- `HeroList.tsx`: accept and pass through `selectedHeroId` and `onSelect` to each `HeroCard`.
- `CampBoardDesktop.tsx` / `CampBoardMobile.tsx`: pass `selectedHeroId` and a select handler (the existing `onSelectHero`/`setSelectedHeroId` from `CampBoard.tsx`) down to `HeroList`. `QuestBoard` keeps receiving `selectedHeroId` (for the label and the dispatch button) but no longer receives a setter.
- `QuestBoard.tsx`: remove the `<select>` markup and the `onSelectHero` prop; add a static "Sending: {name}" label using `selectedHeroId` (resolved to the hero's name via `state.heroes`).
- `CampBoard.tsx`: no change to the `selectedHeroId` state declaration. `onSendToQuest` (dispatch-tab-switch path) and the new generic select handler are passed to the appropriate children.

## Non-goals

- No change to dispatch logic itself (`run({ type: 'dispatch', ... })` still fires from the Quest Board's Dispatch button using `selectedHeroId`).
- No change to `onSendToQuest` semantics.
- No new persisted state — `selectedHeroId` remains transient UI state, not saved to the game state.

## Testing

- Update e2e specs that currently drive the `hero-select` dropdown to instead click a hero card (`[data-hero-id]` or similar) and assert the selected-card class, then verify dispatch targets the clicked hero.
- Manual verification in the browser: click different cards and confirm the highlight moves; confirm "Send on a job" still switches tabs on mobile; confirm dispatch sends the currently-highlighted hero.
