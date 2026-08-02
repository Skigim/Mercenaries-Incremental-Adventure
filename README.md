# MerchantNext

A remake/retheme of **Merchant Guilds** by Retora Games.

## Claude Skills

This project has the [Claude Code CLI](https://github.com/anthropics/claude-code) plugins declared in `.claude/settings.json`, so anyone (or any subagent) working in this repo gets them automatically:

- **superpowers** (`obra/superpowers-marketplace`) — plan/brainstorm/spec/debug workflow skills (`brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, etc.)
- **example-skills** (`anthropics/skills`) — includes `webapp-testing` (Playwright-driven UI verification) and `frontend-design` (guidance for avoiding generic/default-looking UI), plus a few other example skills bundled in the same plugin.

Run `claude plugin list` to see them enabled, or `claude plugin marketplace update` to pull the latest versions.
