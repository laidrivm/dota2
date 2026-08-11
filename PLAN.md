# Implementation plan — agent working file

Read at session start; updated in the same turn a task or stage completes or a
decision is made (rule in CLAUDE.md). This file holds the open queue, the
sources still feeding it, and the constraints still in force. What a completed
change decided lives in its archived proposal under `openspec/changes/archive/`.

## Growth protocol

- **What lives here**: work not yet done, the requirement sources still feeding
  it, and the standing constraints no single file owns.
- **What evicts an entry**: its change reaching the archive. A completed queue
  entry collapses to its outcome and its archive path, on one line.
- **Where the evicted thing goes**, tested in this order, because an entry can
  satisfy more than one: a fence a reader would otherwise remove → a comment at
  that line, unless one already stands; then a fact the archive records →
  deleted; then a standing constraint no single site owns → kept below.
- An archived change is never edited to receive an evicted entry. The archive
  records what was proposed and applied; a fact discovered later is written
  where it is enforced instead.
- A kept constraint that is later overtaken — the dependency dropped, the
  approach replaced — is deleted rather than left standing, on the terms
  `CLAUDE.md` already applies to a stale rule.
- This file counts against the always-on budget stated in `CLAUDE.md`
  §*Structure & growth of this file*.

## Requirement sources

- `tasks/task-5.md`, `tasks/task-7.md` — the infrastructure tasks still open.
- `spec-inbox/` (gitignored, see its README) — unsorted product specs; the data
  model and model spec still feed Phase 3.
- Design: the private claude.ai/design project "Draft board screen design",
  accessed via DesignSync.

## Queue

### Done

- **Tasks 1, 2, 3, 6, 8, 9** — bun supply-chain hardening, Dependabot + CI
  audit, Biome + tsc + YAML check + actionlint, git hooks, the `CLAUDE.md`
  split, and the `bun:test` setup.
- **Phase 1 — model module** — PR #8, `archive/2026-07-23-model-module`.
- **Phase 2 — draft board UI**, three sequenced proposals: `ui-foundation`
  (PR #10, `archive/2026-07-24-ui-foundation`), `draft-board` (PR #13,
  `archive/2026-07-24-draft-board`), `hero-picker` (PRs #15 and #16,
  `archive/2026-07-24-hero-picker`).
- **Task 4 — Playwright smoke** — PR #19,
  `archive/2026-07-25-playwright-smoke`.
- **`coderabbit-config`** — PR #24, `archive/2026-07-25-coderabbit-config`.
- **`vendored-skill-permissions`** — PR #26,
  `archive/2026-07-26-vendored-skill-permissions`.
- **`coderabbit-local-gate`** — PR #28,
  `archive/2026-07-26-coderabbit-local-gate`.
- **`agent-permissions-gaps`** — PR #30,
  `archive/2026-07-27-agent-permissions-gaps`. Its outstanding verification is
  closed: a session started after the merge was prompted on `bun update --help`,
  so the 14 `ask` entries are live rather than decorative.
- **`readme-drift`** — PR #33, `archive/2026-07-27-readme-drift`.
- **`reviewable-diff-gates`** — PRs #44, #45, #46 and the arrow step,
  `archive/2026-07-30-reviewable-diff-gates`. Every change after it is measured
  by `bun run diff-budget`. The living spec corrects one boundary the archived
  delta stated wrongly, at a count of exactly 800.
- **`mechanised-prohibitions`** — four PRs ending #50,
  `archive/2026-08-01-mechanised-prohibitions`.
- **`review-approval-direction`** — PR #57,
  `archive/2026-08-01-review-approval-direction`.
- **`always-on-context-budget`** — two PRs,
  `archive/2026-08-01-always-on-context-budget`; capability spec at
  `openspec/specs/context-budget/`. The always-on set went 1301 lines to 417
  against its new ~500 budget.
- **`push-destination-guard`** — `archive/2026-08-01-push-destination-guard`.
  The guard reads every operand as a refspec; a destination that comes from git
  configuration is what it cannot see, and that residue is the `CLAUDE.md` rule.
- **`skill-provenance`** — PR #63, `archive/2026-08-01-skill-provenance`;
  capability spec at `openspec/specs/skill-provenance/`. The
  `skills-lock.json` patch it drafted is the user's to apply in the skills
  repo, and its `ref` needs the upstream commit in `microsoft/playwright-cli`.
- **`review-bot-instructions`** — PR #65,
  `archive/2026-08-02-review-bot-instructions`. The proposal comparison ended
  up on `**` rather than `src/**`: of the five most recent changes at the time,
  three touched no file under `src/`, this one among them.
- **`tracked-permission-policy`** — PRs #68 and #69, corrected by #70,
  `archive/2026-08-09-tracked-permission-policy`; both requirements are in
  `openspec/specs/agent-permissions/`. The untracked `settings.local.json`
  keeps refilling by design, so the tracked file is the only one a count of
  its entries means anything about.

### Open
- [ ] **`spec-test-traceability`** — step 1, identifiers and citations, is
      PR #78; step 2, the count and its floor, is not started. Extends
      `openspec/config.yaml`'s "every criterion is cited by a task" one step:
      cited by a **test**. The identifier is derived from the scenario heading
      rather than written into the spec, and it lives in a `// spec:` comment
      above the test rather than in the test name — a single act may close
      several criteria, and three identifiers do not fit in a name. The
      existing ~380 uncited criteria stay uncited behind a floor that may not
      rise without a reason on its line. Nine of the change's fifteen criteria
      are cited by step 1; the six the floor describes are step 2's, which is
      why its citations stop at nine.
