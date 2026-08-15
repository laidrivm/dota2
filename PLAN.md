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
- **Phase 2 — draft board UI** — `ui-foundation` (PR #10), `draft-board`
  (PR #13), `hero-picker` (PRs #15, #16); archives under `archive/2026-07-24-`.
- **Task 4 — Playwright smoke** — PR #19, `archive/2026-07-25-playwright-smoke`.
- **`coderabbit-config`** — PR #24, `archive/2026-07-25-coderabbit-config`.
- **`vendored-skill-permissions`** — PR #26,
  `archive/2026-07-26-vendored-skill-permissions`.
- **`coderabbit-local-gate`** — PR #28,
  `archive/2026-07-26-coderabbit-local-gate`.
- **`agent-permissions-gaps`** — PR #30,
  `archive/2026-07-27-agent-permissions-gaps`; its `ask` entries were later
  confirmed live, which the archive does not record.
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

### Open
- [ ] **`file-size-cap`** — proposed, eight steps, the first three applied, the
      second across three pull requests, one stylesheet each. The
      file-size cap half of "reverse two non-goals": 300 lines for `.ts`/`.tsx`,
      200 for `.css`, adopted with no exemption list because the same change
      decomposes all eleven files over the line — nine measured when it was
      proposed, plus `scripts/spec-coverage.test.ts` and
      `scripts/mutation-floor.test.ts`, which changes merged after it wrote
      the list. `app.css` (943 lines)
      becomes co-located CSS Modules, which moves style delivery into the
      JavaScript bundle. Not an `/opsx:update` on `reviewable-diff-gates` as
      this entry used to ask: that change is archived, and the growth protocol
      above forbids editing an archive to receive a fact discovered later, so
      the cap lands in the living `change-slicing` spec. Step 1 cost a change
      to how the application is served, which shipped beside it: Bun's HTML dev
      server cannot emit a CSS module's class-name mapping, so development
      builds and serves `dist/` — the constraint below carries it. Step 3 left
      no global class layer: `styles.css` is tokens and `base.css`, and the
      no-colour-literal sweep now reads every tracked `*.css` rather than one
      directory, so `app-shell`'s *No third-party runtime requests* is checked
      over component stylesheets it previously never saw.
- [ ] **The comment scan goes quiet on a regex literal.** A backtick inside one
      — `` /[`]/ `` — opens what `scripts/mutation-floor.ts:183-199` takes for a
      template literal and runs to end of input, so every comment below it is
      dropped and the check reports nothing. Silent success is the one failure
      that check must not have. `src/model.ts` holds no regex literal today, so
      nothing is passing wrongly yet. Either teach the scanner that `/` in
      expression position starts one, or assert that the file contains none —
      the second is a line and fails loudly, the first ends the family of bugs
      that produced five holes in one session. The first is now done and lives
      in `scripts/scan.ts`: it treats a `/` whose last token opens a value as a
      regex literal and stops it at a newline rather than at end of input, and
      it tells the two languages apart, CSS having neither `//` nor a regex
      literal. What is left here is switching `mutation-floor.ts` to it.
- [ ] **The rule of two** — the other half, still outstanding and **not yet
      written anywhere**. Lift a helper on the second consumer, never the
      first. `reviewable-diff-gates` prescribed its vehicle when it deferred it
      — "its own one-line rule, separately" — so it belongs in `CLAUDE.md`'s
      Code list rather than in a proposal. The nearest rule there today covers
      only the opposite direction, checking for duplication before inlining a
      single-caller helper. It has a dated candidate now: comment scanning lives
      in both `scripts/spec-coverage.test.ts` and `scripts/mutation-floor.ts`,
      the second is strictly better, and the Code rule the first implements was
      replaced on 2026-08-13. What that costs the older copy is commented at the
      line it costs it. `scripts/scan.ts` is where that lift lands: extracted
      to bring its file under the cap, and already the module the older copy
      should switch to — which is what makes it a lift and not speculation.
      A second candidate arrived with `file-size-cap` step 3: the tracked-file
      sweep — `git rev-parse --show-toplevel`, then `git ls-files -z` at that
      root, then an `lstatSync` filter — now stands in three copies,
      `scripts/no-suppressions.ts`, `src/app/module-classes.test.ts` and
      `src/app/styles/styles.test.ts`, and only the first has tests for the
      subdirectory run and the tracked-but-absent file. Those two tests are
      worth writing against one lifted sweep and not against a third copy,
      which is why they are here rather than in that step.
- [ ] **The `skills-lock.json` patch `skill-provenance` drafted** is still the
      user's to apply, in the skills repository rather than here, and its `ref`
      needs the upstream commit in `microsoft/playwright-cli`. It sat under
      Done, where a thing nobody has done does not belong.
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

## Standing constraints

Kept because no single file in the tree is where a reader would look for them.

- **Preact** — the UI runtime, and the first runtime dependency.
- **camelCase in every JSON payload** — `types.ts`, the fixture, the generator
  and the bundle contract all take renamed keys on import.
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
