# Playwright smoke layer — tasks

Test tasks come from the proposal-stage `/zombies` run. This is a test
change, so the usual "tests before the module" ordering collapses: the spec
file *is* the deliverable, and the ZOMBIES findings are folded into the
assertions of §3 and §4 and into the configuration checks of §2 and §5.

Bullets the ZOMBIES run produced that this change deliberately does not
automate are listed in §6 with their reason.

## 1. Dependencies and ignore rules

- [ ] 1.1 Add `test-results/`, `playwright-report/` and `blob-report/` to
      `.gitignore` **before** the first runner invocation writes them
      (CLAUDE.md — verify `.gitignore` covers a tool's outputs first).
- [ ] 1.2 `bun add --dev --exact @playwright/test @axe-core/playwright`;
      the registry check is already done (see proposal Impact), `/warm`
      runs over the manifest change in §7. (AC: exact devDependencies)
- [ ] 1.3 Install the browser: `bunx playwright install chromium`, and
      confirm `bunx playwright --version` answers under bun. If the runner
      misbehaves, take the node fallback from design.md and record which
      won as a decision — do not patch runner internals.

## 2. Runner configuration

- [ ] 2.1 `playwright.config.ts`: `testDir: "e2e"`, one chromium project,
      `fullyParallel: true`, `forbidOnly: !!process.env.CI`,
      `workers: process.env.CI ? 2 : undefined`, `retries: 0`,
      `use.baseURL: "http://localhost:3000"`. (Req: smoke-suite — The suite
      is parallel-safe and never retried / CI configuration)
- [ ] 2.2 `webServer`: `command: "bun run dev"`, the same URL, and
      `reuseExistingServer: !process.env.CI`. (Req: smoke-suite — The suite
      runs against a real running app, both scenarios)
- [ ] 2.3 Verify `bunfig.toml` declares no `coverageThreshold` — a
      threshold there would turn the coverage job into a gate. (Req:
      smoke-suite — Unit coverage is reported on every pull request)
- [ ] 2.4 No global setup, no fixtures file, no page objects, no helpers.
      (Constraint: tracer bullet)

## 3. The smoke spec — Setup path

All of §3 lives in `e2e/smoke.spec.ts`.

- [ ] 3.1 Assert the Setup block is reached on a first load with empty
      storage, before anything else runs. (Req: smoke-suite — Setup is
      completable by keyboard alone; ZOMBIES Zero)
- [ ] 3.2 Locate the `Side` and `Role` radio groups by role and accessible
      name, and their options by the names the `.kbd` hint actually
      produces — `R Radiant`, `1 C Carry` and their siblings, not the bare
      labels. (Req: smoke-suite — Side and role are named groups; ZOMBIES
      Interface)
- [ ] 3.3 Drive both groups with keyboard input only and assert each
      activated option reports itself checked; assert Tab treats a group as
      one stop and the arrow keys move within it. (Req: smoke-suite — The
      keyboard reaches and operates the controls)
- [ ] 3.4 Assert the focus ring: after keyboard focus — never a scripted
      `focus()`, which does not match `:focus-visible` — the focused
      input's enclosing label differs in computed `outline-style` or
      `outline-width` from an unfocused sibling label. (Req: smoke-suite —
      Keyboard focus is visible; ZOMBIES Boundaries)
- [ ] 3.5 Assert `R` then `3` pressed with nothing focused select Radiant
      and Offlane. (Req: smoke-suite — The document hotkeys drive Setup;
      ZOMBIES Simple)
- [ ] 3.6 Assert a side alone leaves Setup on screen — the board needs both
      fields. (ZOMBIES One)
- [ ] 3.7 Assert both choices collapse Setup into the board with no confirm
      step, and that the header names the chosen side and role. (Req:
      smoke-suite — The board replaces Setup)
- [ ] 3.8 Assert a reload renders the board directly, with the Setup block
      never appearing, and the same side and role still named. (Req:
      smoke-suite — A reload restores the choices)

## 4. The smoke spec — cold-cache snapshot failure

- [ ] 4.1 Abort requests to the snapshot URL for this test only, by
      connection abort rather than a delayed response — `fetchBundle`
      carries `AbortSignal.timeout(8000)` and a stall would burn it inside
      the test budget. (Req: smoke-suite — The snapshot route is
      unreachable with no cache; ZOMBIES Boundaries)
- [ ] 4.2 Assert the live region is present **and** contains the error
      message, and that a retry control is present. (Req: smoke-suite — The
      snapshot route is unreachable with no cache; ZOMBIES Interface)
- [ ] 4.3 Make the snapshot reachable again, activate retry, and assert
      Setup is reached with the document that started the test still
      current. (Req: smoke-suite — Retry recovers without reloading)

## 5. Accessibility scans

- [ ] 5.1 Scan Setup, the board, and the snapshot error state, asserting an
      empty violations array on each. (Req: smoke-suite — Every reached
      page state passes an accessibility scan)
- [ ] 5.2 Order every scan after an assertion that its target state is
      present — `App` renders `null` until the snapshot resolves, and a
      scan of an empty document passes vacuously. (Req: smoke-suite — A
      scan never runs against an unrendered page; ZOMBIES Zero)
- [ ] 5.3 Fix any violation the scans find in the app itself. No rule is
      disabled or excluded without the user's decision recorded as a
      comment at the exclusion site. (Req: smoke-suite — Every reached page
      state passes an accessibility scan)

## 6. Findings deliberately not automated here

- [ ] 6.1 Record in design.md that a 200 response with a malformed body
      stays a unit case — `snapshot.test.ts` covers `isBundle` — and that
      double-retry is impossible because the control unmounts with the
      error state. (ZOMBIES Exceptions)
- [ ] 6.2 Record that `reuseExistingServer` would silently reuse a
      non-app process on port 3000, accepted as a local-only cost because
      CI always starts its own instance. (ZOMBIES Boundaries)

## 7. Gates

- [ ] 7.1 `bunx playwright test --repeat-each=3` green locally, no flakes,
      before CI is touched. (Req: smoke-suite — Repeated runs are stable;
      AC: local `--repeat-each=3` run is green)
- [ ] 7.2 Confirm two workers stay isolated — the parallel run must not
      depend on one test's `localStorage` being another's. (Req:
      smoke-suite — The suite is parallel-safe and never retried; ZOMBIES
      Many)
- [ ] 7.3 `.github/workflows/e2e.yml` on `pull_request`: checkout → setup
      bun (SHA-pinned, bun 1.3.14, same as `lint.yml`) → `bun install
      --frozen-lockfile` → `bunx playwright install --with-deps chromium`
      → `bunx playwright test`; `permissions: contents: read`; report
      artifact uploaded under `if: failure()` only; no `github.event.*` in
      any `run:`. (Req: smoke-suite — The browser suite runs on pull
      requests and only there, both scenarios)
- [ ] 7.4 Add the `test:coverage` script and `.github/workflows/test.yml`
      running it on `pull_request` with the same pinned setup — no
      threshold, no coverage service. Note that the run includes
      `build.test.ts`, which spawns a real `bun run build`. (Req:
      smoke-suite — Unit coverage is reported on every pull request)
- [ ] 7.5 Confirm the pre-push hook is untouched and starts no browser.
      (Req: smoke-suite — The push path is unaffected)
- [ ] 7.6 README testing section: `bunx playwright test` locally, what the
      smoke suite covers, and that new e2e tests arrive as `/zombies`
      findings marked `(e2e candidate)`. (AC: README documents the suite
      and the routing)
- [ ] 7.7 `bun run lint`, `bun run typecheck`, `bun test` all green.
- [ ] 7.8 Pre-PR sequence over the final diff: `/zombies` (diff mode) →
      `/warm` (a manifest changed) → `/ponytail-review` → `/triage`, each
      report shown and acted on.
- [ ] 7.9 `PLAN.md` updated: Task 4 marked done, the deferred
      `ui-foundation` 1.5 bullet and the 2b/2c `(e2e)` backlog recorded as
      decisions.
