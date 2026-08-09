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
