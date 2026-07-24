## Context

`bun test` covers pure modules only — the project decided against a DOM test
environment, so every guarantee that needs layout, focus, storage or a real
fetch has been verified by hand in Chrome and ticked as **(e2e)** in the
phase-2 task lists. Four such bullets exist in `ui-foundation`
(1.5, 6.4, 6.5, 6.6) and roughly twenty-five more across `draft-board` and
`hero-picker`.

This change builds the layer they will live in, tracer-bullet style: the
thinnest vertical slice that runs green in CI. The slice, not the coverage,
is the deliverable — a big-bang test-infrastructure setup fails in ways
nobody can debug, and expanding a pipeline that already works is cheap.

The app is served by `server.ts` under `bun run dev`; `Bun.serve` with no
explicit port listens on 3000 unless `BUN_PORT`/`PORT` says otherwise.

## Goals / Non-Goals

**Goals:**

- One spec file whose tests pass three times in a row locally and green in
  CI, proving the whole pipeline: runner, browser, app under test, axe,
  workflow.
- The `ui-foundation` **(e2e)** bullets 6.4, 6.5 and 6.6 automated.
- An accessibility floor that fails the build, not a report nobody reads.
- Unit-coverage numbers visible on every PR without becoming a gate.

**Non-Goals:**

- Coverage of the board, picker, hotkeys and layout — the 2b/2c bullets.
- Any shared test infrastructure (page objects, fixtures, helpers). The
  second spec file is what earns those, not this one.
- Cross-browser, sharding, retries, hosted reports, coverage thresholds.

## Decisions

### The suite targets `bun run dev`, not `dist/`

`webServer` runs `bun run dev`. The alternative — build and serve `dist/`
— is closer to production but costs a full `bun build` on every run and a
second static server, and it tests the bundler more than the app. The dev
server is also the only thing that serves `/snapshot.json`, which every
test needs.

Consequence: bundler-specific breakage (an inlined font, a missing snapshot
copy) is not caught here. It does not need to be — `build.test.ts` already
asserts exactly that, in the default `bun test` run.

### `ui-foundation` 1.5 stays out of this slice

Bullet 1.5 — "`dist/` served by a plain static file server loads and reaches
Setup" — is the one **(e2e)** bullet this change does not automate.
`build.test.ts` already proves `dist/` carries its snapshot, its four font
faces and its untouched inline `@import`, and that no font was inlined as a
data URI. What remains unproven is only "…and the bundle boots in a
browser", and buying that costs a second `webServer` entry plus a build on
every e2e run — for a build whose contents are already asserted.

It belongs with Task 7, which introduces the container that actually serves
`dist/`: at that point the static-serve target exists for its own reasons
and the test is nearly free. Recorded here so the bullet is not silently
lost.

### Try the runner under bun; fall back to node, do not patch

`bunx playwright test` first. Playwright's runner officially targets Node
(`engines: node >=20`), so if it misbehaves — worker spawn, module
resolution, reporter output — the fallback is `setup-node` in CI and `npx`
locally, with bun kept for everything else. Working around runner internals
is not an option: a patched runner is worse than a second toolchain.
**Resolved: bun wins.** `bunx playwright test` runs the suite, spawns its
workers, starts the `webServer` and reports normally; no node toolchain is
introduced anywhere.

`e2e/*.spec.ts` does match bun's own test glob, though, so `bunfig.toml`
gains `[test] pathIgnorePatterns = ["e2e/**"]` — set there rather than on a
script, so a bare `bun test` and the pre-push hook are covered by the same
line.

### No fixtures file: each test builds its own state

Playwright gives every test a fresh browser context, so `localStorage`
starts empty and no test can see another's session — the parallel-safety
requirement is met by the runner's defaults rather than by cleanup code.
The cold-cache scenario is a per-test `page.route("**/snapshot.json", …)`
that aborts, unrouted mid-test to prove recovery. No `beforeEach`, no
worker fixture, nothing shared and mutable.

### Focus visibility is read from the label, not the input

The radios are `appearance: none; opacity: 0` and carry `outline: none`;
the visible ring is drawn on the enclosing `.chip` label by
`:has(input:focus-visible)`. The assertion therefore reads the computed
`outline-style`/`outline-width` of the focused input's parent and compares
it with an unfocused sibling's. `:focus-visible` matches only for keyboard
interaction, which is what the test uses anyway.

