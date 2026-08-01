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
