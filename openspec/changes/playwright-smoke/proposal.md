# Playwright smoke layer — proposal

## Why

Every DOM-level guarantee this app makes is currently verified by hand:
the three phase-2 proposals ticked their **(e2e)** bullets by walking a
browser, and `bun test` cannot reach them because the project deliberately
runs without a DOM environment. That leaves the paths a user actually takes
unguarded against agentic change, which is the one job an e2e suite has
here. Task 4's precondition — a UI to smoke-test — is now met.

## What Changes

- Add `@playwright/test` and `@axe-core/playwright` as exact
  devDependencies (Deque's official Playwright integration; both vetted —
  see Impact).
- Add `playwright.config.ts`: `testDir: "e2e"`, chromium only,
  `fullyParallel`, `workers: 2` in CI, `retries: 0`, and a `webServer` that
  starts `bun run dev` and reuses a running instance outside CI.
- Add one spec, `e2e/smoke.spec.ts`, covering the primary path — load,
  choose side and role by keyboard, watch Setup collapse into the board,
  reload and find the session restored — plus the cold-cache snapshot
  failure and its retry. Every page state the suite reaches gets an axe
  scan asserting zero violations.
- Add `.github/workflows/e2e.yml` on `pull_request`, uploading the HTML
  report only when the run fails.
- Add a `test:coverage` script (`bun test --coverage`, Bun's built-in
  reporter) and `.github/workflows/test.yml` running it on `pull_request` —
  visibility, with no threshold and no coverage service.
- Document the suite in README: how to run it, what it covers, and the rule
  that new e2e tests arrive as `/zombies` findings marked `(e2e candidate)`.

## Capabilities

### New Capabilities

- `smoke-suite`: the browser-level verification layer — what it must prove
  about the running app, the conditions it runs under (real instance,
  parallel workers, no retries), and the accessibility floor it enforces on
  every page state it reaches.

### Modified Capabilities
<!-- none: no application behaviour changes -->

## Non-goals

- **No second browser**: chromium only. Firefox and WebKit are a later
  decision with a cost, not a default.
- **No test infrastructure beyond the one spec**: no page objects, no
  fixtures file, no helpers, no global setup. They earn their existence
  when a second spec needs shared setup; a tracer bullet that ships
  scaffolding is not a tracer bullet.
- **No retries, sharding, or report hosting**: a flake gets fixed, not
  retried.
- **No coverage threshold and no coverage service**: a threshold is a user
  decision made against real numbers, which do not exist yet.
- **e2e never enters the pre-push hook** or any existing workflow — it is
  its own job, on pull requests only.
- **The 2b/2c `(e2e)` bullets stay out.** The board, picker, hotkey and
  layout scenarios from `draft-board` and `hero-picker` are ~25 further
  cases; they arrive after this slice runs green in CI, and they are what
  the one-spec-file constraint gets relaxed for.
- **`ui-foundation` 1.5 stays out** — see design.md for the argument.

## Impact

- Dependencies: `@playwright/test` 1.61.1 (microsoft/playwright, first
  published 2020-09-24, 48.0M weekly downloads) and `@axe-core/playwright`
  4.12.1 (dequelabs/axe-core-npm, 2021-06-02, 6.8M weekly) — both pass the
  registry check; `/warm` runs on the manifest change before the PR.
  1.62.0 is the published latest, but `bunfig.toml`'s three-day
  `minimumReleaseAge` held it back — the gate doing its job, not a pin.
- New files: `playwright.config.ts`, `e2e/smoke.spec.ts`,
  `.github/workflows/{e2e,test}.yml`.
- Changed files: `package.json` (two devDependencies, `test:coverage`),
  `.gitignore` (Playwright's `test-results/`, `playwright-report/`,
  `blob-report/`), `README.md` (testing section).
- No application source changes — unless an axe scan finds a violation in
  the shipped UI, in which case the app is fixed rather than the rule
  excluded.
- CI cost: one more job per PR, plus a chromium download in it.
