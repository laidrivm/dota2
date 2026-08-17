# Implementation plan — agent working file

Read at session start; updated in the same turn a task or stage completes or a
decision is made (rule in CLAUDE.md). This file holds the open queue, the
sources still feeding it, and the constraints still in force. What a completed
change decided lives in its archived proposal under `openspec/changes/archive/`.

## Growth protocol

- **What lives here**: work not yet done, the requirement sources still feeding
  it, and the standing constraints no single file owns.
- **What evicts an entry**: its change reaching the archive. A completed queue
  entry collapses to its name, its pull requests, its archive path and where
  its spec landed — nothing else, and no longer than the entries beside it.
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
- **Phase 2 — draft board UI** — `ui-foundation` (PR #10), `draft-board`
  (PR #13), `hero-picker` (PRs #15, #16); archives under `archive/2026-07-24-`.
- **Task 4 — Playwright smoke** — PR #19, `archive/2026-07-25-playwright-smoke`.
- **`coderabbit-config`** — PR #24, `archive/2026-07-25-coderabbit-config`.
- **`vendored-skill-permissions`** — PR #26,
  `archive/2026-07-26-vendored-skill-permissions`.
- **`coderabbit-local-gate`** — PR #28,
  `archive/2026-07-26-coderabbit-local-gate`.
- **`agent-permissions-gaps`** — PR #30,
  `archive/2026-07-27-agent-permissions-gaps`; spec at
  `openspec/specs/agent-permissions/`.
- **`readme-drift`** — PR #33, `archive/2026-07-27-readme-drift`.
- **`reviewable-diff-gates`** — PRs #44, #45, #46 and the arrow step,
  `archive/2026-07-30-reviewable-diff-gates`.
- **`mechanised-prohibitions`** — four PRs ending #50,
  `archive/2026-08-01-mechanised-prohibitions`.
- **`review-approval-direction`** — PR #57,
  `archive/2026-08-01-review-approval-direction`.
- **`always-on-context-budget`** — two PRs,
  `archive/2026-08-01-always-on-context-budget`; spec at
  `openspec/specs/context-budget/`.
- **`push-destination-guard`** — `archive/2026-08-01-push-destination-guard`.
- **`skill-provenance`** — PR #63, `archive/2026-08-01-skill-provenance`; spec
  at `openspec/specs/skill-provenance/`.
- **`review-bot-instructions`** — PR #65,
  `archive/2026-08-02-review-bot-instructions`.
- **`tracked-permission-policy`** — PRs #68 and #69, corrected by #70,
  `archive/2026-08-09-tracked-permission-policy`; both requirements are in
  `openspec/specs/agent-permissions/`.
- **`spec-test-traceability`** — PRs #78 and #79,
  `archive/2026-08-13-spec-test-traceability`; spec at
  `openspec/specs/spec-test-traceability/`.
- **`mutation-floor`** — PRs #81 and #82, `archive/2026-08-13-mutation-floor`;
  spec at `openspec/specs/mutation-floor/`.
- **`file-size-cap`** — twenty-two PRs, `archive/2026-08-16-file-size-cap`; the
  cap is in `openspec/specs/change-slicing/`.
- **`pre-push-parity`** — PRs #111 and #112,
  `archive/2026-08-16-pre-push-parity`; the hook's gate list is in
  `openspec/specs/commit-gates/`.

### Open

Product work first, then the improvements to the system that builds it, then
the changes already proposed and waiting for a `feat/` branch.

- [ ] **Phase 3a — snapshot build and export** — the schema, the blending,
      smoothing and sufficiency maths, and the export: a bundle written beside
      the served one and renamed over it, carrying an ETag the client can
      revalidate. It takes staging as given, so it needs no API key and can
      start now, and the staging shape it settles is the contract 3b fills.
      Reads and writes through `Bun.SQL`, so it adds no dependency, and
      brings the database it is developed and tested against. Owns no
      *deployed* infrastructure — the production Postgres service, the
      schedule and the failure alert are Task 7's, and none of them gates it.
      Three contract corrections it carries are in *Standing constraints*
      below.
- [ ] **Phase 3b — snapshot ingest** — the STRATZ client and its rate-limit
      budget, the upserts into the reference tables, the icon mirroring, and
      the nightly job that drives 3a to a published snapshot or a failed one.
      Blocked on the user's API key. Pick-phase granularity is unresolved —
      derive it, or zero `phase` for every hero and defer the component to
      v2. Zeroing only some is what must not ship: `src/model.ts` weighs the
      delta without asking whether it was measured, so a uniform zero moves
      no candidate's rank while a partial one ranks the measured above the
      missing.
- [ ] **Task 7** — the whole deployment: Docker image, compose (`app` +
      `postgres`, bundle on a volume both mount), the snapshot job's entry in
      the VPS's existing crontab, the failure alert, and the deploy workflow.
      Open decisions: registry GHCR or Docker Hub, same VPS or a new one, and
      who terminates TLS. Follows Phase 3, because a deploy sized to the static
      bundle alone is a container, a compose file and a workflow that the
      database and the job then reopen. Carries `ui-foundation` **(e2e)** 1.5,
      which Task 4 deferred here: serving `dist/` under a plain static server
      is nearly free once the container exists.
- [ ] **Task 5** — error tracking (precondition: the product is deployed).
- [ ] **The design project's guideline pages show superseded inks.**
      `guidelines/colors-hero-palette.html` (52 swatches) and
      `guidelines/component-hero-tile.html` (5) hardcode `#1b1d12`/`#f4f3fb`
      inline rather than referencing `--tile-ink-*`. Eight also show the wrong
      ink, having been authored at threshold 0.22: batrider, clockwerk, magnus,
      mars, slark, spectre, storm-spirit, treant-protector all move light →
      dark. The fix is to reference the tokens; the shortened swatch labels are
      hand-authored, so the pages cannot simply be regenerated.
- [ ] **A scroll-strip criterion the board does not meet as written.**
      `openspec/specs/draft-board/spec.md` §*Scroll strips are operable without
      a pointer* admits two means only, "through scroll buttons or by being
      focusable", and the bans and suggestion strips have neither: they are
      operable because every entry carries a focusable control the tab order
      scrolls into view. Measured on the bans strip at 400px with 12 bans —
      overflowing 717 against 372, axe's `scrollable-region-focusable` passing,
      `scrollLeft` 0 → 345 on focusing the last entry. `CLAUDE.md`'s
      accessibility rule now admits that third means; the criterion still does
      not, so one of the two has to move. Either the strips gain
      `::scroll-button`, or a change amends the criterion — which is a delta
      spec, not an edit here.
- [ ] **Three glyphs carry meaning nothing else states.** The `★` marking
      `session.myRole` in `src/app/board/panels.tsx` and again in
      `suggestions.tsx`, and the `→` in the result line there, are announced by
      their glyph names and by nothing better; the accent colour that carries
      the same meaning visually is not announced at all. Raised by CodeRabbit on
      the board split and left there on purpose, because the fix is not a move's
      to make: `draft-board`'s result criterion pins the block's text as `Draft
      advantage: +3.2 pp → ~58% win`, so hiding the arrow and adding words needs
      a delta spec, and the `visuallyHidden` class this wants lives in
      `src/app/picker/picker.module.css` — a second consumer, so a rule-of-two
      lift rather than a copy.
- [ ] **The e2e backlog** — the ~25 **(e2e)** bullets in `draft-board`'s and
      `hero-picker`'s archived task lists, plus one this file owns because no
      task list does: at 720px the board's one-column rules now live in three
      modules, and nothing checks that each landed in the module whose
      selectors it names. A rule in the wrong one matches nothing, silently.
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
- [ ] **The `skills-lock.json` patch `skill-provenance` drafted** is still the
      user's to apply, in the skills repository rather than here, and its `ref`
      needs the upstream commit in `microsoft/playwright-cli`. It is open
      rather than done: nobody has applied it.
- [ ] **`scan-lift`** — proposed, `openspec/changes/scan-lift/`. One
      left-to-right source scanner in three copies, two of them blind in ways
      their own specifications forbid. Ships on `feat/scan-lift`; it also
      writes the rule of two into `CLAUDE.md`'s Code list, which
      `reviewable-diff-gates` deferred and no artefact has carried since.
- [ ] **`tracked-file-sweep`** — proposed,
      `openspec/changes/tracked-file-sweep/`. The listing every check reads the
      tree through stands in seven copies, two of them already drifted. Two
      task groups, so `feat/tracked-file-sweep-1` then `-2`.
- [ ] **`focus-restore-idiom`** — proposed,
      `openspec/changes/focus-restore-idiom/`. Two controls restore focus after
      an unmount and the reason the wait cannot be an animation frame is
      written three times and executed nowhere. Ships on
      `feat/focus-restore-idiom`; its `design.md` admits abandoning the lift if
      the helper turns out to be a bare `setTimeout` wrapper.

## Standing constraints

Kept because no single file in the tree is where a reader would look for them.

- **Preact** — the UI runtime, and the first runtime dependency.
- **camelCase in every JSON payload and every identifier that can hold it** —
  `types.ts`, the fixture, the generator and the bundle contract all take
  renamed keys on import. Postgres is the exception `data-model.md` records
  and the one place it cannot hold: an unquoted identifier folds to lowercase,
  so columns stay `snake_case` and the exporter renames at that boundary.
- **The client fetches one snapshot URL** — `snapshot-delivery` allows exactly
  one request, so the version lives in the payload's `snapshotId` and in
  Postgres, never in the path. The URL is revalidated by ETag; the versioned
  file `data-model.md` §5 proposes, and its `latest` pointer, are not built.
- **STRATZ, not OpenDota** — OpenDota gives hero winrates by rank bracket and
  the hero reference with icons, but no lane position: `lane_role` exists only
  on its parsed-match sample. `hero_position_stats` is what enemy-role
  inference and the per-role suggestions both rest on, so a source without
  positions cannot feed this model. Dotabuff and dota2protracker publish no
  API; the latter's role here is the manual spot-check only.
- **Hero icons are served from this origin** — `app-shell` forbids a
  third-party runtime request, so the job mirrors each hero's icon when it
  first appears and the bundle's `icon` field names the local copy.
- **Bun's native bundler, no Vite** — `bun run build` is `bun build
  ./index.html --outdir=dist` plus the copy steps; `bun run dev` is
  `scripts/dev.ts`, which runs the same build unminified, watches it and
  serves it.
  Bun's HTML dev server is not used: it never defines a CSS module's
  class-name mapping (oven-sh/bun#18258).
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
