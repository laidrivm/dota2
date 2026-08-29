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
  §*Maintenance & growth*.

## Requirement sources

- `tasks/task-5.md` — the infrastructure task still open.
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
- **`rulebook-doc-reach`** — PR #134,
  `archive/2026-08-19-rulebook-doc-reach`; the widened reach is in
  `openspec/specs/agent-rulebook/`.
- **`repo-layout`** — PRs #171, #172, #173 and #174,
  `archive/2026-08-25-repo-layout`; spec at `openspec/specs/repo-layout/`.
- **Phase 3a — `snapshot-build`** — sixteen PRs, #177 to #195,
  `archive/2026-08-26-snapshot-build`; specs at
  `openspec/specs/snapshot-build/` and `openspec/specs/snapshot-export/`.
- **Phase 3b — `snapshot-ingest`** — twenty-one PRs, #141 to #202,
  `archive/2026-08-27-snapshot-ingest`; specs at
  `openspec/specs/snapshot-ingest/` and `openspec/specs/hero-reference/`.
- **`deploy-pipeline`** (Task 7) — seven PRs, #208 to #218,
  `archive/2026-08-27-deploy-pipeline`; specs at
  `openspec/specs/container-image/`, `openspec/specs/deploy-workflow/`,
  `openspec/specs/deployment-topology/` and
  `openspec/specs/snapshot-schedule/`.
- **`proposal-slicing`** — PR #223,
  `archive/2026-08-28-proposal-slicing`; both requirements are in
  `openspec/specs/change-slicing/`.
- **`hero-tile-icon`** — PRs #227 and #228,
  `archive/2026-08-29-hero-tile-icon`; the requirement is `draft-board`
  §*Hero tile* in `openspec/specs/draft-board/`.

### Open

- [ ] **Whose spelling of a hero's `short` is canonical.** The client's kebab
      (`anti-mage`, the fixture and all 51 palette tokens) or Valve's internal
      name as STRATZ republishes it (`antimage`, every row the ingest writes).
      Left open by `hero-tile-icon`, which covers the square with an image
      wherever one loads and so narrows the cost of deciding wrongly rather
      than removing it — the square is still what a failed image load shows,
      and what the mismatch costs there is counted in that change's proposal.
      Settling it reaches the fixture, `colors.css` and the design project's
      swatch pages at once, which is why it is not that change's to take.
      `hero-slug-canon` takes it; this entry closes with that change's step 4.
      Its step 2 has since moved the fixture and all 51 tokens onto the ingest
      slug, so the tree now answers the question and only the design pages
      still spell it the other way.
- [ ] **`hero-slug-canon`** — proposed, `openspec/changes/hero-slug-canon/`.
      The slug the ingest writes becomes canonical and the palette moves to it,
      regenerated from the mirrored portraits for every hero the mirror holds
      rather than 51 by hand. Ships on `feat/hero-slug-canon-1` … `-4`, in
      order: the generator, then the rename of tokens and fixture, then the
      computed palette, then the design project's swatch pages — the last gated
      on DesignSync authenticating, which it does not today.
- [ ] **Task 5** — error tracking (precondition: the product is deployed).
      Carries the snapshot job's failure alert, which `deploy-pipeline` moved
      here on finding it in no step and no acceptance criterion of
      `tasks/task-7.md`: the schedule writes each run's start instant, report
      and exit status to a log on the host, and nothing reads it. Until then a
      failed run degrades quietly — the export runs last, so the previously
      published bundle keeps serving while the data ages.
- [ ] **Workflow hygiene is practised everywhere and stated nowhere.**
      Measured over the six workflows: every one pins its actions by SHA with
      a version comment and declares `permissions:`, five of six declare a
      concurrency group — `audit.yml` does not — and the one reading
      `github.event.*` passes it through `env:`. No rule in `CLAUDE.md` and no
      criterion in any capability says any of it, so `tasks/task-7.md`'s
      "all workflow hygiene rules apply" points at nothing.
      `deploy-pipeline` writes the criteria for its own workflow alone;
      generalising them needs a check over all of them and a home that is not
      a capability about deploying.
- [ ] **The design project's guideline pages show superseded inks.**
      `guidelines/colors-hero-palette.html` (52 swatches) and
      `guidelines/component-hero-tile.html` (5) hardcode `#1b1d12`/`#f4f3fb`
      inline rather than referencing `--tile-ink-*`. Eight also show the wrong
      ink, having been authored at threshold 0.22: batrider, clockwerk, magnus,
      mars, slark, spectre, storm-spirit, treant-protector all move light →
      dark. The fix is to reference the tokens; the shortened swatch labels are
      hand-authored, so the pages cannot simply be regenerated. Since
      `hero-tile-icon` both pages are out of date a second way: the ink rule
      now reaches only the square a tile falls back to, and they describe it
      as reaching every tile. And since `hero-slug-canon`'s third step a third:
      the palette page's 52 swatches are keyed on the client's kebab and hold
      colours nothing generates any more, so every swatch on it is superseded
      rather than the eight inks named above. `hero-slug-canon`'s step 4
      settles this entry or leaves it standing with what it could not reach.
