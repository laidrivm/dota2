# The propose stage's own seam — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the code they cover (docs/testing.md — TDD for edge cases). The
bracketed numbers are that run's idea numbers, so every one of its 16 ideas is
traceable to the task that closes it.

One task group, so one pull request on `chore/proposal-slicing`: the rule and
the check that enforces it land together, because a rule written without its
mechanism is the prose `agent-rulebook` requires to go the moment the mechanism
arrives.

## 1. The propose-stage seam and the refusal that holds it

- [ ] 1.1 Write the refusal tests: an unsplit proposal over the threshold with
      a marker carrying a reason reports `FAIL` [2]; the refusal fires at
      exactly the failing threshold [4]; an unsplit proposal one line below it
      warns and exits zero [5]; a refused branch exits non-zero [9]. (Req:
      change-slicing — The override does not admit an unsplit propose-stage
      branch)
- [ ] 1.2 Write the tests for what the refusal must not reach: a branch adding
      neither artefact still reports the override [1]; a split half at or above
      the threshold with a marker reports the override [6]; a branch adding
      `proposal.md` for one change and `tasks.md` for another is not one
      unsplit proposal [3]. The first of those is also what covers an
      implementation branch, which adds neither artefact. (Req: change-slicing
      — The override does not admit an unsplit propose-stage branch)
- [ ] 1.3 Write the tests for what counts as authoring a proposal: an archive
      move is not refused [10]; adding `proposal.md` while modifying an
      existing `tasks.md` is not refused [11]; modifying both without adding
      either is not refused [12]; an archived path is not matched as a change
      path, the glob stopping at a separator [13]; a `proposal.md` outside
      `openspec/changes/` does not trigger it [14]. (Req: change-slicing — The
      override does not admit an unsplit propose-stage branch)
- [ ] 1.4 Write the gate-line tests: the refused line names both branches of
      the seam rather than the count alone [7]; its verdict word is `FAIL`, so
      a refused branch never reads as `OVERRIDE` [8]; a marker carrying no
      reason on an unsplit proposal reports the propose-stage remedy rather
      than the reasonless-marker message [15]. (Req: change-slicing — The
      override does not admit an unsplit propose-stage branch)
- [ ] 1.5 Write the split test: a proposal carried across `spec/<slug>` and
      `spec/<slug>-plan`, each under the threshold, passes on both [16]. (Req:
      change-slicing — The propose stage's reviewable unit is the artefact
      pair)
- [ ] 1.6 Implement the detection in `scripts/diff-budget.sh`: the additions of
      `proposal.md` and `tasks.md` under one change directory, by a pathspec
      whose glob does not cross a separator and a filter that reads only
      additions. (Req: change-slicing — The override does not admit an unsplit
      propose-stage branch)
- [ ] 1.7 Implement the refusal and its gate line, so an unsplit propose-stage
      branch at or above the failing threshold fails whatever its body carries
      and the line names the two pull requests to open. (Req: change-slicing —
      The override does not admit an unsplit propose-stage branch)
- [ ] 1.8 Take the line the mechanism now owns out of `docs/git-and-prs.md` and
      `docs/review-toolkit.md`, leaving in each only what the check cannot
      carry: the branch pair, and the second pull request's base being the
      default branch with the first already merged rather than the first
      branch itself. (Req: change-slicing — The propose stage's reviewable
      unit is the artefact pair)
