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
