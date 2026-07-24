# Implementation plan — agent working file

Read at session start; updated in the same turn a task or stage completes
or a decision is made (rule in CLAUDE.md). This file holds status and
decisions; the requirements themselves live in `tasks/` and the sources
below.

## Requirement sources

- `tasks/task-1..9.md` — infrastructure tasks.
- `spec-inbox/` (gitignored, see its README) — unsorted product specs:
  `user-stories.md`, `model-spec.md`, `data-model.md`, `screens-spec.md`,
  `types.ts`, `fixture-snapshot.json`, `generate_fixture.py`. They enter
  the repo in phases 1–2 via OpenSpec artifacts and source files.
- Design: the private claude.ai/design project "Draft board screen design",
  accessed via DesignSync: `tokens/`, `styles.css`, Draft Board / Mobile
  Board mocks, `uploads/design-brief.md`.

## Queue

- [x] **Task 1** — bun supply-chain hardening (commit `b2cd96d`)
- [x] **Task 3** — Biome + tsc + YAML check + actionlint (staged)
- [x] **Task 2** — Dependabot + CI audit (`dependabot.yml`, `audit.yml`);
      awaits manual repo-settings enablement — see checklist below
- [x] **Task 6** — git hooks (simple-git-hooks): pre-commit `biome check
      --staged` (block, no autofix), pre-push `typecheck && bun test
      --pass-with-no-tests`; both demonstrated firing; `/warm` → Keep
- [x] **Task 8** — split `CLAUDE.md` per its own growth protocol (321 →
      186 lines; `docs/api-design.md`, `docs/testing.md`,
      `docs/feature-workflow.md`)
- [x] **Task 9** — unit test setup: native `bun:test`, no framework;
      landed with the model tests (`src/model.test.ts`).
