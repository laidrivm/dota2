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
clause's `)` popped the same stack a `$(` close does, so
`echo "$(case x in a) git commit -m fix ;; esac)"` reached the guard as one
quoted word. The same shape as the group-inside-substitution bug fixed on that
branch, found by the bot an hour after the branch was reviewed and merged.

Measured rather than inferred, and the environment is the claim's: the hook
event was fed as JSON on stdin to `bun scripts/command-guard.ts` under Bun
1.3.14, in a throwaway repository whose `HEAD` is on `main` — the control
`git commit -m fix` returns exit 2 there. The bypass returned **exit 0**.
Fixed on `chore/pipeline-yield-2026-08-16`, where the same probe returns
**exit 2**; two further bypasses came out of fixing it and are recorded in that
commit. Nothing here says what `bash` does with the line — only what the guard
read from it.

Then the bot found a third on the fix's own pull request (#118), the same shape
one level down: `cases` counts how many `case` statements are open and cannot
say whether the scan stands in a pattern or in a command list. In a pattern the
leading `(` is not a subshell and `|` is not a pipe, so
`echo "$(case x in (foo|case) true ;; esac)"; git commit -m fix` suspended a
frame the substitution's own `)` then restored, and the closing quote took the
commit. Measured the same way — same Bun, same throwaway repo on `main`, the
control still exit 2 — the two inputs returned **exit 0** on the parser as
merged and **exit 2** with a `pattern` flag carried beside `cases`. The gap the
session opened is what closed it: this finding was posted after the branch's
last disposition pass and only re-fetching the pull request found it.

## 2026-08-17 — two archives, three proposals (PRs #118–#126)

Nine branches in one session, so the counts are per pull request where one
gate carried the whole result. Every one of them was `/coderabbit`; no other
review skill ran at all.

