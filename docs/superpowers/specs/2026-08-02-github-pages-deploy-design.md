# GitHub Pages Deploy — Design

**Goal:** Get MerchantNext hosted at `https://skigim.github.io/Mercenaries-Incremental-Adventure/` so it can be handed to a playtester, staying current automatically as work lands on `master`.

## Architecture

A single GitHub Actions workflow, `.github/workflows/deploy.yml`, triggered on every push to `master`. Two jobs, following GitHub's standard Actions-based Pages pattern:

- **`build`** — checkout, `npm ci`, `npm test` (gate), `npm run build`, upload `dist/` as a Pages artifact.
- **`deploy`** — depends on `build`; publishes the artifact via `actions/deploy-pages`.

No `gh-pages` branch, no manual publish scripts — the deployment is entirely artifact-based and owned by the Actions job.

### Repo configuration prerequisite

As of this writing, the repo's Pages settings are `"build_type": "legacy"` with source = branch `master`, path `/`. In that mode GitHub tries to serve the raw source tree directly — including `index.html`'s unbuilt `/src/ui/main.tsx` module reference — which does not render the app. This must be switched to `build_type: "workflow"` (via `gh api -X PUT repos/Skigim/Mercenaries-Incremental-Adventure/pages -f build_type=workflow`) so Pages is driven by the Actions job instead. This is a one-time change to the repository's settings, done once as part of this implementation, not a per-deploy step.

## Components

- **`vite.config.ts`** — gains `base: '/Mercenaries-Incremental-Adventure/'`. Required because this is a GitHub *project* page (served under a subpath, not at a domain root), so built asset URLs need that subpath baked in at build time. No SPA-routing fallback (`404.html` trick) is needed — the app has no client-side router (confirmed: no `react-router` or `BrowserRouter` usage anywhere in `src/`).
- **`.github/workflows/deploy.yml`** — the workflow described above. Required permissions: `contents: read`, `pages: write`, `id-token: write`; `deploy` job targets the `github-pages` environment (GitHub's convention for Pages deploys, gives a deployment history/URL in the repo's UI).

## Data flow

1. Push lands on `master` (directly, or via a merged feature branch — matches current workflow).
2. `build` job runs `npm test` (146 unit tests, unit-only — E2E is intentionally excluded from this gate, per the recommendation that CI stay fast; E2E remains a local pre-push check).
3. On test success, `npm run build` produces `dist/`, uploaded as the Pages artifact.
4. `deploy` job publishes that artifact; the live URL updates within roughly a minute of the workflow completing.

## Error handling

If `npm test` fails, the job stops before `npm run build` runs. The `deploy` job never executes, and whatever was last successfully deployed remains live — a broken build never reaches the playtester. Build (`tsc --noEmit && vite build`) failures behave the same way: the job stops, prior deployment is untouched.

## Testing / acceptance

No new automated tests — this is infrastructure/config, not application behavior. Acceptance criteria:

1. The workflow file is valid YAML and the `build`/`deploy` job graph matches GitHub's documented Actions-Pages pattern.
2. A push to `master` produces a green workflow run.
3. `https://skigim.github.io/Mercenaries-Incremental-Adventure/` loads the app and it boots (verified manually once live).

## Explicit non-goals

- No custom domain / `CNAME` (default `github.io` URL only).
- No manual-trigger (`workflow_dispatch`) input — deploys are push-to-master-only, per decision.
- No E2E gate in CI — unit tests only, per decision.
- No save-data considerations beyond noting: `localStorage` is scoped per-origin, so a playtester's save persists across visits to this URL as long as the path (`base`) doesn't change later.