- [x] **Phase 1** — OpenSpec: model module. Merged (PR #8) and archived
      (`openspec/changes/archive/2026-07-23-model-module`; capability spec
      at `openspec/specs/draft-model/`). Shipped `src/{types,model}.ts`,
      `src/fixtures/`, `src/model.test.ts` (31 tests). Two §7 scenarios
      corrected mid-apply — see decisions.
- [x] **Phase 2** — OpenSpec: draft board UI on Preact + design-token
      import. Split into three sequenced proposals, all merged and archived:
  - [x] **2a `ui-foundation`** — merged (PR #10) and archived
        (`openspec/changes/archive/2026-07-24-ui-foundation`; capability
        specs at `openspec/specs/{app-shell,snapshot-delivery,draft-session}`).
        Shipped `index.html`, `server.ts`, `static-routes.ts`, `src/app/**`,
        133 tests. Two design decisions reversed mid-apply — see decisions.
  - [x] **2b `draft-board`** — merged (PR #13) and archived
        (`openspec/changes/archive/2026-07-24-draft-board`; capability specs at
        `openspec/specs/{draft-board,draft-session}`). Shipped the bans row,
        team and enemy slots, suggestion blocks, the result block, the
        collapsed header + editor, the 390px one-column layout, and the first
        `computeModel` call. 244 tests. Corrections mid-apply — see decisions.
  - [x] **2c `hero-picker`** — merged (PR #15 for the proposal, PR #16 for the
        implementation) and archived
        (`openspec/changes/archive/2026-07-24-hero-picker`; capability specs at
        `openspec/specs/{hero-picker,draft-board,draft-session}`). Shipped
        `src/app/picker/`, the reset dialog and undo toast, board hotkeys with
        the `modal` context, `usedAs`, the `re-pick` marker, and three overlay
        tokens pushed to the design project. 319 tests; every **(e2e)** bullet
        walked by hand in Chrome. Corrections mid-apply — see decisions.
- [ ] **Task 4** — Playwright smoke (precondition: a UI exists); its first
      scenarios are the tasks marked **(e2e)** in `ui-foundation/tasks.md`
- [ ] **Task 7** — Docker + VPS deploy (open decisions: registry
      GHCR/Docker Hub, same VPS or a new one)
- [ ] **Phase 4** — OpenSpec: STRATZ → Postgres → snapshot bundle pipeline
      (blockers: API key, pick-phase granularity in STRATZ)
- [ ] **Task 5** — error tracking (precondition: product is deployed)

## Accepted decisions

- UI stack: **Preact** (first runtime dependency, WARM in phase 2).
- Deploy: **Docker on a VPS**.
- **camelCase in all JSON** — types.ts / fixture / generator get renamed
  keys when imported into the repo (phase 1); the bundle contract too.
- Phase 1 corrections (found during apply, spec updated): §7.1 counter-risk
  is NOT zero at an empty draft (open=1, pop=contest), so "pure meta+side"
  ordering holds only up to that term; §7.3 antisymmetry holds only to ~1
  dp, not 1e-6, because my roles are known while enemy roles are inferred.
- Fixture is Biome-owned format: regenerate from the repo root with
  `python3 src/fixtures/generate_fixture.py > src/fixtures/snapshot.json &&
  bunx biome format --write src/fixtures/snapshot.json`.
- `computeModel` trusts a well-formed session (the UI is the validation
  boundary); a hero in two sets is undefined behavior, not defended — no
  extra validation code.
- STRATZ: the user provides the API key; rate limits —
  https://stratz.com/knowledge-base/API/Are%20there%20any%20rate%20limits%3F;
  pick phases: extract via GraphQL or defer to v2.
- GitHub Actions: pin by full commit SHA + version comment; bun pinned to
  1.3.14 in CI.
- Dependency bot: **Dependabot**, not Renovate — it meets every Task 2
  requirement (bun ecosystem, 3-day `cooldown`, security updates bypass
  cooldown, keeps actions SHA-pinned) and is first-party, so no third-party
  GitHub App gets write access to this hardening-focused repo. Trade-off:
  no Dependency Dashboard and no lockFileMaintenance; the nightly
  `bun audit` compensates for the latter.
- Build tooling: **Bun's native bundler only**, no Vite. `bun run build` is
  `bun build ./index.html --outdir=dist` plus copy steps for the fonts and
  the snapshot; `bun run dev` is `server.ts` under `--hot`.
- `server.ts` + `static-routes.ts` serve the app in dev and production; Task
  7 containerises them. Bun's CSS bundler inlines every `url()` asset as
  base64 and its HTML dev server serves no static files, so the font faces
  and the snapshot are served from their own routes instead.
- IBM Plex fonts: self-hosted (decided in favour of offline operation).
  Mono has no variable release, so weights are separate Latin1 `woff2` faces
  taken from IBM's own packages — Sans 400/600, Mono 400/600 so far — with
  the OFL licence beside them in `src/app/styles/fonts/`. `fonts.css` holds
  the `@font-face` rules, stays out of the bundler, and index.html pulls it
  in with an inline `@import`, which Bun leaves alone. No font package.
- Snapshot reaches the client through a **URL** — the constant
  `/snapshot.json` in `src/app/snapshot.ts` — never a module import, so
  Phase 4 replaces the producer and nothing else. Not a hashed bundler
  asset either: that would force a rebuild to publish a snapshot. Last good
  bundle cached in `localStorage`.
- No DOM test environment: pure modules get `bun:test`, DOM-level scenarios
  are e2e (Task 4). No `happy-dom` dependency.
- `build.test.ts` stays in the default `bun test` run (and so in the pre-push
  hook), not CI-only: the copy steps and the inline-`@import` behaviour it
  guards fail silently, and catching that at push is worth ~200 ms.
- Hooks: simple-git-hooks, not husky; e2e never runs in hooks.
- All repo artifacts are in English (CLAUDE.md rule).
- No OpenSpec exemptions: the criterion in `docs/feature-workflow.md` is
  the only test.
- Unsorted product specs live in `spec-inbox/`, gitignored except its
  README — the public repo carries the pointer, never the content.
- Hero tiles take their background from the `--hero-<short>` token and derive
  their ink from that colour's relative luminance (threshold 0.22), so the
  palette is never restated in TypeScript. CSS `contrast-color()` was rejected
  — it flips the palette's mid-tone blues to black. The derived ink differs
  from the mock on exactly one hero (Wraith King), in favour of contrast.
  `tokens/colors.css` gains `--tile-ink-dark`, `--tile-ink-light`, and
  `--hero-fallback`, pushed back to the design project to keep the copy
  verbatim.
- Proposal 2b enters picks through a temporary native `<select>` so the board
  is usable and testable before the picker exists; 2c deletes it and points
  the same `applyAction` seam at the picker overlay.
- Side/role hotkeys become context-scoped in 2b (Setup or the open header
  editor only), because 2c reuses `1`–`5` on the board for the picker. The
  document listener reads that context through a ref and is installed once:
  re-subscribing per context change dropped the first keystroke after the
  editor opened, because effects flush a frame later than the click.
- 2c: both overlays are native `<dialog>` + `showModal()` (platform focus trap,
  inert background, Esc); reset keeps side and role and clears only the draft,
  as the design's own dialog copy promises; undo is one level, stored under
  `draft.backup`, dropped by the first draft action after a reset.
- 2c corrections found during apply: `apply` closed the undo window on the
  action's kind, so a refused ban dropped the backup — the decision now reads
  the reducer's result; Space on a grid tile was swallowed by the
  printable-key branch instead of pressing the tile; the post-pick focus
  redirect took the first removal control of a region, which after a fifth
  enemy pick is somebody else's hero. A planned `isUsed`/`usedAs` equality
  test was dropped: with `isUsed` defined as the wrapper it passes against any
  implementation.
- 2c: taken tiles use `aria-disabled`, not `disabled`, so the arrow keys keep
  the grid's geometry and a screen reader still reads them out. Only their
  artwork dims — fading the `ban`/`team`/`enemy` label with it would hide the
  one thing a taken tile says, which is where the mock is departed from.
- 2c: the picker grid is one tab stop with roving `tabIndex`, reversing
  design.md — the state that decision priced in turned out to be the `first`
  match the grid already computes.
- 2b corrections found during apply: the planned contrast-floor test for the
  tile ink guards nothing (with two fixed inks the worst case is pinned at
  the threshold), so the suite guards the palette tokens parsing instead; and
  a tile carries an accessible name only where its row does not already name
  the hero, so a screen reader hears it once.

## Gates (reminder)

- Before every PR: `/zombies` → fix → `/warm` (only when a manifest changed)
  → `/ponytail-review` → `/triage`, in that order and all self-run; act on
  every finding, report what is skipped and why (CLAUDE.md — Review toolkit).
- `/zombies` also at propose, from the feature description.
- `/coderabbit` once the PR has the bot's comments.
- Commit per completed task-list item without being asked
