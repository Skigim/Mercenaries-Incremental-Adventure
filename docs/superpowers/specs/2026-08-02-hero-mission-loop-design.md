# Hero Mission Loop — Design

Part 1 of the MerchantNext single-player loop.

## Purpose

Build the first vertical slice of MerchantNext: a hero is dispatched on a timed mission, time passes, and the hero returns with materials and experience. This is the supply side of the merchant fantasy — the system that will later feed crafting and the shop.

This slice is also the project's first code. The repository currently contains only documentation, so this spec settles the stack and core architecture alongside the game design.

## Design Premise

MerchantNext is a game about being a merchant, not an adventurer. Missions are the supply chain, not the main event. The active session is intended to be the shop side — pricing, crafting, patrons — which arrives in later parts. That premise drives two decisions that would look strange in an adventure game:

- **Long missions pay a better rate than short ones.** Heroes locked away on overnight expeditions are the background resource engine. Short missions are the tactical tool: top off before logging off, or fetch the one material a craft is missing.
- **Found gear is not weapons and armor.** Heroes bring back rings and trinkets. Weapons and armor are what *you* make and sell. Adventuring supplies curiosities; your business supplies equipment.

## Game Design Decisions

### Time

Missions run on wall-clock time and continue while the game is closed. Duration is a per-mission property spanning roughly 30 seconds to 8 hours.

A hero can be set to **repeat** a mission via a toggle — not a fixed count. Repeat exists because tap fatigue was the single most-cited complaint about *Merchant Guilds*; one review was titled "Does need less tapping, more auto-repeating," and Retora themselves retrofitted crafter queues in response. See [the research doc](../../research/2026-08-01-merchant-guilds-research.md).

Because the toggle is unbounded, offline accrual needs an explicit cap. See *Carry capacity* below.

### Progression

**Mission access is gated by prior mission completions**, not by hero level. Completing missions in a region unlocks deeper ones. Progression is content discovery.

**Level does two things:** it scales material yield from any given mission, and it raises carry capacity. The second is the more interesting reward — capacity is what lets a stronger hero stay productive unattended for longer, which is the meaningful currency in a game built around absence.

**Skills are deferred to a later part.** The intended design is that heroes learn skills granting bonuses scoped to mission *types* — including duration reduction. Scoping speed to a mission family rather than to raw level is what keeps leveling from collapsing long missions into short ones globally; a specialized hero is fast at a kind of work, not fast at everything. Part 1 builds none of this, but reserves the seams (see *Reserved seams*).

### Carry capacity

A hero holds loot in a **pack** until collected. Capacity is measured in **total item count** — 40 ore and 3 hides consume 43 of it, and a trinket consumes 1.

Counting stacks rather than items would defeat the cap entirely: a hero repeating one mission draws from the same small loot table forever, so they would occupy three or four stacks on the first run and never fill up again, making offline accrual unbounded. Item count is the only measure that grows with repetition, which is the thing the cap exists to bound.

**A run starts only if the pack can hold its worst case.** Before each run the hero compares `capacityRemaining` against `maxItemsPerRun(mission)` — the largest total quantity that mission's loot table can produce in a single roll, computed statically from the table. If it does not fit, the hero idles.

Checking the worst case rather than the actual roll is what makes "nothing is lost mid-mission" true by construction: loot is never rolled unless it is already guaranteed to fit, so there is no overflow to truncate and no spillover state to reconcile. The cost is slight conservatism — a hero may stop with a little room to spare — which also reads correctly in fiction, since nobody sets out without room for a full haul.

This is the offline cap, and it is diegetic — there is no out-of-fiction "you were away too long" rule to explain, and no message that reads as punishment for having a life. It also establishes an upgrade axis for later parts (larger packs, warehouse tiers).

### Rewards

Missions **always succeed** in Part 1. With access gated by completion rather than power, failure is not load-bearing, and adding it would drag in partial rewards, retry flows, and feedback design for no structural gain. Risk is a natural thing for the later skill system to modify.

A completed mission yields:

