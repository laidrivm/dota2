# Task 4 — Playwright smoke layer, tracer-bullet style

## Context

The e2e suite's job in this project is narrow: prove that agentic changes
didn't break real user paths. We build it as a **tracer bullet** — the
thinnest vertical slice that runs green in CI — and only then expand.
Big-bang test-infrastructure setups fail in ways that are impossible to
debug; one file proving the pipeline works is the whole deliverable here.

The /docs/testing.md "E2E (Playwright)" rules apply from the first line: locator
priority, no waitForTimeout, no serial mode, parallel-safe, fixtures over
copy-paste, no invented cleanup. This is a greenfield — anti-patterns are
forbidden at birth, not refactored later.

Facts you must respect:

- **Precondition**: the app must have at least one user-facing page/route
  to smoke-test. If it doesn't yet, STOP and report — this task is
  premature, do not build test infrastructure against nothing.
- `@playwright/test` is a dependency change: full Dependency safety flow +
  `/warm` afterwards.
- Playwright's test runner officially targets Node. Try running it under
  bun first (`bunx playwright test`); if the runner misbehaves under bun,
  fall back to running tests via Node (setup-node in CI) — do NOT patch or
  work around runner internals, and keep bun for everything else.
- CI must run with `workers: 2` minimum — a single worker hides
  parallelism bugs (shared state) until they hit local runs.

## Steps

### 1. Install and configure

- `bun add --dev --exact @playwright/test @axe-core/playwright`
  (Dependency safety check first, `/warm` after — one report for both;
  @axe-core/playwright is Deque's official Playwright integration).
- `playwright.config.ts`, minimal:
  - `testDir: "e2e"`, `fullyParallel: true`, `forbidOnly: !!process.env.CI`
  - `workers: process.env.CI ? 2 : undefined`
  - `retries: 0` — a flaky test gets fixed, not retried; revisit only with
    an explicit user decision.
  - one project: chromium.
  - `webServer`: start the app (`bun run …`) with `reuseExistingServer:
    !process.env.CI` so tests run against a real instance locally and in CI.
- No global setup, no fixtures file, no page objects in this task.

### 2. The tracer bullet: one smoke test

- Create `e2e/smoke.spec.ts` with tests for the **primary user path only**
  (ask the user which path that is if ambiguous — don't guess).
- Follow CLAUDE.md e2e rules strictly; role-based locators only.
- On every page the smoke test visits, run an axe scan
  (`new AxeBuilder({ page }).analyze()`) and assert zero violations —
  accessibility failures fail the smoke test like any other failure. No
  rule exclusions without an explicit user decision recorded as a comment.
- Run locally 3 times in a row (`bunx playwright test --repeat-each=3`) —
  all green, no flakes, before touching CI.

### 3. CI job

- `.github/workflows/e2e.yml` on `pull_request`:
  checkout → setup bun (pinned SHA, same as other workflows) →
  `bun install --frozen-lockfile` →
  `bunx playwright install --with-deps chromium` →
  `bunx playwright test`.
- Upload the HTML report as an artifact **only on failure**
  (`if: failure()`) — green runs need no artifacts.
- Same workflow hygiene as always: pinned SHAs with version comments,
  `permissions: contents: read`, no `github.event.*` in `run:`.

### 4. Unit-test coverage visibility

- Add package.json script: `"test:coverage": "bun test --coverage"` —
  Bun's built-in coverage reporter, zero dependencies.
- Create `.github/workflows/test.yml` on `pull_request`: checkout → setup
  bun (pinned SHA) → `bun install --frozen-lockfile` →
  `bun run test:coverage`.
- Coverage here is **visibility, not a gate**: do not set thresholds and
  do not fail the build on a percentage. A threshold is a user decision
  for later (fix & capture), made against real numbers, not invented now.
- If no unit test files exist yet when this task runs, still add the
  script, and guard the CI step to no-op with a clear log line until the
  first test file lands; leave a comment to remove the guard then.

### 5. Prove and document

- Open a draft PR with the slice; CI must be green before anything is
  expanded.
- Append to README.md testing section: `bunx playwright test` locally,
  what the smoke suite covers, and the rule that new e2e tests come from
  `/zombies` items marked `(e2e candidate)`.

## Constraints

- Chromium only — more browsers is a later decision, not a default.
- ONE spec file. No page objects, no custom fixtures, no helpers — those
  earn their existence when a second test actually needs shared setup
  (tracer bullet: prove the slice, then expand).
- No retries, no test sharding, no report hosting.
- No coverage thresholds and no coverage services (Codecov etc.) — Bun's
  built-in reporter output only.
- Do NOT add e2e to the pre-push hook or other workflows.

## Acceptance criteria

- [ ] `@playwright/test` and `@axe-core/playwright` are exact
      devDependencies; `/warm` report produced.
- [ ] `playwright.config.ts` matches step 1 (workers 2 in CI, retries 0,
      chromium only, webServer configured).
- [ ] `e2e/smoke.spec.ts` exists, uses role-based locators, contains no
      waitForTimeout / serial / CSS selectors / cleanup code.
- [ ] Every visited page gets an axe scan asserting zero violations; any
      exclusion carries a user-approved comment.
- [ ] Local `--repeat-each=3` run is green.
- [ ] `.github/workflows/e2e.yml` green on a draft PR; report artifact
      uploaded only on failure; SHAs pinned.
- [ ] README.md documents the suite and the `(e2e candidate)` routing.
- [ ] `test:coverage` script exists; `.github/workflows/test.yml` present
      and green.
- [ ] No e2e files beyond the single spec; no coverage thresholds or
      services configured.
