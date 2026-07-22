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
- [ ] **Task 8** — split `CLAUDE.md` per its own growth protocol
- [ ] **Task 9** — unit test setup (blocked: task 8, phase 1)
- [ ] **Phase 1** — OpenSpec: model module (`types.ts` + the 6 acceptance
      tests of model-spec §7 against the fixture; camelCase fix on import)
      ← next step (enters the OpenSpec cycle: `/opsx:propose`)
- [ ] **Phase 2** — OpenSpec: draft board UI on Preact + design-token
      import; likely 2 sequenced proposals (board shell → picker/hotkeys/
      edge cases)
- [ ] **Task 4** — Playwright smoke (precondition: a UI exists)
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
- IBM Plex fonts: self-hosted (decided in favour of offline operation).
- Hooks: simple-git-hooks, not husky; e2e never runs in hooks.
- All repo artifacts are in English (CLAUDE.md rule).
- No OpenSpec exemptions: the criterion in CLAUDE.md is the only test.
- Unsorted product specs live in `spec-inbox/`, gitignored except its
  README — the public repo carries the pointer, never the content.

## Gates (reminder)

- `/warm` after any dependency-manifest change.
- `/zombies` after non-trivial code; in the OpenSpec cycle — at propose
  (from the description) and at review (diff mode).
- `/triage` — suggested to the user before every PR, never self-run.
- Commits/pushes — only when the user asks.