- **Materials**, rolled from a weighted per-mission table, scaled by hero level. Gold is deliberately absent — in a merchant game, gold comes from *selling*. If heroes mint gold directly, crafting and the shop become optional decoration.
- **Trinkets**, rarely. A single accessory slot means a trinket can be equipped for a yield bonus or left in the warehouse. Selling does not exist yet, so each item's `baseValue` is displayed but inert; the equip-or-bank tension is legible now and goes live with the shop.
- **Experience**, toward levels.

**Yield multipliers round probabilistically, never by truncation.** A 1.25× multiplier on a base quantity of 1 grants 1 item plus a 25% chance of a second — not `floor(1.25) = 1`, which would silently discard every fractional gain and make the first several levels feel inert. Formally: `granted = floor(q) + (rng.next() < frac(q) ? 1 : 0)`.

The draw comes from the same seeded RNG as the loot roll, so results stay deterministic and reproducible across save and load. It does mean yield consumes RNG cursor positions, so the ordering of rolls within a run must be fixed and documented in the implementation.

**Long-mission superiority is authored, not computed.** Better loot-per-hour lives in the loot tables themselves rather than in a duration formula. Tuning stays data-only, and no formula can quietly make a 30-second mission the global optimum.

### Roster

Three heroes, all dispatchable independently, all running concurrently. The long-versus-short tradeoff only has teeth when committing one hero overnight means the others cover short work.

**Three is a placeholder, not a decision.** It lives as a constant in the starting-state definition. The right number is a feel question that cannot be answered before the loop is playable.

Recruitment is out of scope.

## Architecture

### Stack

TypeScript and React, running in the browser, persisting to `localStorage`.

### Layers

Two layers with one direction of dependency. A pure `core/` module holds every game rule and knows nothing about React, the DOM, `Date`, `Math.random`, or `localStorage`. A `ui/` layer renders it and dispatches commands. Core never imports from UI.

```
src/core/   clock.ts  rng.ts  types.ts  missions.ts  resolve.ts  commands.ts  persistence.ts
src/ui/     React components — thin, no rules
```

Everything nondeterministic is injected:

```ts
interface Clock { now(): number }    // real: Date.now()  |  test: manual
interface Rng   { next(): number }   // seeded; cursor persisted in state
```

This is what makes an eight-hour offline gap a unit test rather than an afternoon of waiting.

### Time model: derived from timestamps

A mission stores `startedAt`, its duration, and a repeat flag. **Nothing ticks.** When state is read, the core computes elapsed time and resolves whatever finished.

Offline progress therefore stops being a feature and becomes a consequence of the model: eight hours closed and eight hours open are the same arithmetic, so there is no second code path to disagree with the first. The alternatives were rejected for that reason — a tick loop needs both incremental advancement and catch-up reconciliation, and the two drift apart in ways that surface as wrong rewards after closing the tab. Per-mission `setTimeout` dies on close and needs the timestamp logic anyway.

Progress bars still animate. The UI re-derives on a render interval, which is a display concern and never a state one.

### Core interface

```ts
resolveUpTo(state, now): { state, events }
applyCommand(state, cmd, now): { state, events }
```

**Invariant: every command resolves to `now` before it applies.** A command can never act on a stale world. Most ordering bugs die with this rule.

**Resolution emits an event log** — `MissionCompleted`, `LootGained`, `LeveledUp`, `PackFull` — not just new state. The log drives the UI's "while you were away" summary, and tests assert against it rather than diffing state blobs.

**RNG state persists.** Both seed and cursor live in `GameState`. Without the cursor, reloading would reroll already-resolved loot: accidental save-scumming and irreproducible bugs.

### Domain model

Shapes marked *reserved* exist but carry no logic in Part 1.

