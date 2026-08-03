# Camp Board cleanup — design

Small internal-refactor pass following up on the Camp Board UI review (see `2026-08-02-camp-board-ui-design.md`). No visible UI or behavior change; existing test suite (146 unit + 8 e2e) is the acceptance bar.

## 1. Dedupe hero-grid mapping

`CampBoardDesktop.tsx` and `CampBoardMobile.tsx` each map `state.heroes` to `HeroCard` identically (rotation cycling via `CARD_ROTATIONS`, same props), differing only in the wrapping container's class.

Extract a new `src/ui/camp/HeroList.tsx`:

```ts
function HeroList({ heroes, now, run, justLeveledUp, onSendToQuest, className }: {
  heroes: Hero[];
  now: number;
  run: (cmd: Command) => GameEvent[];
  justLeveledUp: Set<HeroId>;
  onSendToQuest: (id: HeroId) => void;
  className: string;
}): JSX.Element
```

Renders the `className` wrapper div containing the `heroes.map(...)` → `HeroCard` list (rotation logic moves here, `CARD_ROTATIONS` import moves here). `CampBoardDesktop` renders `<HeroList ... className="hero-grid" />`; `CampBoardMobile` renders `<HeroList ... className="mobile-hero-list" />` inside its existing `activeTab === 'heroes'` guard.

## 2. Fix `primaryLoot` fragility

`QuestBoard.tsx`'s `primaryLoot()` does:

```ts
const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
const top = materials.reduce((best, e) => (e.weight > best.weight ? e : best), materials[0]!);
```

If `materials` is empty, `materials[0]` is `undefined`, the `!` lies, and `top.itemId` throws. No current mission's loot table lacks a material entry, but nothing guarantees that stays true as the catalog grows.

Fix: guard the empty case explicitly and return `itemTag: ''` (renders no material tag) instead of asserting non-null:

```ts
function primaryLoot(mission: MissionDef): { itemTag: string; rareTag: string | null } {
  const materials = mission.lootTable.filter((e) => getItem(e.itemId)?.kind === 'material');
  const top = materials.length > 0
    ? materials.reduce((best, e) => (e.weight > best.weight ? e : best))
    : null;
  const rare = mission.lootTable.find((e) => getItem(e.itemId)?.kind === 'trinket');
  return {
    itemTag: top ? (getItem(top.itemId)?.name ?? '') : '',
    rareTag: rare ? (getItem(rare.itemId)?.name ?? null) : null,
  };
}
```

(`reduce` without an initial value is safe here since it's only called when `materials.length > 0`.)

## 3. Restore `showWelcome`

Per the original UI spec, dismissal was meant to be a separate boolean from the welcome-back event data, so a future dismiss animation could show while the underlying data is already cleared — but the build collapsed this into `welcomeBack !== null` as the direct render condition.

In `useGame.ts`:
- Add `const [showWelcome, setShowWelcome] = useState(boot.events.length > 0)`.
- `dismissWelcome` becomes `useCallback(() => setShowWelcome(false), [])` (no longer nulls `welcomeBack`).
- `Game` interface and the returned object add `showWelcome: boolean`; `welcomeBack` keeps its existing type/meaning (event data, persists until next boot).

In `CampBoard.tsx`:
- Destructure `showWelcome` from `game`.
- Render condition changes from `{welcomeBack && <WelcomeDialog ... />}` to `{showWelcome && welcomeBack && <WelcomeDialog ... />}` (guards the TS type of `events` while `showWelcome` drives visibility).

## Testing

No new tests — this is a structural refactor with no behavior change. Run full suite (`tsc`, unit, e2e) to confirm no regression.