- coderabbit (#118): PASS — 1 finding, 1 acted on
- coderabbit (#119): PASS — 3 findings, 3 acted on
- coderabbit (#120): PASS — 3 findings, 3 acted on
- coderabbit (#121): PASS — 5 findings, 5 acted on
- coderabbit (#122): PASS — 11 findings, 10 acted on, 1 rejected
- coderabbit (#124): PASS — 13 findings, 11 acted on, 2 rejected
- Not run: triage, zombies, warm, ponytail-review, coderabbit-local, preflight,
  code-review, security-review, first-five, review-order, checklist

**36 findings, 33 acted on, and only one of them was about code.** Everything
after #118 was a change artefact — proposal, design, tasks, delta spec — and
the bot's cross-artefact instruction earned its place six separate times. The
shape recurred so reliably it is worth naming: an artefact is edited to fix a
finding, its three siblings are not, and the next review finds the divergence
the edit created. Findings 5, 6, 8 and 10 on #122 were four rounds of exactly
that on one pull request.

**The one code finding was a live guard bypass**, and the second of its family
on the same parser. `cases` counted open `case` statements without knowing
whether the scan stood in a pattern or a command list, so
`echo "$(case x in (foo|case) true ;; esac)"; git commit -m fix` reached the
guard as one quoted word. Measured in a throwaway repository on `main` under
Bun 1.3.14, control `git commit -m fix` exit 2: the bypass returned **exit 0**
before and **exit 2** after a `pattern` flag was carried beside `cases`.

**Three findings were the bot correcting a claim I had not measured**, and this
is the session's real lesson. On #124 it said `page.bringToFront()` does not
background a page — it was right, and I had written the mechanism into
`design.md` and `tasks.md` as fact. Measuring it took three probes and killed
all three obvious routes (Playwright 1.62.1, its Chromium, headless and
headed): `bringToFront()` leaves `visibilityState: "visible"` with `rAF` still
firing, CDP `Emulation.setPageVisibilityOverride` does not exist, and
`Page.setWebLifecycleState` `frozen` changes neither. What works is an
`addInitScript` stub of `requestAnimationFrame` — and even that silently fails
if written as a plain assignment before `setContent`. The acceptance criterion
was reshaped around the condition that can be created rather than the tab state
that cannot. `docs/verification.md` gained the rule.

**Two counts I published were wrong and the bot found neither.** The
tracked-file sweep went 3 → 5 → 7 copies across the session because I searched
for `show-toplevel`, a token six of the seven sites happen to share and
`readme-map.test.ts` does not; and a `.replace()` that silently matched nothing
left the delta spec contradicting its own proposal while a diff stat and a
`SHALL` count both reported success. Both `CLAUDE.md` rules were tightened
rather than added to.

**What no gate covered.** Nothing but coderabbit ran, so the three proposals
have had no `/zombies` pass over their planned test lists, and the two archives
had no `/triage`. On past evidence that is where the misses live: triage's
mandatory grep has twice caught stale numbers in `PLAN.md` that nothing else
read, and this session shipped three `PLAN.md` entries that were stale within
hours of being written — caught by re-reading them at wrap-up, not by a gate.

## 2026-08-19 — chore/session-wrapup-2026-08-19 (and the three branches it follows)

- zombies: PASS — 45 ideas, 45 acted on (all allocated to task groups; the
  reviews later added 12 more, numbered 46–57)
- warm: not run — no manifest changed
- ponytail-review: not run — the pre-PR path for a documentation, rules or
  config branch is `/triage` alone plus the grep, and all four branches took it
- triage (spec/snapshot-build): PASS — 4 groups, 3 read, 6 defects fixed
- triage (chore/rules-and-budget-gate): PASS — 1 group, 0 defects
- coderabbit-local (spec/snapshot-build): PASS — 12 findings, 12 dispositioned
  (11 applied, 1 Major dismissed with user approval)
- coderabbit-local (chore/rules-and-budget-gate): PASS — 3 findings, 3
  dispositioned (2 applied, 1 rejected: it read PLAN.md's open item as a
  documented contract)
- coderabbit (#129): PASS — 3 findings, 3 dispositioned (2 applied, 1 dismissed)
- coderabbit (#130, four reviews): PASS — 17 findings, 17 dispositioned (11
  applied, 2 already fixed, 1 skipped, 3 dismissed)
- coderabbit (#132): PASS — 4 findings, 4 acted on
- Not run: preflight, security-review, code-review, first-five, review-order

**Triage earned its place twice, in the same way both times.** Its mandatory
read found two criteria contradicting other criteria in the same file — the
`n_eff = 0` case and the `created_at` case — and both had been *introduced* by
applying an earlier review finding. Neither coderabbit pass caught the first.

**The collapsed section held four of #130's seventeen findings.** Four sat in
`Outside diff range comments` and reached neither the inline API
nor the count the user saw. Reading only `Actionable comments posted` would
have silently dropped them; two were real defects.

**What no gate measured until the push.** `diff-budget` was not in the pre-PR
sequence, so a proposal branch reached 858 lines — past the 800 hard limit —
before anything said so. It is now step 1 of that sequence. The same session
also found the gate itself measuring against a stale local `main`, inflating
every reading by 56 lines; `refs/remotes/origin/HEAD` was unset, and the gate
line names no base, so a wrong measurement and a right one print identically.

## 2026-08-19 — chore/rulebook-doc-reach, fix/snapshot-build-prior,
## spec/merged-branch-guard, spec/pre-pr-sequence-gate (PRs #134–#137)

- diff-budget: PASS ×4 — 376, 22, 79, 403/441 lines, 0 over budget
- zombies (merged-branch-guard): OPEN — 15 gaps, 15 dispositioned
- zombies (pre-pr-sequence-gate): OPEN — 23 gaps, 23 dispositioned (22 into
  tasks, 1 became a spec correction rather than a test)
- triage (chore/session-wrapup-2026-08-19): PASS — 5 groups, 3 Medium read,
  4 defects found and fixed
- triage (spec/pre-pr-sequence-gate): PASS — 3 groups, 2 Medium read,
  1 defect found and fixed
- coderabbit-local (chore/session-wrapup-2026-08-19): OPEN — 4 findings,
  4 dispositioned (3 applied, 1 Major dismissed; the dismissal was settled by
  the user merging #134, which carries the deletion it argued against)
- coderabbit-local (spec/pre-pr-sequence-gate): PASS — 5 findings,
  5 dispositioned (4 applied, 1 skipped)
- coderabbit (#136): PASS — 8 findings over two rounds, 8 dispositioned
  (7 applied, 1 skipped)
- coderabbit (#137): PASS — 6 findings, 6 dispositioned (6 applied)
- Not run: warm (no manifest changed), ponytail-review (shortened path for a
  documentation, rules and specification branch — all four took it), preflight,
  security-review, code-review, first-five, review-order

**Both load-bearing findings were the bot's, and both were the same defect
class.** A signal was measured for what moves it and never for what leaves it
still. The reflog carries a fetch time, but a fetch bringing no commit writes
no entry — measured, 139 entries before and after, newest timestamp 57 minutes
old while `FETCH_HEAD` advanced to the current second; the guard would have
refused a commit, named a fetch as the remedy, watched it succeed and refused
again. Its replacement had the mirror defect: `FETCH_HEAD`'s mtime is rewritten
by *any* fetch, so `git fetch origin <other>` refreshed it while the base ref
stood still — measured, mtime +1s, file naming that branch alone. The same file
carried the fix, since it lists which refs the fetch covered.

**A design-document rationale substituted for a case analysis.** The
`pre-pr-sequence-gate` push condition was argued in prose — the push is the
point past which the sequence can no longer run first, so let it discharge the
obligation — and the argument inverts when both events fall in one turn: commit
and push before ending, and the gate passes silently. `/zombies` and `/triage`
both read that design and neither asked about ordering.

**Triage's grep found what no review read.** Two unmerged changes each
scheduled a measurement written into the same figure — the guard's 16–22 ms —
and neither knew about the other; one of them also scheduled a hand edit to a
requirement in a spec it held no delta for.

**The session's own process failures were both rules already written.** A turn
ended asking whether to run the pre-PR sequence, against
`docs/review-toolkit.md`'s "never ask whether to run it", in a session that had
read that file whole hours earlier. Four commits landed on a branch whose pull
request had merged seven hours before, against the rule requiring a PR-state
check before every commit. Neither was an absent or unloaded rule; both are now
proposed as mechanisms (`merged-branch-guard`, `pre-pr-sequence-gate`).

## 2026-08-20 — spec/snapshot-build-unmeasured (PR #140)

Reconstructed from commits, not from the session: the conversation is not
available to the wrap-up that recorded this. Runs other than the review that
`6bf15d1` answers may have happened and left no trace in a commit message.

- coderabbit: findings answered by `6bf15d1` — the env ignore naming four
  files where the pattern names all, a sign claim that held only for positive
  deltas, and a per-component verdict with no scenario telling it apart from a
  per-snapshot one. Count not recoverable.
- Not recoverable: triage, zombies, warm, ponytail-review, coderabbit-local.

**The probe's own correction is the session's finding.** Every earlier attempt
at a historical week returned nothing and read as an absence; the argument is a
Unix timestamp, not the bucket id the response carries (`b9d97e7`). Six buckets
back to 2025-12-23 came out once it was passed correctly.

**A rule named a prohibition and no way to check it.** "A squash-merged branch
is never freed" had no test attached: ancestry answers it wrongly, since a
squash merge leaves the branch's commits out of the base — measured against
`origin/spec/snapshot-build`, which `merge-base --is-ancestor` called unmerged
while PR #130 had closed it on 2026-08-18 (`200df77`).

## 2026-08-21 — snapshot-ingest proposed and cut in two (PRs #141, #142)

- zombies: 62 ideas, 62 folded into the tasks checklist
- diff-budget: FAIL — 955 lines on one propose-stage branch, the first of
  thirteen `spec/` branches ever to fail it
- coderabbit (#141): findings applied across two rounds
- coderabbit (#142, round 1): 5 findings, 5 dispositioned

**Six of thirteen findings in one round were a single defect class.** Tasks
named tests for behaviours no delta spec carried a criterion for. The rule that
closes it went into `openspec/config.yaml` the next session.

**A measured factor travelled to three comparisons it was never taken over.**
The 2.1 between two endpoints was cited in the delta spec against `banDay`, in
the design against the pair endpoint, and in the probe record as "the same
pairing". The bot caught one; a cross-check found the other two.

**The budget failure was not a structural gap.** Splitting a propose stage into
two pull requests was already the repository's practice — PRs #130 and #132 —
and had never been written down. It became `proposal-slicing` rather than a
script change.

## 2026-08-22 — the review tail: rules, and a proposal made current (PRs #142ff, #143, #144)

- coderabbit (#142, round 2): 13 findings counted, 13 dispositioned — 3
  applied, 4 rejected, 6 skipped
- diff-budget: PASS on all three branches (17, 371, 613 lines)
- triage (chore/task-criterion-rule): PASS — 1 group, nothing above Low
- coderabbit-local (chore/task-criterion-rule): 1 finding, 1 applied
- triage (spec/proposal-slicing): PASS — 4 groups, 1 medium-risk group read
- coderabbit-local (spec/proposal-slicing): 3 findings, 2 applied, 1 skipped
- coderabbit (#144): 2 findings, 1 applied in half, 1 skipped
- Not run: zombies, warm, ponytail-review, preflight, code-review

**The grep step found what two reviews and a triage did not.** The prescribed
grep for sites restating what a rules branch changes caught task 1.8 promising
to remove a line from `docs/git-and-prs.md` that is not there; the file holds
nothing about the budget at all. What it holds needs to grow instead. Both
local and PR review read that task and neither opened the file.

**A rule added one session does not bind the artefacts that earned it.** The
measurement rule from 2026-08-21 did not catch `17 KB` and "a second at most"
in the same change's design — 17 KB was measured over one `matchUp` hero-week,
and no latency was ever measured at all.

**A finding correct about grammar and wrong about the fix.** A review read a
requirement citation — "the failing threshold *The budget warns at 500 lines
and fails at 800* fixes" — as a malformed EARS condition and proposed writing
800 into the clause. The relative pronoun was missing, which is the half worth
fixing; the number stays cited rather than restated, since a second copy of a
threshold is what the citation rule exists to prevent.

## 2026-08-22 — the STRATZ client, cut into four (PRs #145, #146, #147, #148)

- diff-budget: FAIL first — 846 lines against the 800 threshold, which is what
  re-cut one task group into four branches; after that 364, 591, 300, 204
  (only the client branch in the warn band, and it cannot leave: the module
  and its harness are 378 lines before a single test)
- zombies: OPEN — 10 gaps on the client, 8 acted on (7 tests, 1 precondition
  comment), 2 skipped with reasons; 0 new on the quota cut; 1 on the retry cut,
  found and closed
- warm: not run — no manifest changed on any of the four
- ponytail-review: 3 findings, 2 acted on (net -3 lines), 1 declined — a
  single-caller helper worth keeping named against a 55-line function
- triage: PASS — 7 groups, 4 high/medium read
- coderabbit-local: PASS — 4, 3, 1 findings over three branches, all
  dispositioned; its Major on the client was real
- coderabbit: #146 10 findings over two reviews, 10 dispositioned; #147 and
  #148 posted 3 and 2 **after they were merged**, 5 dispositioned a session
  later
- diff-budget / grep / coderabbit-local on the wrap-up branch itself
  (`chore/session-wrapup-2026-08-22`, 73 lines): PASS — 0 findings, the docs
  path's single pass
- Not run: preflight, security-review, code-review

**The review count is not the count until the reviews are counted.** A first
pass over #146 read nine inline comments and reported nine. The bot had posted
two reviews; the second carried a tenth finding, and only re-fetching and
reconciling against its own `Actionable comments posted` lines found it. The
same shape then repeated in the other direction: #147 and #148 were merged
before their reviews arrived, so five more findings existed in the API and in
no report until this wrap-up went looking.

**A test suite can be worth less than its green.** The key-leak assertion
enumerated the seven failure paths the client had; leaking the key through an
eighth would have passed. Moving it into the helper every failure passes
through turned a leak on the retry-exhausted path from zero failing tests into
four. The same shape twice more: the console spy named four levels of a
28-member `console`, and the quota verdict was read on the first attempt only.
Each was found by breaking the mechanism the test named and watching what did
not fail.

**The requirement said "the run", and the code stopped a request.** A window
reporting nothing left made the client fail the request that met it and no
more, so the next pull went to the network — two requests where the
requirement allows one. Nothing in the wording was ambiguous; the layer that
could enforce it simply was not the layer that read it.

**Fake timers take the runner's own timeout with them.** Under
`jest.useFakeTimers()` a promise that can never settle hangs the whole run
rather than failing one test, and `bun test --timeout` does not cut it short —
measured at 180 seconds before the harness was killed. The fixture's `settle`
now raises when it runs out of timers with work still pending.

## 2026-08-23 — the schema and the database edge (PR #150)

- diff-budget: PASS throughout — 342, then 368, then 421 lines (303 source /
  118 test), never near the warn line; the group was sized for it at propose
  time and did not need re-cutting
- zombies: OPEN — 6 gaps, 6 dispositioned (2 tests written, 1 real defect
  fixed, 3 skipped with reasons). The defect: a `connect` that threw part-way
  through the schema left a pool nobody held a reference to
- warm: not run — no manifest changed. The pinned `postgres` service image is
  a dependency it would not have found either, since it is in no manifest;
  that gap became a rule the same night
- ponytail-review: 2 findings, 2 acted on (net -5 lines); two keeps were
  named in the report and counted as neither, being things the pass declined
  to raise rather than findings it dismissed
- triage: PASS — 5 groups, 3 high/medium read, and the reading itself found 2
  defects: a `close()` in the failure path that could replace the error that
  sent it there, and a duplication no comment named
- coderabbit-local: PASS — 3 findings, 3 dispositioned (1 applied and carried
  to 2 sites the bot did not name, 1 Major rejected, 1 Trivial skipped)
- coderabbit: PASS — 3 findings, 3 dispositioned (2 applied, 1 Major rejected
  against a measurement). Its stated `Actionable comments posted: 3`
  reconciled with the inline count on the first pass
- diff-budget / grep / coderabbit-local on the wrap-up branch itself
  (`chore/commit-trailers`, 52 lines): PASS — 0 findings, the docs path's
  single pass
- Not run: preflight, security-review, code-review, simplify

**A type declaration is not evidence the method exists.** `sql.file(path)` is
declared to return the same `Query` as `sql.unsafe`, `.simple()` included, and
at runtime what it returns carries no `.simple()` at all (bun 1.3.14). The
typecheck was green over the call. Only a run against a live Postgres said
otherwise, and only because this group put one in CI rather than deferring the
database edge to the change that reads it.

**A hang is not a failure, and costs more than one.** `expect(query).rejects`
never settles where `query` is a thenable rather than a Promise, so six tests
each burned the 5-second per-test timeout instead of failing in milliseconds —
and the first symptom was the whole `bun test` invocation appearing to stall,
not a red test. Isolated with a two-test probe: the matcher timed out, the
`then(ok, err)` form answered in 34 ms. Same family as the fake-timer entry
above: the runner's own defence does not reach every way a promise can not
settle.

**A `🔵 Trivial` that a five-minute check turned into a rule.** "Track the
PostgreSQL image as a CI dependency" reads as bookkeeping until the question
"raised by what?" is actually put to the documentation: Dependabot's
`github-actions` ecosystem updates only `owner/repo@ref` and states container
registry URLs are unsupported, and its `docker` ecosystem reads Dockerfiles and
Kubernetes manifests. Nothing raises a workflow service image. The rule that
came out of it immediately reached eight `bun-version` pins nobody raises
either — which no gate in the sequence would have found, because `/warm` looks
in manifests and these are not in one.

## 2026-08-23 — groups 5 to 7, the rulebook split, and a vendor dropped (PRs #152–#156)

- diff-budget: PASS on four of five branches (129, 365→414, 154→176, 217).
  Group 5 alone ran WARN — 603 rising to 705 against a warn line of 500 and a
  failing line of 800. The group's own tasks.md said groups were sized under
  the warn line; this one was not, and the gate that admits it says so rather
  than the sizing note being right
- zombies: OPEN → PASS three times — 5 gaps on group 5 (5 tests written), 2 on
  group 6, 1 on group 7, all dispositioned. Two were real defects rather than
  missing tests: a hero slug from a vendor's response that `join` followed out
  of the mirror directory, and `typeof id === "number"` admitting NaN, 9001.5
  and -1 into a Postgres `int`
- warm: not run on any of the five — no dependency manifest changed all
  session. Three network sources were added or moved (OpenDota's patch list,
  Valve's CDN, STRATZ's hero constants) and none of them is a manifest entry,
  so this gate had nothing to look at by construction
- ponytail-review: 4 findings across three branches, 2 acted on. The two
  skipped were named with their reasons — a `sleep` deliberately not shared
  across two vendors' retry policies, and a five-line test helper whose second
  copy is cheaper than a module
- triage: PASS four times, and the reading found 5 defects the gates ahead of
  it had passed over — a `null` list entry raising a type error instead of the
  source's failure, a workflow comment claiming a twenty-second suite ran in
  milliseconds, a requirement contradicting its own neighbour, a demonstrative
  whose antecedent stayed behind in the file it was extracted from, and a slug
  checked three steps after two locations had been derived from it
- coderabbit-local: 2 runs — 2 findings on group 5 (both Trivial, 0 acted), 1
  on group 7 (Minor, applied: `body.data` without an optional chain). Not run
  on group 6 or the rulebook branch, where review went to CI instead
- coderabbit (PR): 10 findings over three pull requests, 6 acted on. The one
  that mattered: `URL.pathname` keeps its percent-encoding, so a checkout in a
  directory with a space in its name scanned `%20` — every icon 404, and the
  font scan, which has no catch, taking the server down at startup. It reached
  two more files the review never saw
- Not run: preflight, review-order, first-five, code-review, security-review,
  playwright-cli

**What the gates did not catch, and what did.** Two of the session's worst
moments were found by neither a gate nor a bot. A symlink to
`/Users/laidrivm/node_modules`, committed by a `git add -A` in a scaffolded
worktree, was caught by `scripts/file-size.test.ts` reporting a new extension
`s` — the last character of a path with no dot in it. A branch switch that
removed the files a run was reading reported `ENOENT` on a test file rather
than a failure, and cost a diagnosis. Both became rules in
`docs/git-and-prs.md`; neither is a shape any review skill in the sequence
looks for.

## 2026-08-24 — snapshot-ingest groups 8 to 11, test:db, local verification

(feat/snapshot-ingest-8 to -11b, chore/test-db, chore/local-verification)

- zombies: PASS — 7 gaps, 7 acted on (group 9)
- ponytail-review: PASS — 1 finding, 1 acted on (group 9)
- triage: PASS — 1 finding, 1 acted on (group 9)
- coderabbit-local: PASS — 4 findings, 4 acted on (group 9)
- coderabbit: PASS — 5 findings, 4 acted on, 1 dismissed (PR #159)
- zombies: PASS — 5 gaps, 5 acted on (group 10)
- ponytail-review: PASS — 1 finding, 1 acted on (group 10)
- triage: PASS — 2 findings, 2 acted on (group 10)
- coderabbit-local: PASS — 2 findings, 1 acted on (group 10)
- coderabbit: PASS — 2 findings, 1 acted on, 1 dismissed (PR #160)
- zombies: PASS — 5 gaps, 5 acted on (group 11)
- ponytail-review: PASS — 1 finding, 1 acted on (group 11)
- triage: PASS — 1 finding, 1 acted on (group 11)
- coderabbit-local: PASS — 4 findings, 4 acted on (group 11)
- coderabbit: PASS — 1 finding, 1 acted on (PR #158 re-fetch, 11b)
- triage: PASS — 1 finding, 1 acted on (chore/test-db)
- coderabbit-local: PASS — 1 finding, 1 acted on (chore/test-db)
- coderabbit: PASS — 4 findings, 4 acted on, 1 partial dismissal (PR #163)
- triage: PASS — 2 findings, 2 acted on (chore/local-verification)
- coderabbit-local: PASS — 0 findings (chore/local-verification)
- Not run: warm (no manifest changed), preflight, code-review, review-order,
  first-five

## 2026-08-24 — snapshot-ingest group 11c, and the repo-layout proposal

(feat/snapshot-ingest-11c, spec/repo-layout)

- zombies: PASS — 7 gaps, 5 acted on, 2 skipped (11c)
- ponytail-review: PASS — 2 findings, 2 acted on (11c)
- triage: PASS — 1 finding, 1 acted on (11c)
- coderabbit-local: PASS — 2 findings, 1 acted on, 1 rejected (11c)
- zombies: PASS — 24 gaps, 23 routed into tasks.md, 1 dropped (repo-layout,
  propose stage; the dropped one asked for stable output ordering, which the
  local CodeRabbit pass then judged a nicety rather than a contract)
- triage: PASS — 1 finding, 1 acted on (repo-layout)
- coderabbit-local: PASS — 6 findings, 6 acted on (repo-layout)
- coderabbit: PASS — 3 findings, 3 acted on (PR #169)
- Not run: warm (no manifest changed on either branch), ponytail-review on
  repo-layout (documentation branch, short sequence), preflight, code-review,
  review-order, first-five, security-review

Note for the ledger: on the propose branch the local pass found 6 and the PR
bot found 3 more of the same family — artefact-consistency findings, the
`.coderabbit.yaml` path instruction for `openspec/changes/**`. Both stages
earned their place; the second was not the first one failing. The three the
bot added were all "a task names a behaviour no criterion fixes", which is the
one class where the local pass has now twice been the less complete of the two.

## 2026-08-25 — repo-layout, all four groups and the archive

(feat/repo-layout-1 … -4, chore/archive-repo-layout; PRs #171–#174)

- zombies: OPEN→PASS — 3 gaps, 1 acted on, 2 skipped (group 1)
- ponytail-review: 2 findings, 2 acted on (group 1)
- triage: OPEN→PASS — 3 groups, 1 finding, 1 acted on (group 1)
- coderabbit-local: PASS — 5 findings, 5 dispositioned (2 fixed, 1 rejected,
  2 trivial skipped) (group 1)
- coderabbit: PASS — 7 findings, 7 dispositioned (2 fixed, 3 skipped,
  2 Major dismissals put to the user and approved) (PR #171)
- zombies: OPEN→PASS — 1 gap, 1 acted on (group 2)
- ponytail-review: 2 findings, 2 acted on (group 2)
- triage: OPEN→PASS — 4 groups, 1 finding, 1 acted on (group 2)
- coderabbit-local: PASS — 5 findings, 5 dispositioned (2 fixed, 2 skipped,
  1 Major dismissal put to the user and approved) (group 2)
- zombies: OPEN→PASS — 1 gap, 1 acted on (group 3)
- ponytail-review: 1 finding, 1 acted on (group 3)
- triage: OPEN→PASS — 5 groups, 1 finding, 1 acted on (group 3)
- coderabbit-local: PASS — 6 findings, 6 dispositioned (3 fixed, 3 trivial
  skipped) (group 3)
- zombies: OPEN→PASS — 1 gap, 1 acted on (group 4)
- ponytail-review: 2 findings, 2 acted on (group 4)
- triage: OPEN→PASS — 4 groups, 0 findings (group 4)
- coderabbit-local: PASS — 2 findings, 2 acted on (group 4)
- coderabbit: PASS — 5 findings, 5 dispositioned (4 fixed, 1 skipped) (PR #174)
- triage: OPEN→PASS — 4 groups, 0 findings (archive)
- coderabbit-local: PASS — 2 findings, 2 acted on (archive)
- Not run: warm (no dependency manifest changed on any of the five branches),
  preflight, code-review, review-order, first-five, security-review

Note for the ledger: `/triage` produced a real defect on three of the five
branches, and on two of those the defect was in code written earlier in the
same turn — a test asserting every patch sits under `z9.` when
`patches.test.ts` deliberately empties that table, and a traversal probe
aimed at a file the same move had just relocated. It returns no findings by
design, so it costs a read rather than a report; this is the first month it
has paid for that read three times out of five.

The two `/coderabbit` runs both found things the local pass had not, and both
were the same family as last time: consistency between an artefact and what
the code around it does. On PR #174 the bot's two Majors were both this
repository's own rule — scope a scan by what it exempts — applied to the check
sitting beside the one that documents that rule. The local pass had read that
file three times without raising it.

## 2026-08-25 — feat/snapshot-build-1 … -3b

- diff-budget: PASS (group 1), PASS (group 2), WARN 798 → re-cut (group 3),
  WARN 528 (group 3a), FAIL 801 → re-cut (group 3b), WARN 707 (group 3b)
- zombies: OPEN→PASS — 1 gap, 1 acted on (group 1)
- ponytail-review: 1 finding, 1 acted on (group 1)
- triage: OPEN→PASS — 2 groups, 0 findings (group 1)
- coderabbit-local: PASS — 1 finding, 1 dispositioned (0 fixed, 1 skipped)
  (group 1)
- zombies: OPEN→PASS — 2 gaps, 2 acted on (group 2)
- ponytail-review: 1 finding, 1 acted on (group 2)
- triage: OPEN→PASS — 3 groups, 0 findings (group 2)
- coderabbit-local: PASS — 1 finding, 1 dispositioned (0 fixed, 1 skipped)
  (group 2)
- zombies: OPEN→PASS — 5 gaps, 5 acted on (group 3a)
- ponytail-review: 3 findings, 3 acted on (group 3a)
- triage: OPEN→PASS — 3 groups, 1 finding, 1 acted on (group 3a)
- coderabbit-local: PASS — 3 findings, 3 acted on; second pass 0 findings
  (group 3a)
- zombies: OPEN→PASS — 2 gaps, 2 acted on (group 3b)
- ponytail-review: 1 finding, 1 acted on (group 3b)
- triage: OPEN→PASS — 4 groups, 1 finding, 1 acted on (group 3b)
- coderabbit-local: PASS — 8 findings over three passes, 8 dispositioned
  (6 fixed, 1 rejected, 1 Major dismissal put to the user and overruled)
  (group 3b)
- coderabbit: PASS — 5 findings, 5 dispositioned (3 fixed, 1 rejected,
  1 skipped) (PR #180)
- Not run: warm (no dependency manifest changed on any of the four branches),
  preflight, code-review, review-order, first-five, security-review, checklist

Note for the ledger: `diff-budget` was the step that changed the shape of the
work, twice, and it is the only step that did. Group 3 measured 798 lines as
one PR and 801 as two; both times the answer was to re-cut rather than squeeze,
and the first re-cut was worth more than the arithmetic — unsplit, `rows.ts`
was reached only by a suite a plain `bun test` skips, which is the change's own
*Arithmetic testable without a database* read backwards. A gate that fires on a
line count found a testing defect.

`/coderabbit` again found what four local passes had not, and again it was a
consistency question rather than a logic one: a `LIKE 'staging\_%'` whose
escape JavaScript removes before Postgres parses it, so the scan was scoped by
what it covers — this repository's own rule, in a line written to obey it.
Three local passes had read that line.

Two Major dismissals were put to the user this session and both were overruled,
each toward the more thorough option. Both dismissals rested on the task list
assigning the work to a later group, which is the cheapest reason to find and,
on this evidence, the weakest to act on.