```ts
interface Hero {
  id: HeroId; name: string;
  level: number; xp: number;
  skills: Skill[];            // reserved — always [] in Part 1
  trinket: ItemId | null;     // single accessory slot
  pack: ItemStack[];          // loot held until collected
  assignment: Assignment | null;
}

// Capacity and yield are derived from level, not stored — one source of
// truth, and no stale field to resynchronise after a level-up.
carryCapacity(hero): number        // total items the pack holds
capacityRemaining(hero): number    // carryCapacity minus items currently held
yieldMultiplier(hero): number      // includes the equipped trinket's bonus

// Static, computed from the loot table — the largest total quantity a
// single roll of this mission can produce. Gates whether a run may start.
maxItemsPerRun(mission): number

interface ItemDef {
  id: ItemId; name: string;
  kind: 'material' | 'trinket';
  baseValue: number;          // displayed in Part 1; the shop consumes it in Part 2
  yieldBonus?: number;        // trinkets only
}

interface Assignment {
  missionId: MissionId;
  startedAt: number;          // current run's start
  repeat: boolean;            // toggle, not a count
  blockedAt: number | null;   // set when the pack filled; hero idles
}

interface MissionDef {
  id: MissionId; name: string; regionId: RegionId;
  tags: MissionTag[];         // reserved — nothing reads these in Part 1
  durationMs: number;         // ~30s … ~8h
  lootTable: WeightedEntry[];
  xpReward: number;
  unlockedBy: MissionId[];    // prior completions required
}

interface GameState {
  version: number;            // save migration
  heroes: Hero[];
  warehouse: ItemStack[];
  completions: Record<MissionId, number>;
  rng: { seed: number; cursor: number };
  lastResolvedAt: number;
}
```

### Resolution algorithm

Per hero with an assignment:

```
cursor = assignment.startedAt
while cursor + mission.duration <= now:
    if capacityRemaining(hero) < maxItemsPerRun(mission):
        assignment.blockedAt = cursor
        break
    roll loot (seeded) → pack
    grant XP; apply level-up if earned
    completions[missionId] += 1        // may unlock new missions
    emit events
    cursor += mission.duration          // next run starts immediately
    if not repeat:
        assignment = null
        break
if assignment:                          // may have been cleared above
    assignment.startedAt = cursor       // partial progress preserved
```

Heroes with a non-null `blockedAt` are skipped entirely.

Two ordering details in that loop are load-bearing. `cursor` advances *before* the non-repeat break so the completed run's end time is never misattributed, and the trailing write is guarded because a non-repeat completion sets `assignment` to null — writing `startedAt` unconditionally would dereference null.

**The blocked case is the subtle one.** When a pack fills, the hero stops *starting* new runs; an in-flight mission is never interrupted. On `collect`, the pack empties into the warehouse, `blockedAt` clears, and `startedAt` resets to **now** — so a hero who stood idle for six hours does not instantly bank six hours of missions they never ran.

A level-up partway through a gap applies to subsequent runs within that same gap.

### Commands

`dispatch(hero, mission, repeat)` · `toggleRepeat(hero)` · `recall(hero)` · `collect(hero)` · `collectAll()` · `equip(hero, item)` · `unequip(hero)`

**`recall` abandons the run in progress.** Because every command resolves to `now` first, all *completed* runs have already banked their loot into the pack before the recall applies; only the partial run is discarded, and it yields nothing. The hero keeps their pack and becomes unassigned. Recall is therefore never destructive to earned rewards, which is what makes it safe to offer without a confirmation prompt.

**`equip` never applies retroactively,** for the same reason: resolving to `now` happens before the equip lands, so a newly-fitted trinket boosts future runs only. A player cannot equip a yield trinket after an eight-hour absence and retroactively improve loot that was already earned.

**Trinkets move between exactly two places.** `equip(hero, item)` removes one instance from `GameState.warehouse` and sets `hero.trinket`; if the slot was already occupied, the displaced trinket returns to the warehouse in the same operation. `unequip(hero)` returns the trinket to the warehouse and clears the slot. Equipping sources from the warehouse only — a trinket sitting in a hero's pack must be collected first, so the pack stays a pure in-transit buffer rather than a second inventory the UI has to expose.

**`toggleRepeat` to false on a blocked hero clears the assignment immediately.** A blocked hero has no run in flight — they are idle with a full pack — so there is no partial progress to preserve and leaving a dead assignment in place would only be a state to explain. The pack is untouched and still awaits `collect`. This matches `recall`, which is the point: a hero who is no longer working should not still look assigned.

`collectAll()` ships in Part 1, not as a later convenience patch. A pack-based loop adds a collect step that would otherwise multiply taps by roster size, and retrofitting batch actions after launch is precisely the mistake the research documents.

### Persistence

`GameState` serializes to `localStorage`, debounced on change. On boot: load, migrate if needed, then immediately `resolveUpTo(now)` and surface the resulting event log as the welcome-back summary.

