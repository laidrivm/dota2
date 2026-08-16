# Pipeline yield

## 2026-08-01 — feat/mechanised-prohibitions-suppressions (PR #52)

- zombies: PASS — 6 gaps, 5 acted on (1 dropped: over-approval case already
  pinned by the two comparison tests)
- warm: not run — no manifest changed
- ponytail-review: 1 finding, 1 acted on (net -6 lines)
- triage: PASS — 3 groups, 1 medium-risk reviewed
- coderabbit-local: PASS — 3 findings, 3 dispositioned (1 applied, 1 skipped,
  1 Major dismissed with user approval)
- coderabbit: PASS — 4 findings, 4 acted on (2 Major were live defects: the
  listing taken at cwd, and existsSync following a symlink)
- Not run: preflight, security-review, code-review

## 2026-08-01 — feat/mechanised-prohibitions-rulebook (PR #53)

- zombies: PASS — 2 gaps, 2 acted on
- warm: not run — no manifest changed
- ponytail-review: 1 finding, 1 acted on (net -9 lines)
- triage: PASS — 4 groups, 1 medium-risk reviewed
- coderabbit-local: PASS — 3 findings, 2 acted on (1 skipped: factually wrong
  about which file owns the gh prohibition)
- coderabbit: PASS — 8 findings over two rounds, 7 acted on, 1 applied in part
  (rejected the demand for a separate OpenSpec change)
- Not run: preflight, security-review, code-review

## 2026-08-01 — feat/push-destination-guard (PR #54, open)

