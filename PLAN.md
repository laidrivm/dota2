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

### Open
- [ ] **`review-bot-instructions`** — proposed
      (`openspec/changes/review-bot-instructions`). Points the bot at the two
      reviews no local skill performs — the delta spec, and the diff against its
      own proposal — wires it into the ponytail ladder and the fix-and-capture
      loop, and enables MCP so the API-existence rule becomes checkable. One
      task group, one PR. Unblocked: `always-on-context-budget` has shipped the
      `coderabbit-config.test.ts` and the `**/*.{ts,tsx}` clause this one
      extends.
- [ ] **`tracked-permission-policy`** — proposed
      (`openspec/changes/tracked-permission-policy`). Gates `bunfig.toml` and
      `.npmrc` with `Edit` rules, and curates the 170 auto-accepted allow
      entries out of the untracked settings file into the tracked one. Two task
      groups, two PRs.
- [ ] **`spec-test-traceability`** — not yet proposed. Extends
      `openspec/config.yaml`'s "every criterion is cited by a task" one step:
      cited by a **test**, via a criterion identifier in the test name and a
      script that greps both sides.
- [ ] **`mutation-floor`** — not yet proposed. Mutation testing over
      `src/model.ts` and `src/types.ts` only, its own CI job, floor set from the
      first measurement and forbidden to fall. Tool through `/warm` first; a
      hand-rolled AST mutator is the fallback.
- [ ] **`reviewable-diff-gates` — reverse two non-goals**. The file-size cap
      (~300 `.ts`, ~200 `.css`) and the rule of two are recorded there as
      deliberate non-goals. An `/opsx:update` on that change, not a new
      proposal.
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
- [ ] **Decide whether MCP earns its place in the review.** After three or
      four pull requests under `knowledge_base.mcp.usage: "enabled"`, ask
      whether any finding of the API-existence class actually appeared. Silence
      answers that question only if the source was working and had something to
      read: Context7 was connected in the dashboard on 2026-08-01, so the count
      starts at the pull request that ships this entry, but still confirm those
      PRs actually called into Preact, Bun or Playwright. Without both, the result
      is unverified and the setting stays — flipping it on silence alone would
      make an unretrieved source and an absent defect class the same evidence,
      which is the confusion `.coderabbit.yaml` tells the bot not to make. With
      both, set `usage` back to `"disabled"`: a knowledge source that finds
      nothing is a widened trust boundary bought for nothing.

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