This reads computed style through `evaluate`; it selects nothing by CSS, so
the locator-priority rule is untouched.

### Accessible names carry the hotkey hint, and the locators say so

The `.kbd` hint renders inside the `<label>`, so a side option's accessible
name is `R Radiant` and a role option's is `1 C Carry` — not `Radiant` and
`Carry`. The locators match those names as written rather than reaching for
a substring match, because the hint is part of what the control announces
and a test that hides it would stop noticing if it disappeared.

### "Without a page reload" is proven by a witness on `window`

The retry scenario has to distinguish a re-fetch from a navigation. A value
set on `window` before retry, still present after the app renders, proves
the document survived. `page.on("load")` counting is the alternative and is
racier.

### Axe scans every state the suite reaches, with no exclusions

`new AxeBuilder({ page }).analyze()` after each state transition — Setup,
board, error state — asserting `violations` is empty. No rule is disabled.
If the shipped UI fails a scan, the app is fixed; an exclusion needs a user
decision recorded as a comment at the exclusion site.

### Coverage is a workflow, not a gate

`bun test --coverage` in its own `pull_request` workflow. Unit tests already
exist, so the no-op guard task-4.md describes for an empty suite is not
needed. No threshold: a threshold set before anyone has looked at the
numbers is a number someone will lower.

### What the scans found, and what was changed for them

The first green scan cost three app changes, all of them defects the suite
was built to find:

- **No `<h1>` anywhere** (`page-has-heading-one`). The product name was a
  `<span>`; it is now the page's one `h1`, sized by `font-size: inherit` so
  nothing moves. The snapshot error state renders without the header, so it
  carries its own — a page with no heading names nothing.
- **`--text-5` at 3.10:1** on panels (WCAG AA wants 4.5:1), across section
  labels, provenance and the edit hint. Raised to `#7e8897`, which clears
  4.5:1 on every surface in the palette including `--bg-3`.
- **Hero tile lettering below AA on 13 of 52 colours**, worst 3.98:1. No
  threshold could rescue them: the softened ink pair simply cannot reach
  4.5:1 on a mid-tone. The inks become pure `#000`/`#fff` and
  `INK_THRESHOLD` moves 0.22 → 0.18, the luminance where the two contrast
  equally. Every hero colour then clears AA, worst 4.64:1.

The threshold move also revives a test PLAN.md records as deliberately
dropped: with two fixed inks the worst case was pinned at the threshold, so
a contrast floor guarded nothing. It guards something now, and
`format.test.ts` asserts it over the whole palette — which is where a new
hero colour that cannot reach AA will fail, long before a browser sees it.

All three token values are design-owned and get pushed back to the design
project, following the precedent set by `--tile-ink-*` in proposal 2b.

### Two ZOMBIES findings that stay unautomated

A 200 response carrying a malformed body stays a unit case —
`snapshot.test.ts` already covers `isBundle` against every shape. And a
double-retry race cannot occur: activating retry clears the result, which
unmounts the error state along with its button.

## Risks / Trade-offs

- **axe finds violations in the shipped UI** → they are defects, fixed in
  this change; the scan is not weakened. If one is a genuine axe false
  positive, it becomes a user decision with a comment, not a silent
  exclusion.
- **The Playwright runner misbehaves under bun** → node fallback above, with
  bun kept for install, build and unit tests.
- **`reuseExistingServer` locally can run the suite against a stale dev
  server** → accepted for local speed; CI always starts its own instance
  (`!process.env.CI`).
- **Chromium download adds ~30 s and ~150 MB to every PR run** → the price
  of a browser test; no cache layer until the run time is actually a
  complaint.
- **A dev-server-only target hides production-bundle breakage** → covered by
  `build.test.ts`; revisited when Task 7 gives the suite a static target.
- **The suite grows by copy-paste** once the 2b/2c bullets arrive → the
  next e2e change is where fixtures are introduced, and the one-spec-file
  constraint is explicitly a property of this slice only.

## Open Questions

- None blocking. Whether the runner stays on bun is answered during apply,
  by running it.
