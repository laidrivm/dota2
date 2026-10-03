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