- [ ] **Mutation testing's scope predates the job tree.**
      `openspec/specs/mutation-floor/` scopes Stryker to `src/model.ts` alone
      and rules that a second file means a second configuration and a second
      floor rather than a widened glob — written when the model was the only
      module here where a wrong sign or boundary yields a plausible number
      instead of a crash. `src/job/` now holds eleven more of exactly that
      kind, none of them mutated; `blend.ts`'s decay and smoothing tables were
      checked by breaking them by hand instead, which no gate repeats. What
      this asks is whether one configuration and one floor per file still
      scales at eleven, and what replaces it if not — a floor per directory, a
      floor per file generated from one list, or the rule kept and paid. Either
      answer is a delta spec, not an edit to the spec.
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
- [ ] **`merged-branch-guard`** — proposed,
      `openspec/changes/merged-branch-guard/`. The command guard gains a
      second commit refusal: a branch whose work is already upstream, which is
      what a merged pull request leaves behind. Two task groups, so
      `feat/merged-branch-guard-1` and `-2`, in order — the first ships a
      module nothing calls, so the two run in one session. Proposed ahead of
      Phase 3a, which has since archived at the size the Done entry records,
      because a phase that long is where this failure costs most — it is what
      stranded four commits on 2026-08-19; the proposal records what was
      measured.
- [ ] **`pre-pr-sequence-gate`** — proposed,
      `openspec/changes/pre-pr-sequence-gate/`. A `Stop` hook refuses to end a
      turn that committed while a task group stands complete and the message
      carries neither a gate line nor `BLOCKED` with what only the user can
      settle; a `UserPromptSubmit` hook records `HEAD` so that "this turn
      committed" is answerable. Three task groups, so
      `feat/pre-pr-sequence-gate-1` … `-3`, in order. Group 1 is a measurement
      that can cancel the other two: if a project-level `UserPromptSubmit`
      entry replaces the ponytail plugin's rather than composing with it, the
      design has no mark to read. Pairs with `merged-branch-guard` — both
      mechanise a rule this session read and walked past.
- [ ] **The diff budget cannot say what it measured against.**
      `scripts/diff-budget.sh` falls back to the literal `main` when
      `refs/remotes/origin/HEAD` is unset, and its gate line names the total
      and the split but never the base — so a count taken against a stale
      local ref reads exactly like a correct one. Measured: a branch cut from
      `origin/main` printed 511 where the true count was 455, the difference
      being a merge the local `main` had not seen. The fix is the base in the
      gate line, which is a criterion in `change-slicing`.
- [ ] **`isTimestamp` accepts a timestamp with no offset.**
      `src/app/snapshot.ts`'s `ISO_DATE` anchors only the leading
      `YYYY-MM-DD`, so `isTimestamp("2026-07-19T00:00:00")` and even
      `isTimestamp("2026-07-19")` are true — measured. `docs/api-design.md`
      now says a timestamp carries an offset, so the validator is looser than
      the contract it guards. Tightening it changes what the client accepts,
      which `snapshot-delivery` §*Malformed payload* pins, so it needs a delta
      spec rather than an edit.
- [ ] **Two behaviours the build has and no criterion states.** Both are in
      `openspec/specs/snapshot-build/`, found on PR #196 in text the sync
      copied rather than authored, so both want a delta spec rather than an
      edit. *Patch blending with a decaying prior* has no scenario for a
      previous patch that exists and holds no row for the statistic while
      `n_new > 0` — `wrBlend` answers `wr_blend = wr_new` and `n_eff = n_new`,
      and `blend.test.ts` [14] asserts it, so the behaviour is settled and
      only unwritten. *Snapshot retention* keeps the 30 most recent **and**
      its two exemptions, so the retained set can exceed 30, while its
      *The thirty-first snapshot* scenario says 30 remain and the oldest by
      `snapshot_id` goes — true only while the oldest is not exempt, which is
      what `retention.ts` does by deleting rows outside both sets.
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
      tree through — `git ls-files` over the whole tree, not a pathspec query —
      stood in seven copies when this was proposed, two of them already
      drifted. Eleven now, re-counted at the archive of `repo-layout`, which
      repaired `readme-map.test.ts`'s copy and added four sites in three files:
      `scripts/repo-layout.ts`, `checks/readme-layout.test.ts`, and both halves
      of `checks/tracked-tree.test.ts`, whose second half is the unanchored
      counter-example and is the one copy the lift must leave alone. Two task
      groups, so `feat/tracked-file-sweep-1` then `-2`.
