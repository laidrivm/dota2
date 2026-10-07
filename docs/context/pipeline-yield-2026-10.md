# Pipeline yield

Continues `pipeline-yield-2026-09.md`. One entry per session, appended never
rewritten.

## 2026-10-03 — chore/session-yield-2026-09-30 (merged as PR #285)

- diff-budget: PASS — four runs as the diff grew (392 → 394 → 396 → 418
  lines), 0 findings
- triage: OPEN → PASS — 4 groups, 0 high-risk, 3 Medium read, 0 findings
- coderabbit-local: PASS — 2 findings, 2 acted on (both Minor: uncited code
  claims in the save point, and `ready` read as "done"; the citation pattern
  then fixed at three more sites in the same file)
- Not run: zombies, warm (no manifest changed), coderabbit, ponytail-review,
  preflight, code-review, security-review, first-five, review-order

A documentation branch, so the sequence was the short one `docs/review-toolkit.md`
gives it. Two things the counts hide:

**The grep step out-found the gates.** Grepping for every site restating what
the branch changed — a step, not a skill — found two open questions in the save
point that the session itself had already answered. Neither gate would have.

**The PR bot found three more, and nothing read them.** CodeRabbit reviewed
PR #285 at 13:17 with 3 inline comments (2 Minor, 1 Trivial); the PR merged at
13:21, and `/coderabbit` did not run. One of the three is the same pattern
`coderabbit-local` had raised — code claims cited without lines — in a file the
local fix was not extended to (`docs/research/rtk-2026-10-01.md:75`): "fix the
cause" was applied across one file, not across the branch. One of its claims
is itself wrong — it puts `compile_exclude_patterns` at line 1445 of rtk
`v0.50.0`, where the source read at that tag has it at 1540. The three stay
undispositioned until `/coderabbit 285` runs.

## 2026-10-03 — chore/prompt-audit-2026-10-03, chore/openspec-1-14 (merged as PRs #288, #287)

- prompt-audit (`/doctor prompt-audit`): 57 findings over the configuration
  that loads into sessions (36 dated-text, 21 configuration-file), 30 acted on
  across this repository, the skills repository and `~/.claude/skills`; the
  opsx and vendored playwright-cli findings were left as shipped
