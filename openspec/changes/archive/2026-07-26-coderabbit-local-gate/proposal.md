# CodeRabbit local review as a pre-push gate

## Why

The pre-PR sequence ends at `/triage`, and `docs/review-toolkit.md` says so
explicitly: "Your sequence ends there — the PR link is the deliverable."
CodeRabbit's findings therefore arrive only after the PR is open, on the bot's
own schedule, which is also why `/coderabbit` is reserved for the user —
waiting on it burns a session. The consequence is that every defect the bot
would catch lands as review churn on an open PR instead of being fixed before
the branch is pushed.

The `coderabbit-local` skill removes the reason for that split: `coderabbit review`
runs the same review against the working branch synchronously, with no PR and
no waiting. Nothing in the rationale for deferring `/coderabbit` applies to a
review that returns in the same turn.

Separately, a justification for skipping a finding currently evaporates: the
bot raises the same point on the next branch. CodeRabbit's own learnings
cannot be created from the CLI — every documented path needs a PR comment or
the web dashboard — but this repo already gives `.coderabbit.yaml` a
`knowledge_base.code_guidelines.filePatterns` list naming `**/CLAUDE.md` and
`docs/*.md`. If the CLI reads that config, a justification written as a rule
in `CLAUDE.md` is read back by the next review, and the two ends only need
connecting. Whether it does is not documented and is the first thing this
change establishes — see design.

## What Changes

- Establish, before any rule is written, whether `coderabbit` reads the repository's
  `.coderabbit.yaml` — via `coderabbit review --show-prompts`, which prints the saved
  prompts of the most recent local review without running a new one. If it
  does not, the prescribed invocation carries `--config .coderabbit.yaml
  CLAUDE.md`. An unaligned local reviewer would raise what the PR bot
  suppresses and miss what it enforces, doubling the noise this change exists
  to cut.
- Extend the pre-PR sequence in `docs/review-toolkit.md`: after `/triage`, run
  `/coderabbit-local` against the branch, then push. The sequence's stated
  end moves from `/triage` to the local review.
- Define the loop: at most three reviews with fixes between them, stopping
  early when a review returns nothing above Minor.
- Auto-apply 🟠 Major and 🔴 Critical findings that survive verification,
  without pausing for approval. **This deviates from the skill's own "No
  fixes before approval" rule** — recorded as a deliberate project override.
- Collect 🟡 Minor findings across all passes and report them once, at the
  end, each fixed or skipped with a reason.
- Route a skipped Minor into the `CLAUDE.md` "Rules" list **only** when it
  reflects a settled project convention, per the existing fix & capture
  loop and its rule quality bar. A one-off keeps its reason in the report
  and becomes no rule.
- State that `/coderabbit` stays the user's to invoke and `/coderabbit-local`
  is the agent's, and why the two differ.

## Capabilities

### New Capabilities

- `local-review-loop`: how the agent runs CodeRabbit's local CLI over a
  branch before pushing — how many passes, what it fixes without asking,
  when it stops, and where a skipped finding's justification goes.

### Modified Capabilities

None.

## Non-goals

- **Creating CodeRabbit learnings.** Not reachable from the CLI: the
  documented paths are a PR comment reply, `@coderabbitai add a learning
  using <file>` in a PR comment, and admin edits in the web dashboard.
  `knowledge_base.learnings` in the config sets only `scope` and
  `approval_delay`. The `code_guidelines` route above is the substitute.
- **Replacing `/coderabbit`.** The PR-comment skill still closes the loop
  after a PR is open, and stays the user's to invoke.
- **Installing `coderabbit`.** It is not on this machine's PATH. `brew install
  coderabbit` is the supported route; the published `curl … | sh` installer
  is forbidden by `CLAUDE.md`. Installing it and running `coderabbit auth login` are
  the user's, not the agent's.
- **Mirroring `.gitignore` into `path_filters` for the local run.** The CLI
  reference defines `--include-untracked` as tracked changes plus
  **non-ignored** files, so an ignored path is already out of scope under the
  widest scope flag.
- **Running `coderabbit` in CI or in a git hook.** Each review takes minutes and
  needs authenticated network access; the pre-push hook stays
  `typecheck && bun test`.
- **Editing the `coderabbit-local` skill.** It lives in the shared skills
  repo; the override lives here.

## Impact

- `docs/review-toolkit.md` — gains `/coderabbit-local`, and the pre-PR
  sequence's ending changes.
- Sequenced after `vendored-skill-permissions`, which edits the same file.
- No code, no dependency, no CI workflow.
- Wall-clock cost per PR: up to three reviews of several minutes each.