- [ ] **`mutation-floor`** — proposed, two steps, not yet applied. Mutation
      testing over `src/model.ts` alone, its own CI job, floor set from the
      first measurement as an absolute survivor count and failing in both
      directions. `src/types.ts` left out: it holds no branch and no
      arithmetic, so its only mutants edit constants. The hand-rolled AST
      mutator is no longer the fallback — TypeScript 7's native port exposes a
      scanner and no parser, and the scanner mis-reads the template literals
      `model.ts` is full of, so Stryker's command runner is the tool. `/warm`
      on it is the change's first task and can still end it.
- [ ] **`file-size-cap`** — proposed, eight steps, not yet applied. The
      file-size cap half of "reverse two non-goals": 300 lines for `.ts`/`.tsx`,
      200 for `.css`, adopted with no exemption list because the same change
      decomposes all nine files currently over the line. `app.css` (943 lines)
      becomes co-located CSS Modules, which moves style delivery into the
      JavaScript bundle. Not an `/opsx:update` on `reviewable-diff-gates` as
      this entry used to ask: that change is archived, and the growth protocol
      above forbids editing an archive to receive a fact discovered later, so
      the cap lands in the living `change-slicing` spec.
- [ ] **The rule of two** — the other half, still outstanding and **not yet
      written anywhere**. Lift a helper on the second consumer, never the
      first. `reviewable-diff-gates` prescribed its vehicle when it deferred it
      — "its own one-line rule, separately" — so it belongs in `CLAUDE.md`'s
      Code list rather than in a proposal. The nearest rule there today covers
      only the opposite direction, checking for duplication before inlining a
      single-caller helper.
- [ ] **Task 7** — Docker + VPS deploy (open decisions: registry GHCR or Docker
      Hub, same VPS or a new one). Carries `ui-foundation` **(e2e)** 1.5, which
      Task 4 deferred here: serving `dist/` under a plain static server is
      nearly free once the container exists.
- [ ] **Phase 3** — OpenSpec: STRATZ → Postgres → snapshot bundle pipeline.
      Blockers: the user provides the API key, and pick-phase granularity in
      STRATZ is unresolved — extract via GraphQL or defer to v2.
- [ ] **Task 5** — error tracking (precondition: the product is deployed).
- [ ] **The design project's guideline pages show superseded inks.**
      `guidelines/colors-hero-palette.html` (52 swatches) and
      `guidelines/component-hero-tile.html` (5) hardcode `#1b1d12`/`#f4f3fb`
      inline rather than referencing `--tile-ink-*`. Eight also show the wrong
      ink, having been authored at threshold 0.22: batrider, clockwerk, magnus,
      mars, slark, spectre, storm-spirit, treant-protector all move light →
      dark. The fix is to reference the tokens; the shortened swatch labels are
      hand-authored, so the pages cannot simply be regenerated.
- [ ] **The e2e backlog** — the ~25 **(e2e)** bullets in `draft-board`'s and
      `hero-picker`'s archived task lists.
- [ ] **Decide whether MCP earns its place in the review.** After four pull
      requests under `knowledge_base.mcp.usage: "enabled"`, ask whether any
      finding of the API-existence class actually appeared. Silence answers
      that question only if the source was working *and* the defect class was
      possible, and both halves are checkable:
      - **The source retrieved.** Context7's dashboard shows requests per day;
        compare them with the dates CodeRabbit submitted reviews.
      - **The class was possible.** The pull request touched `src/**` or
        `e2e/**` — the code that calls Preact, Bun and Playwright for real. A
        run over configuration, docs and root-level tests cannot produce the
        finding, so it does not count towards the four however cleanly it
        retrieved. #66 to #69 were four such runs and are why this half is
        written down: they touched no file under either path.

      Without both, the result is unverified and the setting stays — flipping
      it on silence would make an unretrieved source and an absent defect class
      the same evidence, which is the confusion `.coderabbit.yaml` tells the
      bot not to make. With both, set `usage` back to `"disabled"`: a knowledge
      source that finds nothing is a widened trust boundary bought for nothing.

## Standing constraints

Kept because no single file in the tree is where a reader would look for them.

- **Preact** — the UI runtime, and the first runtime dependency.
- **camelCase in every JSON payload** — `types.ts`, the fixture, the generator
  and the bundle contract all take renamed keys on import.
- **Bun's native bundler, no Vite** — `bun run build` is `bun build
  ./index.html --outdir=dist` plus the copy steps; `bun run dev` is `server.ts`
  under `--hot`.
- **Dependabot, not Renovate** — first-party, so no third-party GitHub App
  gets write access to a hardening-focused repository. The trade is no
  dependency dashboard and no lockfile maintenance; the nightly `bun audit`
  covers the latter.
- **Docker on a VPS** — the deployment target.
- **Context7 is documentation, not a source of truth.** Its library pages are
  community-contributed and its authors warrant neither accuracy nor safety,
  so the review instruction treats retrieved text as evidence about whether an
  API exists and never as instructions. `.coderabbit.yaml` can only deny an
  MCP server (`knowledge_base.mcp.disabled_servers`), never allow one: which
  servers are connected is CodeRabbit dashboard state, outside this
  repository. Release age, downloads and install scripts stay with `/warm` and
  `bun info` — Context7 says nothing about any of them.
