# GitHub Pages Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host MerchantNext at `https://skigim.github.io/Mercenaries-Incremental-Adventure/`, auto-deploying on every push to `master`, so a playtester always has the latest build.

**Architecture:** A GitHub Actions workflow (`build` job gated on unit tests, then `deploy` job) publishes `dist/` via GitHub's native Actions-based Pages pipeline. This requires the repo's Pages settings to be switched from their current `legacy` (branch-serving) mode to `workflow` mode, and requires Vite's `base` to be set to the project-page subpath so built asset URLs resolve correctly.

**Tech Stack:** GitHub Actions (`actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`), Vite, `gh` CLI for the one-time Pages settings change.

**Spec:** [`docs/superpowers/specs/2026-08-02-github-pages-deploy-design.md`](../specs/2026-08-02-github-pages-deploy-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- Deploy trigger is push-to-`master` only — no `workflow_dispatch`, no other branches.
- CI gate is unit tests only (`npm test`) — E2E is explicitly excluded from CI per the spec.
- Vite `base` must be exactly `/Mercenaries-Incremental-Adventure/` (this repo's name, case-sensitive, with leading and trailing slash).
- No custom domain / `CNAME`.
- Commit after every task using conventional-commit prefixes (`feat:`, `chore:`, `fix:`).

---

### Task 1: Vite base path for GitHub Pages

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: a `dist/` build whose `index.html` and asset URLs are correctly prefixed with `/Mercenaries-Incremental-Adventure/`, which Task 2's deploy depends on to serve correctly under the project-page subpath.

- [ ] **Step 1: Add the `base` option to `vite.config.ts`**

Current content is:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Change it to:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Mercenaries-Incremental-Adventure/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

`base` only affects `vite build` (and `vite preview`) output — it does not affect `vitest`, so the existing 146 unit tests are unaffected by this change.

- [ ] **Step 2: Build and verify the asset paths are prefixed**

Run: `npm run build`
Expected: succeeds with no type errors (same as before).

Run: `grep -o '/Mercenaries-Incremental-Adventure/assets/[^"]*\.js' dist/index.html`
Expected: one match, e.g. `/Mercenaries-Incremental-Adventure/assets/index-XXXXXXXX.js` — confirming the script tag now points under the project-page subpath instead of `/assets/...`.

- [ ] **Step 3: Confirm the full unit suite still passes**

Run: `npm test`
Expected: 146 tests passing, unchanged from before this task (this task does not touch `src/` or `tests/`).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "chore: set vite base path for the GitHub Pages project site"
```

---

### Task 2: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Task 1's base-path-correct build output (`npm run build` → `dist/`)
- Produces: a live deployment at `https://skigim.github.io/Mercenaries-Incremental-Adventure/`, auto-updating on every push to `master`

- [ ] **Step 1: Switch the repo's Pages settings from `legacy` to `workflow` build type**

This is a one-time change to the repository's GitHub Pages configuration (not a per-deploy step) — required because the repo currently has Pages set to serve the raw `master` branch directly, which will not work for a Vite build.

Run: `gh api repos/Skigim/Mercenaries-Incremental-Adventure/pages` to confirm current state first.
Expected: `"build_type":"legacy"`, `"source":{"branch":"master","path":"/"}`.

Then run:

```bash
gh api -X PUT repos/Skigim/Mercenaries-Incremental-Adventure/pages -f build_type=workflow
```

Expected: HTTP 204 (no output on success from `gh api`, or a JSON body echoing the updated settings depending on `gh` version).

Run: `gh api repos/Skigim/Mercenaries-Incremental-Adventure/pages` again to confirm.
Expected: `"build_type":"workflow"`.

If this command fails (e.g. permission error, unexpected field name), stop and report — do not proceed to Step 2 with Pages still in `legacy` mode, since the workflow will run successfully but the site will not update.

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Validate the workflow YAML locally**

Run: `gh workflow view deploy.yml 2>&1 || echo "not yet on remote — will validate via push in Step 4"`

This is expected to report the workflow isn't found yet (it doesn't exist on GitHub until pushed) — that's fine. There's no local YAML linter in this project's toolchain, so real validation happens when GitHub parses it on push (Step 4).

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: deploy to GitHub Pages on push to master"
git push origin master
```

- [ ] **Step 5: Watch the workflow run and verify it succeeds**

Run: `gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')`

Expected: both `build` and `deploy` jobs complete with a green checkmark. If `build` fails at the `npm test` step, the deploy job will not run — fix the failing test and re-push rather than bypassing the gate.

- [ ] **Step 6: Verify the live site**

Run: `gh api repos/Skigim/Mercenaries-Incremental-Adventure/pages --jq .html_url`
Expected: `https://skigim.github.io/Mercenaries-Incremental-Adventure/`

Load that URL (e.g. via the browser tooling available in this environment) and confirm:
- The page renders three idle heroes and the starting mission ("Gather by the Roadside"), matching the app's known fresh-boot state.
- No 404s in the network tab for JS/CSS assets (confirms the `base` path from Task 1 is correct).

If the page is blank or assets 404, the most likely cause is a `base` mismatch (Task 1) or Pages still being in `legacy` mode (Step 1 of this task) — check both before further debugging.

No `- [ ] Commit` step here — Step 4 already committed and pushed everything this task changes.

---

## Spec Coverage

| Spec requirement | Task |
|---|---|
| Push-to-master trigger, no manual dispatch | 2 |
| Unit-test-only CI gate | 2 |
| `dist/` build + artifact-based deploy, no `gh-pages` branch | 2 |
| Pages settings switched from `legacy` to `workflow` | 2 |
| Vite `base` set for the project-page subpath | 1 |
| No custom domain | 2 (workflow has no `cname` step) |
| Live-URL verification | 2 |

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-02-github-pages-deploy.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration.
2. **Inline Execution** — tasks executed in this session with checkpoints for review.