- zombies: PASS — 7 gaps, 7 acted on (3 became spec scenarios, not only tasks)
- warm: not run — no manifest changed
- ponytail-review: not run — no code in the diff
- triage: not run — no code in the diff
- coderabbit-local: OPEN — 12 findings, 9 acted on, 3 dismissed (2 of them the
  same position: the bot wanted the prose rule kept unconditional, against
  agent-rulebook's own requirement)
- coderabbit: OPEN — 6 findings over three rounds, 4 acted on, 1 skipped,
  1 Major dismissal pending. Every round found a push form the previous
  enumeration missed: `:` and wildcards, `-o` shifting the operand, `--prune`,
  then unambiguous abbreviations
- Not run: preflight, security-review, code-review

## 2026-08-07 — feat/tracked-permission-policy-gates (group 1)

- zombies: PASS — 4 gaps, 4 acted on. All four were one hole: the change
  pinned the permission rules and nothing pinned the values they stand in
  front of, which is the half a rule structurally cannot hold
- warm: not run — no manifest changed
- ponytail-review: PASS — 1 finding, 1 applied, net 0 lines. Nothing to cut;
  the finding was a comment restating a claim the session had just falsified
- triage: PASS — 2 groups, 1 high-risk group read, 3 findings, 3 applied. The
  best of them: `git ls-files` was checked by stdout and not `exitCode`, and
  outside a repository git exits 128 printing nothing — the test would have
  passed on no evidence, which is the same shape as the 2026-07-27 entry
- coderabbit-local: PASS — 12 findings over three passes, 7 applied,
  4 Major dismissed with the user's approval, 1 Minor skipped
- **The measurement was worth more than any finding.** The design asserted
  that a shell redirection passes both rules. It splits: on Claude Code
  2.1.221 `deny` refuses a redirection to the denied path, `ask` does not
  gate one. Seven sites restated the wrong version — four artefacts, the
  test's own comment, `PLAN.md`, and a scenario block. The grep rule found
  four of them and the ponytail pass found the fifth, which is an argument
  for running a pass whose axis is not correctness
- **Three of the four dismissals were one position**: the bot asserting Claude
  Code's permission semantics from priors against a measurement recorded in
  the diff with its method. The fourth named a test layer that does not exist
- Not run: preflight, security-review, code-review

## 2026-08-09 — feat/tracked-permission-policy-allowlist (group 2, PRs #69–#71)

- coderabbit: PASS — 5 findings, 5 dispositioned (3 applied, 1 rejected,
  1 Trivial skipped). The Major that mattered was mine: `Bash(bunx openspec *)`
  had been promoted into the tracked allow list, pre-approving a registry
  fetch that `CLAUDE.md` forbids
- Not run: triage, zombies, warm, ponytail-review, coderabbit-local, preflight,
  security-review, code-review
- **A rejected finding was a fabrication**: the bot asked to change `behavior`
  to `behaviour` at a line where the word does not appear, and `git log -S`
  finds it in no commit on the branch. Same class as the 2026-08-07 entry's
  dismissals — the bot asserting a fact about the diff rather than reading it
- **The session's real finding came from the user, not a skill.** Three of the
  four review skills did not run, and the one that did could not have caught
  it: the wrong claim was a measurement error, and the diff it produced was
  internally consistent. What caught it was the user saying "но я одобрял
  bun outdated в диалоге" — see docs/context/permission-tiers-2026-08.md
- **CodeRabbit re-reviewed after the fixes were pushed and raised 3 more**,
  which the disposition pass had already closed as PASS. A gate line is true
  of the run that produced it, not of the pull request afterwards

## 2026-08-10 — spec/mutation-floor (PR #75)

- zombies: OPEN — 31 gaps, 31 acted on (feature-description mode, at propose
  time; two became requirements the conversation had not reached — `NoCoverage`
  counts as a survivor, and a numeric `thresholds.break` must fail the check)
- warm: PASS — 1 dependency vetted, 0 blocking findings, 1 ⚠️ right-sizing
  (`stryker init`, the dashboard client and the IDE server ship inside
  `@stryker-mutator/core` and cannot be sliced off). CVE-2024-57085 does not
  reach 9.6.1
- triage: PASS — 3 groups, 0 findings of its own; reading the two Medium
  groups produced 3. **The pattern holds from 2026-08-07**: triage's value here
  was again the reading it forces, not the map
- ponytail-review: 5 findings, 5 acted on (−1 pull request, −1 requirement,
  −1 criterion)
- coderabbit-local: OPEN — 16 findings, 13 applied, 1 dismissed, 2 skipped
- coderabbit: PASS — 9 findings, 5 applied, 3 already fixed, 1 no-op
- Not run: preflight, security-review, code-review
- **The load-bearing finding was the bot's**: `jsonReporter.fileName` names a
  path without enabling the reporter that writes it — the default `reporters`
  is `clear-text`, `progress`, `html` — so the configuration as proposed would
  have produced no report and failed the gate on every run
- **The load-bearing correction was mine and came from triage**: three
  artefacts said no Stryker runner plugin for `bun:test` exists. Two do. The
  earlier check tried three guessed package names, all 404, and read an empty
  registry search as an absence when the emptiness was a parsing failure. That
  is the session's new `CLAUDE.md` Process rule

## 2026-08-10 — spec/file-size-cap (PR #77)

- zombies: OPEN — 7 gaps, 7 acted on (diff mode over a proposal, so the gaps
  were in the *planned* test list; two would have shipped a check that does not
  check — `.tsx` was never named though the requirement covers it, and `wc -l`
  counts newlines, so a 301-line file with an unterminated last line reads
  as 300)
- ponytail-review: 2 findings, 2 acted on (−1 pull request)
- triage: PASS — 3 groups, 0 findings. First triage this month to produce
  nothing on reading either
- coderabbit-local: OPEN — 7 findings, 5 applied, 2 dismissed
- coderabbit: OPEN — 7 findings, 4 applied, 3 dismissed
- Not run: warm (no manifest changed), preflight, security-review, code-review
- **The load-bearing finding was the bot's again**: the CSS Modules steps said
  to move rules into a `*.module.css` and import it, and never to rewrite the
  markup's class literals to read from the mapping. The bundler renames the
  classes, so a literal left behind matches nothing — every migrated component
  renders fine and unstyled
- **Five dismissals across the two branches are still open with the user.**
  Four of them are one shape: the bot applying a rule to the wrong artefact
  (criteria into `proposal.md`, a task contract into `PLAN.md`), where this
  repo's answer already lives in two merged changes

## 2026-08-13 — feat/mutation-floor-1, feat/mutation-floor-2, chore/archive-mutation-floor

Three branches, one change, run end to end in one session.

**feat/mutation-floor-1 (PR #81)**

- zombies: OPEN — 6 gaps, 6 acted on. The load-bearing one: the CLI entry
  point CI actually runs had no test at all, so deleting `process.exit(1)`
  would have broken the gate silently
- warm: BLOCKED then PASS — 1 dependency, 1 finding, 1 acted on.
  GHSA-q8mj-m7cp-5q26 in `qs`, reached through `typed-rest-client`'s exact
  pin; `bun audit` exits 1 and `audit.yml` triggers on any package.json
  change, so the branch would have failed CI. Held off by an `overrides` entry
- ponytail-review: 3 findings, 3 acted on (−6 lines, plus a dead import the
  cut exposed that biome caught and tsc did not)
- triage: PASS — 6 groups, 2 high-risk read, 0 defects
- coderabbit-local: PASS — 2 findings, 2 applied

**feat/mutation-floor-2 (PR #82)**

- zombies: OPEN — 4 gaps, 4 acted on. One of them found a real hole: Stryker
  honours a directive in a block comment, and the scan read only `//`
- warm: PASS — no manifest changed, 0 findings
- ponytail-review: 2 findings, 2 acted on, one of them a control character
  smuggled into a doc comment to avoid closing the block
- triage: PASS — 4 groups, 2 read, 0 defects. Its grep confirmed the floor
  value and report path agree across all three sites that state them
- coderabbit-local: PASS over 2 passes — 5 findings, 2 applied, 3 skipped or
  rejected. The Major was right: the line-based comment scan mishandled
  escaped quotes and multi-line blocks
- coderabbit (PR #82): PASS — 6 findings, 4 applied, 2 skipped. Its Major was
  right again — a quote that opened no string ran to end of input and took
  every comment below it, so the scan reported nothing and the gate passed

**chore/archive-mutation-floor**

- triage: PASS — 2 groups, 0 defects, but its mandatory grep found two stale
  numbers nothing else would have: `PLAN.md` said the coverage floor was
  380 of 395, and spec-test-traceability's own spec said 86 of the 380
- coderabbit-local: OPEN — 2 findings, 0 applied, 2 dismissals put to the
  user and merged before they were settled

- Not run: preflight, code-review, security-review, first-five, review-order

**What the pipeline caught that nothing else would have**

- Four separate holes in one comment scanner, found by four different steps:
  zombies (block comments), coderabbit-local (escaped quotes, multi-line
  blocks), coderabbit (unterminated quote). Each was verified by running
  Stryker or the scan, never by argument
- A fifth of the same family is still live in `main` and was found by this
  session's own wrap-up, not by any gate: a regex literal containing a
  backtick silences the scan for the rest of the file
- warm is the only step this month to have blocked a branch outright

## 2026-08-13 — file-size-cap step 1 (chore/dev-serves-the-bundle, feat/file-size-cap-1, chore/module-class-scan, chore/collapse-plan-done)

- zombies: PASS — 8 gaps, 6 acted on (2 skipped: dev-harness timing)
- ponytail-review: 6 findings, 4 acted on (2 skipped: a lift the diff budget
  and the task order both argued against, and a one-line duplicate)
- triage: PASS — 6 groups, 3 High/Medium read, 0 findings by design
- coderabbit-local: PASS — 4 findings, 3 acted on (1 dismissal, settled by the
  user: the picker grid is operable through its tiles' roving tabIndex)
- coderabbit #85: PASS — 10 findings over three rounds, 9 acted on (1 skipped:
  a single-caller helper whose name carries what the branch consumes)
- coderabbit #86: PASS — 3 findings, 3 acted on
- coderabbit #87: PASS — 9 findings, 6 acted on, 1 rejected, 2 skipped
- Not run: warm (no dependency manifest changed), preflight, code-review,
  security-review, first-five, review-order

**What the pipeline caught that nothing else would have**

- Nine findings across three coderabbit rounds on #85, every one of them in a
  single source scanner, and each in the direction that passes wrongly: a read
  inside `${…}`, a class named only inside a CSS string, an import spelled
  inside a string, a bracket read, `//` read as a comment in CSS, an optional
  read. The bot said three times that no rule covered the shape; it was right,
  and the `CLAUDE.md` scan rule was tightened and split in two because of it
- The JSX finding on #87 was the sharpest: `/>`, `</span>` and an apostrophe in
  element text each erased the rest of their line. Reproduced before fixing,
  and answered by putting Bun's transpiler in front of the scan rather than by
  adding heuristics — the family of bugs the rule already names
- coderabbit's one Major that did not survive verification claimed the dist
  listing could serve a symlink out of the tree. `scanSync` does not follow
  symlinks; the fix that finding prompted was dead code, deleted, and what
  stayed is a test pinning the default
- Two defects were found by neither a gate nor the bot: the dev server never
  emitting a CSS module's class-name mapping (found by running e2e, which the
  task list required), and `dist/` growing without bound across a dev session
  (found while reading the diff for the zombies pass)

## 2026-08-15 — feat/file-size-cap-2a, -2b, -2c

- zombies: OPEN — 7 gaps, 5 acted on (2 routed to the e2e backlog: the 720px
  split, and the a11y tree under `opacity: 0` whose risk the diff did not change)
- warm: SKIPPED — no dependency manifest changed
- ponytail-review: 1 finding, 1 acted on — `.remove:focus-visible` was dead once
  the row's `:focus-within` set the knob, probed with the rule removed
- triage: PASS — 5 groups, 0 high-risk, 2 medium read, 0 defects
- coderabbit-local: PASS — 1 finding, 1 dispositioned (0 fixed, 1 skipped)
- coderabbit (PR #92): OPEN — 3 findings, 1 fixed, 1 rejected, 1 dismissal with
  the user
- Not run: code-review, preflight, first-five, review-order

**What the pipeline caught that nothing else would have**

- zombies was the only gate that produced code. The three mechanics the CSS
  move invented — the `--remove-fade` knob, `.teamsMirrored > :first-child`,
  and the `data-` walk replacing `closest(".slot, .ban")` — each replaced a
  working rule and none had a test. `e2e/board.spec.ts` exists because of it
- Break-checking those five tests is what earned the session's sharpest
  finding, and it was against my own work: two of them passed with their
  mechanism broken. The focus test passed through `.remove:focus-visible`
  instead of the row's knob; the focus-walk test passed through the region
  fallback, because Carry's entry control is the panel's first either way and
  the walk never had to reach the row. Both were rewritten to Offlane and to a
  row hover, and both then failed on cue
- coderabbit's PR round found the one hole break-checking could not:
  `expect(mine > enemy).toBe(mirrored)` also accepts `mine === enemy`, so a
  collapsed grid read as a valid Radiant layout. Collapsing
  `grid-template-columns` now fails both sides; before, only Dire
- Its Major was about artefacts, not code, and it was right in substance: the
  prescribed grep found `openspec/specs/draft-board/spec.md` restating the
  accessibility rule that was widened, and the divergence was recorded in
  `PLAN.md` rather than closed. Recording is not reconciling
- Its third finding was the only rejection: it read the base's `tasks.md`, not
  the head's, where both step-2 boxes are ticked
- Two things were found by no gate at all. The diff budget — a measurement, not
  a review — refused step 2 at 1011 lines against 800 and is why the step
  became three pull requests. And the seam the task list prescribed would have
  produced a ~350-line `board.module.css` against the 200-line cap the same
  change introduces at step 8; that was caught by writing the file and counting
  it, and became a Process rule

## 2026-08-15 — file-size-cap steps 3 and 4 (feat/file-size-cap-3, spec/file-size-cap-late-arrivals, feat/file-size-cap-4a to -4d, fix/session-storage-max-import)

Seven branches, so the counts below are the session's totals with the branch
named where one gate carried the whole result.

- zombies: PASS — 3 gaps on step 3, 1 acted on (the reverse module-class check:
  a class a module defines that nothing reads); 2 routed to `PLAN.md`'s rule of
  two. 0 gaps on every branch after, all of them pure moves
- warm: SKIPPED on all seven — no dependency manifest changed
- ponytail-review: 2 findings, 1 acted on (a per-module `Map.groupBy` rebuilt a
  Set inside every case; one keyed set replaced it). 1 skipped — the tracked-file
  sweep's third copy, recorded in `PLAN.md` rather than lifted inside a step
  about stylesheets
- triage: PASS on all seven — 2 defects, both in artefacts and both found by the
  grep the gate mandates: `PLAN.md` still said "the first two applied", and the
  step-7 note claimed 7.4 and 7.5 "each move more than the other three
  combined", false of either file (891 and 551 against 1238)
- coderabbit-local: PASS on six, OPEN on 4a — 6 findings across the session,
  4 dispositioned as fixed, 1 rejected, 1 skipped
- coderabbit (PR #96): PASS — 2 findings, 1 fixed, 1 rejected
- Not run: code-review, preflight, first-five, review-order

**What the pipeline caught that nothing else would have**

- `coderabbit` on PR #96 produced the session's only user-visible defect, and no
  local gate came near it. `isSession` checked that the keys the UI indexes were
  present, so a stored fragment without `side` restored it as `undefined`; the
  screen choice asks `side === null`, so the board opened over a session that
  never chose a side — against `app-shell` §*Offline start on a warm cache*. An
  array passed as `teamPicks` too, indices 1 to 5 answering `in` as the role keys
  do. Both were pre-existing and both were moved verbatim by the step, which is
  why every "the diff changed no behaviour" check stayed quiet
- `coderabbit-local` on 4c turned `toEqual` into `toStrictEqual` in the discard
  assertion. Small, and the reason is not: `toEqual` treats a key holding
  `undefined` as absent, so the assertion written to catch a half-validated
  session was the one comparison willing to overlook one
- `triage` earned its place twice, both times through the grep rather than
  through reading code

**What no gate caught**

- `main` arrived broken, though not for want of a gate. A CodeRabbit suggestion
  accepted through GitHub's button added `enemyPicks.length > MAX_ENEMY_PICKS`
  without the import; the button commits without running `pre-push`, so `tsc`
  failed and five tests died on the ReferenceError. CI did catch it — `Test`,
  `E2E` and `Lint` all failed on `feat/file-size-cap-4a` — but those runs were
  created at 12:32:37 and the merge landed at 12:32:40, so no verdict existed to
  read when the button was pressed. What found it locally was running the checks
  on a fresh `main` before branching, which is now a Process rule; no review
  skill was involved either way
- Two structural breaks in the test split. A line-range cut took the closing
  brace of the neighbouring `describe` with it, eight blocks folded into one,
  and the suite reported 768 either way. Caught by comparing full describe paths
  by hand; that comparison is now a Process rule in `CLAUDE.md`, and step 7.6
  was rewritten to ask for paths instead of the count
- The discard tests asserted only `side` and `myRole`, and four fixtures store
  both correctly — so those cases passed whether the session was discarded or
  handed back. Found by removing a guard clause and watching nothing fail

## 2026-08-16 — file-size-cap steps 5 to 8, and pre-push-parity

(feat/file-size-cap-5a to -8, spec/ and feat/pre-push-parity,
fix/mutation-floor-delta)

Sixteen branches, so the counts are the session's totals with the branch named
where one gate carried the result.

- zombies: 19 ideas across fourteen runs, 9 acted on. Twelve of the fourteen
  found nothing — every one a pure move. The two that found something were the
  two branches carrying new logic: `pre-push-parity` (13 ideas, 6 became tasks,
  7 dispositioned by name) and step 8 (6 ideas, 3 became tests). One of those
  three was a real defect: `endsWith` is case-sensitive, so a 400-line
  `src/A.TS` was capped by nothing
- warm: SKIPPED on all sixteen — no dependency manifest changed
- ponytail-review: 6 findings across fifteen runs, 6 applied. All structural —
  an unused `export`, four helpers with one reader each, a header describing
  code that had left. Nine runs found nothing
- triage: PASS on all sixteen, 0 findings by design. What it produced is the
  reading: on `feat/file-size-cap-8` it turned up that dropping `bun run lint`
  from the pre-push chain failed no test, because every behavioural case stubs
  the runners; eight membership assertions came out of that
- coderabbit-local: 36 findings across sixteen runs, all dispositioned. Six
  runs found nothing. The substantive ones were four guard bypasses in
  `command-parse.ts`, a machine-local path form the allow-list check could not
  see, and `TEST_FILE` admitting four extensions Bun does not run
- coderabbit (on the pull request): 32 findings dispositioned across seven
  invocations. Two Majors were real and fixed — the range the secret scan
  covers, and the `MODIFIED` delta that would have deleted ten paragraphs of a
  live spec at archive time. Four were put to the user as dismissals and
  settled there
- Not run: review-order, code-review, preflight, first-five

**The gap this session exposed.** `/coderabbit` disposes of what the bot has
posted *when it runs*, and the bot re-reviews on every push. Three merged pull
requests — #102, #106, #111 — carry findings posted after the last pass over
them, never dispositioned. One is a 🟠 Major on `command-parse.ts`: a `case`
clause's `)` pops the same stack a `$(` close does, so
`echo "$(case x in a) git commit -m fix ;; esac)"` reaches the guard as one
quoted word and returns exit 0 — measured, not inferred. The same shape as the
group-inside-substitution bug fixed on that branch, found by the bot an hour
after the branch was reviewed and merged.
