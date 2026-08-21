# proposal-slicing

## Why

`change-slicing` puts the remedy for an over-budget diff at propose time, in
the size of a step — and a propose-stage branch carries no step, so the remedy
has nothing to act on there. The gate still measures it, deliberately:
`scripts/diff-budget.sh` counts `openspec/**` because "a proposal too large to
read is the case this gate exists for". What the capability never says is what
a propose-stage branch does when it is that case.

In practice the answer was found once and never written down. `snapshot-build`
is the largest proposal this repository holds at 986 artefact lines, and it
shipped as two pull requests: #130 `spec/snapshot-build` carrying
`proposal.md` and the two delta specs, then #132 `spec/snapshot-build-plan`
carrying `design.md` and `tasks.md`. Both passed the budget.

Thirteen propose-stage pull requests have been opened here and every one of
them passed, none carrying an override — until #141, which put all four
artefacts of an 834-line proposal in one pull request and reached for
`oversize:` rather than for the seam #130 and #132 had already cut. Nothing
stopped it, because nothing describes the seam and nothing checks for it.

## What Changes

- The propose stage gets a reviewable unit of its own, named where the step is
  named: not a step, but one of the two questions a proposal answers — what the
  change must do, and how it will be built and in what order. Over the failing
  threshold, those ship as two pull requests, on the branch pair #130 and #132
  already used.
- The budget stops accepting an `oversize:` marker on a propose-stage branch
  that has not been split, because there the diff is one the project can make
  smaller, and the marker exists for one it cannot.
- The prose that would otherwise state the same rule twice stays out of
  `docs/git-and-prs.md` and `docs/review-toolkit.md`, each losing the line the
  check now owns — `agent-rulebook`'s rule for a prohibition that becomes a
  mechanism.

The thresholds are untouched, and so is what the script counts. The measurable
form of the new behaviour is in the delta spec, and stated there only.

## Non-goals

- Exempting `openspec/**` from the count. The script excludes only artefacts no
  reviewer reads, and a proposal is the opposite of that.
- Moving either threshold. The gate has failed exactly one propose-stage branch
  in thirteen, and that one had a seam it did not use.
- Stacked branches. The second pull request opens from the updated base after
  the first merges, which is what #130 and #132 did.
- Splitting a proposal that fits. Under the threshold one pull request still
  carries all four artefacts, as eleven of the thirteen did.
- Any change to how a save point or a `PLAN.md` update rides a branch.
  `docs/git-and-prs.md` already fixes that and this change does not reopen it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-slicing`: gains what a propose-stage branch does when its artefacts
  reach the failing threshold, and what the override may no longer admit.

## Impact

- `scripts/diff-budget.sh` gains the propose-stage detection and one refusal
  path; its test files gain the cases for both.
- `docs/git-and-prs.md` and `docs/review-toolkit.md` each lose a line to the
  mechanism.
- One open branch is affected the moment the check lands: `spec/snapshot-ingest`
  (PR #141) carries an override on an unsplit proposal and would begin to fail.
  It merges before this change's task group, or it splits.