## Failure Modes

All handled in core:

- **Clock moves backwards** (NTP correction, user changes system time): if `now < lastResolvedAt`, resolve nothing and set `lastResolvedAt = now`. Never grant negative time.

  Clamping `lastResolvedAt` alone is not enough. A hero dispatched while the clock was set ahead carries a future `startedAt`, and once the clock corrects, `cursor + duration <= now` stays false until real time catches up — the hero sits inert, potentially for months. So the same pass clamps every active assignment: `startedAt = min(startedAt, now)` and, where set, `blockedAt = min(blockedAt, now)`. The run restarts from the corrected present rather than granting time that never passed.
- **Corrupt or unparseable save:** fall back to a fresh state rather than crashing on boot, and preserve the last-known-good under a backup key instead of overwriting it.
- **Unknown `version`:** migrate forward through a documented chain. Refuse to load a save newer than the running code.
- **Dangling references in a save** (a save naming a mission or item no longer in the catalog): drop the assignment, keep the hero and the warehouse. Stale keys in `completions` are left alone — they are inert, and pruning them could retract an unlock the player already earned.

- **Dangling references in the catalog** are a different class of defect and get a different remedy. `MissionDef.unlockedBy` is static data compiled into the build, never serialized into a save, so no save migration can repair it. An `unlockedBy` pointing at a deleted mission strands its content permanently and silently — the mission simply never becomes available and nothing reports why. A catalog validation test asserts that every `unlockedBy` and every loot-table item ID resolves, and that the unlock graph is acyclic and fully reachable from the starting missions. This fails the build rather than degrading play.

## Testing

The core is pure, so a fake clock and a fixed seed make every scenario a fast deterministic test. Per the project's test-driven-development skill, these are written before the implementation:

- a single completion; a non-repeat assignment clears itself
- repeat across a nine-hour offline gap yields the exact run count and exact loot
- a pack filling mid-gap blocks the hero; later runs do not happen; nothing is lost
- a level-up mid-gap applies its new yield multiplier to later runs in the same gap
- a completion unlocks a mission that was previously unavailable
- `collect` on a blocked hero resets `startedAt` to now
- `recall` mid-run keeps every completed run's loot and discards only the partial one
- `equip` after an offline gap does not alter loot already resolved from that gap
- a non-repeat completion clears the assignment without a null dereference on the trailing `startedAt` write
- a fractional yield multiplier produces extra items over many seeded runs and never floors them away
- a run whose worst-case loot exceeds remaining capacity does not start, and no partial loot is written
- a hero repeating one mission eventually fills up, confirming capacity counts items rather than stacks
- an assignment with a future `startedAt` is clamped on a backwards clock and resumes instead of freezing
- `toggleRepeat(false)` on a blocked hero clears the assignment and preserves the pack
- save → load → resolve reproduces identical results, confirming the RNG cursor survives
- `now < lastResolvedAt` grants nothing

A separate catalog validation test asserts every `unlockedBy` and loot-table ID resolves, and that the unlock graph is acyclic and reachable from the starting missions.

The UI gets a Playwright pass over dispatch → wait → collect, using the repository's `webapp-testing` skill.

## Scope

**In scope:** the dispatch → timer → resolve → loot and XP → level → collect loop; three concurrent heroes; wall-clock durations from ~30s to ~8h; repeat toggle; carry-capacity cap; mission unlocks by prior completion; a single trinket slot; `localStorage` persistence; offline resolution; and a UI thin enough to be replaced.

**Out of scope:** shop and selling, crafting, patrons, gold, skill logic, hero recruitment, mission failure and risk, multiple trinket slots, runes and sockets, guilds and anything multiplayer.

### Reserved seams

Two extension points are left deliberately open so later systems land as additions rather than refactors:

- `MissionTag[]` and `Hero.skills` exist and are unused. Nothing reads them in Part 1. The specialization system will.
- `baseValue` on items means the shop will plug into a warehouse whose contents are already priced.

## After This Doc

This spec becomes an implementation plan via the writing-plans skill. Later parts — crafting, the shop and patrons, hero skills — get their own brainstorm → spec → plan cycles.
