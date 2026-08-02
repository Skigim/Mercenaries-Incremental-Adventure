# MerchantNext

A remake/retheme of **Merchant Guilds** by Retora Games.

## Claude Skills

This repo vendors a few Claude Code skills under `.claude/skills/` for use during development:

- **superpowers** ([obra/superpowers](https://github.com/obra/superpowers)) — plan/brainstorm/spec/debug workflow skills (`brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, etc.)
- **webapp-testing** ([anthropics/skills](https://github.com/anthropics/skills)) — Playwright-driven UI verification
- **frontend-design** ([anthropics/skills](https://github.com/anthropics/skills)) — guidance for avoiding generic/default-looking UI

These were copied in manually (not installed as plugins) since this environment doesn't support `/plugin marketplace add`. They can be updated by re-pulling the source repos and copying the relevant `skills/` subdirectories back into `.claude/skills/`.