- [ ] **`focus-restore-idiom`** — proposed,
      `openspec/changes/focus-restore-idiom/`. Two controls restore focus after
      an unmount and the reason the wait cannot be an animation frame is
      written three times and executed nowhere. Ships on
      `feat/focus-restore-idiom`; its `design.md` admits abandoning the lift if
      the helper turns out to be a bare `setTimeout` wrapper.
- [ ] **Ten workflow pins nothing updates.** `bun-version: 1.3.14` stands in
      ten jobs across five workflows, and Dependabot raises none of them: its
      `github-actions` ecosystem updates `uses:` refs only, and its `bun`
      ecosystem updates `@types/bun` in `package.json` — which carries that
      same version, so a bump there leaves all ten behind with nothing
      saying so. `CLAUDE.md`'s Safety rule about naming what updates a pin
      applies to every one of them; the branch that added the rule commented
      only the service image it was found on, because one comment among ten
      tells a reader nothing. Closing it is either a comment per site or a
      check that reconciles the workflows against the manifest.

      Ten is the count of workflow jobs, and it is the whole of what this entry
      is about. It said eight when it was written and the tree already carried
      nine before `feat/deploy-pipeline-1` added its Docker job — which is the
      argument for the reconciling check rather than for a comment per site: a
      count nothing measures drifts every time a job is added.

      That branch also puts `1.3.14` in a place this entry does not reach, and
      the distinction is the point rather than a footnote: the `Dockerfile`'s
      `oven/bun:1.3.14-alpine` is not a workflow job, it is pinned by digest
      rather than by version string, and the `docker` ecosystem entry beside it
      is what raises it. It is the one site of the version that something
      updates, so a check written for this entry has to tell the two kinds
      apart rather than count them together.
- [ ] **A captured rule is sent to the costliest of its two homes.**
      `openspec/specs/local-review-loop/spec.md` §*A justification survives
      only when it is a convention* says a skipped Minor becomes a rule in
      `CLAUDE.md`'s "Rules" list, *because* `.coderabbit.yaml` names that file
      so the next review reads it. The reason does not separate the two homes:
      `code_guidelines.filePatterns` names `docs/*.md` as well, which
      `review-bot-config` states correctly. So being read back is true of the
      indexed docs too, and the criterion routes every captured rule into the
      one file that costs always-on budget. `CLAUDE.md` §*Lessons learned* is
      corrected on this branch; the criterion needs a delta spec.
- [ ] **A live spec's reason names a step that no longer runs on every diff.**
      `openspec/specs/context-budget/spec.md` §*A fence stands where it is
      stepped on* justifies the comment rule with "`/ponytail-review` runs over
      every diff looking for what to cut". It no longer does — it left the
      pre-PR sequence on 2026-08-26, having returned eight findings across
      eight branches with no defect among them. The
      requirement stands on its own second reason, that no reader runs `git log
      -S` before editing, so this is an overstated clause rather than a broken
      criterion; correcting it is a delta spec, not an edit here.
- [ ] **The always-on trigger has fired, and by more than it last recorded.**
      Re-measured 2026-08-29: the set is 613 lines against the ~500
      `CLAUDE.md` states, where the entry previously read 555. Both sublist
      figures moved with it — Process sits at 24 and Code at 20, so two of the
      three are now at or past the ~20 threshold rather than one.
      `docs/rulebook-growth.md` asks for a promotion rather than a prune, and
      the cluster it named still holds: five Process rules are about what
      counts as evidence — how a gate is probed, when an empty result is an
      absence, where a count comes from, which measurement may be overwritten
      — and `docs/verification.md` already owns exactly that. What no longer
      holds is the conclusion drawn from it: moving those five takes Process
      to 19 and the set to about 603, so it clears one sublist and leaves the
      set a hundred lines over. Closing this now needs a decision about where
      the bulk goes, `PLAN.md` being the larger half at 386 lines, and that is
      a change rather than an edit here.
- [ ] **Nothing checks that `snapshot.json` is what its generator produces.**
      `src/fixtures/generate_fixture.py` writes the committed fixture and no
      test runs it, so an edit to the generator that nobody regenerates is
      invisible — the two simply disagree. Raised by `/zombies` on
      `hero-slug-canon`'s second step, which made a hero's `short` a
      hand-written column where it had been derived from the display name, so
      a wrong slug now survives in the generator alone. Not closed there: the
      check has to run `python3`, which no workflow installs and no test
      spawns today, and adding an interpreter to CI is an infrastructure
      change that enters the OpenSpec cycle. Reading the `HEROES` table out of
      the Python source with a regex instead is the thing `CLAUDE.md` forbids
      — a value read from a line that resembles the structure rather than from
      the structure its tool parses.

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
