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
- [ ] **Phase 2** — OpenSpec: draft board UI on Preact + design-token
      import. Split into three sequenced proposals:
  - [x] **2a `ui-foundation`** — merged (PR #10) and archived
        (`openspec/changes/archive/2026-07-24-ui-foundation`; capability
        specs at `openspec/specs/{app-shell,snapshot-delivery,draft-session}`).
        Shipped `index.html`, `server.ts`, `static-routes.ts`, `src/app/**`,
        133 tests. Two design decisions reversed mid-apply — see decisions.
  - [ ] **2b `draft-board`** ← next step is Stage 1 (`/opsx:propose`)
        Board panels: bans, team slots, enemy slots with role probabilities,
        suggestion blocks, result block. First `computeModel` call. Owns the
        390px one-column layout — no `@media` rule exists yet, and the Setup
        strip has never been rendered at that width.
  - [ ] **2c `hero-picker`** — picker overlay (search/aliases/grid/keyboard),
        board hotkeys + context routing, New/reset dialog, undo toast,
        screens-spec §6 edge cases.
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

## Gates (reminder)

- `/warm` after any dependency-manifest change.
- `/zombies` after non-trivial code; in the OpenSpec cycle — at propose
  (from the description) and at review (diff mode).
- `/triage` — suggested to the user before every PR, never self-run.
- Commit per completed task-list item without being asked
