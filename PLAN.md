# Implementation plan — agent working file

Read at session start; updated in the same turn a task or stage completes
or a decision is made (rule in CLAUDE.md). This file holds status and
decisions; the requirements themselves live in `tasks/` and the sources
below.

## Requirement sources

- `tasks/task-1..7.md` — infrastructure tasks (outside the OpenSpec cycle).
- `~/Downloads/`: `user-stories.md`, `model-spec.md`, `data-model.md`,
  `screens-spec.md`, `types.ts`, `fixture-snapshot.json`,
  `generate_fixture.py` — product specs; they enter the repo in phases 1–2
  (via OpenSpec artifacts and source files).
- Design: claude.ai/design project `1a85e755-2bd6-4a75-8f43-c80c62e786a1`
  ("Draft board screen design"), accessed via DesignSync: `tokens/`,
  `styles.css`, Draft Board / Mobile Board mocks, `uploads/design-brief.md`.

## Queue

- [x] **Task 1** — bun supply-chain hardening (commit `b2cd96d`)
- [x] **Task 3** — Biome + tsc + YAML check + actionlint (staged)
- [ ] **Task 2** — Renovate + CI audit ← next step
- [ ] **Task 6** — git hooks (simple-git-hooks)
- [ ] **Phase 1** — OpenSpec: model module (`types.ts` + the 6 acceptance
      tests of model-spec §7 against the fixture; camelCase fix on import)
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
  1.3.14 in CI; Renovate maintains the hashes after Task 2.
- IBM Plex fonts: self-hosted (decided in favour of offline operation).
- Hooks: simple-git-hooks, not husky; e2e never runs in hooks.
- All repo artifacts are in English (CLAUDE.md rule).

## Gates (reminder)

- `/warm` after any dependency-manifest change.
- `/zombies` after non-trivial code; in the OpenSpec cycle — at propose
  (from the description) and at review (diff mode).
- `/triage` — suggested to the user before every PR, never self-run.
- Commits/pushes — only when the user asks.
