# Merchant Guilds Research Plan — Design

## Purpose

MerchantNext is inspired by *Merchant Guilds* (Retora Games), not a faithful clone. Before designing specific MerchantNext systems, we want to pull concrete lessons from the source game: what worked, what didn't, and what's worth reinterpreting. This spec defines what to research, from where, and what the output looks like — it does not itself decide any MerchantNext design.

## Scope

Two focus areas, chosen because they're the highest-leverage lessons for a from-memory "inspired by" project (the user has played the game, so mechanical basics like the shop/patron/transaction loop are already understood and don't need external research):

1. **Progression & meta-game**
   - Unlock structure and ordering
   - Upgrade trees / prestige or reset loops
   - Session length and pacing
   - What kept players engaged long-term (or didn't)

2. **Reception & pain points**
   - What players praised vs. complained about
   - Balance controversies or grind complaints
   - What the developers themselves identified as problems (via patch notes) and how they responded

## Sources

- **Progression & meta-game:** community wiki(s) and guides, cross-referenced with the reception sources below where they touch on progression.
- **Reception & pain points:** Steam reviews, Reddit/forum discussion, YouTube reviews and playthroughs, and Retora Games' official patch notes / dev updates.

## Method

1. Use WebSearch to locate: the game's Steam store page, wiki, relevant Reddit/forum threads, and YouTube reviews/playthroughs.
2. Use WebFetch to pull and read the actual content of the most relevant results (not just titles/snippets).
3. Synthesize findings per topic rather than producing a link dump — every source pulled should turn into a takeaway or be discarded.

## Deliverable

A single research document: `docs/research/2026-08-01-merchant-guilds-research.md`

Structure:

```markdown
# Merchant Guilds Research

## Progression & Meta-Game
<findings>
### Implications for MerchantNext
<concrete takeaways>

## Reception & Pain Points
<findings>
### Implications for MerchantNext
<concrete takeaways>

## Sources
<list of URLs consulted>
```

Each section's findings should cite where they came from (inline links or a shared Sources list at the end). Each "Implications" subsection should state concrete, actionable takeaways — not just restate the finding.

## After This Doc

The user reviews the research doc. Any findings the user wants to act on become their own brainstorming → spec → plan cycles for specific MerchantNext systems (e.g., a "progression system design" spec). This research doc itself does not commit MerchantNext to any design decisions.

## Out of Scope

- Exact mechanical fidelity (formulas, numeric balance) — not needed since this is an "inspired by" project, not a faithful clone.
- Economy/balance and patron variety/behavior research — deferred; not selected as current focus areas.