- diff-budget: FAIL 2225 → re-cut → PASS 14 (prompt-audit); FAIL 2211
  (openspec-1-14, merged under `oversize:` by the owner's exemption); PASS 16
  after one more commit — 0 findings
- triage: OPEN → PASS — 1 group, 0 high-risk, 1 Medium read, 0 findings
  (prompt-audit)
- coderabbit-local: PASS — 0 findings (prompt-audit)
- triage: OPEN → PASS — 2 groups, 1 high-risk read, 0 findings (openspec-1-14)
- coderabbit-local: BLOCKED — review refused, "Review failed: Unknown error"
  twice on the 2211-line diff (openspec-1-14)
- coderabbit-local: PASS — 0 findings (prompt-audit, after the rule removal)
- coderabbit: OPEN → PASS — 11 findings, 11 dispositioned (0 fixed, 3 Major
  rejected with the owner's agreement, 8 skipped) (PR #287)
- Not run: zombies, warm (no manifest changed — the OpenSpec upgrade is a
  global install outside every manifest), ponytail-review, preflight,
  code-review, security-review, first-five, review-order, coderabbit on PR #288

**Every PR finding sat in generated text.** All eleven on PR #287 were in
`.claude/commands/opsx/*.md`, which `openspec update` rewrites whole, so none
could be fixed here. Excluding the path in `.coderabbit.yaml` changes a gate and
is undecided.

**One finding is still open.** CodeRabbit posted one Minor on PR #288
(`CLAUDE.md:211`: bare `npm init` maps to `bun init`, only `npm init <initializer>`
to `bun create`) and the PR merged without `/coderabbit 288`.

## 2026-10-04 — spec/retire-plan-md, spec/board-lifecycle

- zombies: OPEN → PASS — 11 gaps, 11 dispositioned (10 into tasks, 1 already
  covered by `scripts/repo-layout.test.ts:69`/`:124`) (`retire-plan-md`)
- zombies: OPEN → PASS — 5 gaps, 5 dispositioned (all into task 1.2)
  (`board-lifecycle`)
- coderabbit: OPEN → PASS — 2 findings, 2 dispositioned (1 Major fixed, 1 Major
  rejected with the owner's agreement) (PR #292)
- Not run: triage, warm (no manifest changed), coderabbit-local,
  ponytail-review, preflight, code-review, security-review, first-five,
  review-order, coderabbit on PR #290 and PR #291

**The fixed Major was a defect copied from the live spec.** `task-board`
promised that `scripts/board-state.ts` reports nothing for a card at a
hand-moved status, but the script reads no card and derives `ready` for any
complete directory. The `MODIFIED` delta renamed the values and re-asserted
the claim; `docs/feature-workflow.md` now asks for a carried scenario to be
read against its code first.

**The rejected Major needed the boards, which the bot cannot see.** It asked
for a `Pointer` property and its writes; both boards have carried one since
`notion-task-board`.

**PR #290's Minors were skipped by the owner without `/coderabbit 290`.**

## 2026-10-05 — feat/board-lifecycle-3, chore/archive-board-lifecycle (merged as PRs #300, #301)

- triage: OPEN → PASS — 3 groups, 1 medium read (`feat/board-lifecycle-3`)
- coderabbit-local: PASS — 0 findings, over a diff three commits stale
  (`feat/board-lifecycle-3`)
- coderabbit-local: OPEN → PASS — 3 findings, 3 dispositioned (1 Minor fixed,
  1 Minor rejected, 1 Minor skipped) (`feat/board-lifecycle-3`, re-run over the
  final diff)
- coderabbit: OPEN → PASS — 3 findings, 3 dispositioned (1 Minor fixed, 1 Minor
  rejected, 1 Minor skipped) (PR #300)
- zombies: OPEN → BLOCKED — 2 gaps, both carried to a `Harness` card rather than
  into the branch (`chore/archive-board-lifecycle`)
- triage: OPEN → PASS — 3 groups, 2 medium read (`chore/archive-board-lifecycle`)
- coderabbit-local: stopped before it returned, at the owner's instruction
  (`chore/archive-board-lifecycle`)
- coderabbit: PASS — 1 finding, 1 dispositioned (1 Major fixed) (PR #301)
- Not run: warm (no manifest changed), ponytail-review, preflight, code-review,
  security-review, first-five, review-order

**A stale local review reads exactly like a clean one.** The first
`coderabbit-local` ran in a background agent launched before the branch's last
three commits, and reported `PASS — no findings` over the three files it had
seen while the branch changed five. The re-run over the final diff returned
three findings. Nothing in the gate line tells the two apart, and the
`reviewedFiles` list is the only thing that does — which is why the re-run was
asked for it explicitly.

**The session's only Major came from the cloud review, on the branch whose
local one never finished.** `/coderabbit-local` on
`chore/archive-board-lifecycle` was stopped at the owner's instruction, and
`/coderabbit` on PR #301 then found that `task-board`'s *A status the tree
cannot see* scoped by an enumeration of six statuses where the floor two
paragraphs above it scopes by position: a card at `idea` with a complete
directory was both to be corrected and to be left alone. `CLAUDE.md` already
forbids that shape — *scope a scan by what it exempts, never by an enumeration
of what it covers* — and nobody had held the spec to its own rule.

**Both `zombies` gaps left the branch instead of entering it.** They were about
`biome.json`'s `$schema` drifting from the version the manifest pins, which no
test watches; the branch under way was an archive, so they became the `Harness`
card *Pin biome's $schema to the version the manifest names*.

## 2026-10-05 — feat/retire-plan-md-1, feat/retire-plan-md-2, chore/archive-retire-plan-md (merged as PRs #303, #304, #305)

- triage (feat/retire-plan-md-1): PASS — 3 groups, 0 high-risk, 2 Medium read, 0 findings
- coderabbit-local (feat/retire-plan-md-1): PASS — 1 finding, 1 acted on
- zombies (feat/retire-plan-md-2): OPEN → PASS — 2 gaps, 2 acted on
- triage (feat/retire-plan-md-2): PASS — 4 groups, 0 high-risk, 2 Medium read, 0 findings
- coderabbit-local (feat/retire-plan-md-2): PASS — 0 findings
- opsx:verify: 0 critical, 1 warning, 2 suggestions — 3 acted on
- triage (chore/archive-retire-plan-md): PASS — 3 groups, 0 high-risk, 1 Medium read, 0 findings
- coderabbit-local (chore/archive-retire-plan-md): did not return before the
  merge — 1 finding seen, 0 acted on (skipped: the proposal's non-goal on
  Purpose sections)
- Not run: warm (no manifest changed), coderabbit (PR #303's comments were read
  through `gh`, the skill was not invoked), ponytail-review, preflight,
  code-review, security-review, first-five, review-order

**The finding the local pass missed was a claim about another tool.**
`/coderabbit-local` on step 1 passed the Dependabot comment's "reads
`dependencies` and `devDependencies` only"; the cloud review on PR #303 caught
it against dependabot-core's bun parser, which also reads
`optionalDependencies` and the lockfile. Fixed on step 2 after reading the
parser at `9cc93f41038a`.

**`zombies` found what the proposal-stage list could not.** Both gaps were
created by the implementation: the board names already recurred in the card
bullet, so deleting the new list passed every name case, and the ~350 trigger
was stated with nothing checking it.

**`triage` returned no findings by design, and its grep did the work.** The
grep after step 1's map found five sites the step had made false — `CLAUDE.md`,
the `PLAN.md` map row, `docs/feature-workflow.md`, `spec-inbox/README.md` and
`letter-patch-detection` 1.7 — which the task list had filed under step 2.

## 2026-10-07 — feat/extract-harness-4 … chore/archive-extract-harness

- coderabbit (harness#3, round 1): PASS — 7 findings, 6 acted on (5 fixed, 1
  rejected: CRLF already stripped by the regex), 1 skipped to `scan-lift`
- coderabbit (harness#3, round 2): PASS — 3 findings, 3 acted on (the subshell
  `cd` Major decided by the user: check every directory a line may run in)
- zombies (feat/extract-harness-5): PASS — 0 gaps
- warm (feat/extract-harness-5): PASS — 1 dependency vetted, 0 findings
- triage (feat/extract-harness-5): PASS — 4 groups, 1 high-risk read, 0 findings
- coderabbit-local (feat/extract-harness-5): PASS — 0 findings
- coderabbit-local (chore/co-author-model): PASS — 0 findings
- zombies (feat/extract-harness-6): PASS — 0 gaps
- warm (feat/extract-harness-6): PASS — no dependency changed
- triage (feat/extract-harness-6): PASS — 5 groups, 0 high-risk, 3 Medium read
- coderabbit-local (feat/extract-harness-6): PASS — 1 finding, 0 acted on
  (Trivial)
- coderabbit-local (feat/extract-harness-7): PASS — 1 finding, 1 acted on
- coderabbit (#312): PASS — 1 finding, 1 acted on
- coderabbit-local (harness feat/extract-harness-8): PASS — 1 finding, 0 acted
  on (skipped: verbatim copy)
- coderabbit (harness#4): PASS — 4 findings, 2 acted on
- coderabbit-local (feat/extract-harness-9): PASS — 3 findings, 2 acted on
  later through harness#5 (the copy cannot be edited in place)
- coderabbit (#313): PASS — 3 findings, 2 acted on, 1 skipped to step 10
- coderabbit-local (feat/extract-harness-10): PASS — 0 findings
- coderabbit-local (harness feat/extract-harness-11): OPEN → PASS — 6
  findings, 5 acted on through `/opsx:update`, 1 Major rejected by the user
- coderabbit (harness#6): PASS — 27 findings over three reviews, 14 acted on,
  1 rejected, 12 skipped (stale paths filed as a card, main specs, Trivial)
- coderabbit-local (feat/extract-harness-12): PASS — 0 findings
- coderabbit-local (chore/archive-extract-harness): PASS — 1 finding, 1 acted on
- coderabbit (#316): PASS — 3 findings, 1 acted on, 2 skipped (no defect;
  handled by `glob-row-example`)
- Not run: ponytail-review, preflight, code-review, security-review,
  first-five, review-order, opsx:verify

**The moved changes drew the most findings of the whole change, and they
were the least-read text in it.** Copied verbatim into the harness, the seven
changes went through no review on the way in; `coderabbit-local` and the cloud
review on harness#6 found 5 Majors in them between them — a `gh api graphql`
refusal that would have broken the `coderabbit` skill's own thread read, a
`git cherry` verdict blind to merge commits (the harness's own merge style), a
Stop gate that would refuse nearly every committing turn — none of which any
earlier review of those changes had raised.

**`warm`, `zombies` and `triage` produced no finding across five steps.** Each
pre-PR run of the three returned PASS with nothing; every finding of the
change came from the CodeRabbit passes or from verifying a task's own claim
(the 6.4 floor, the 11.2 floor, the 12.4 preview).
