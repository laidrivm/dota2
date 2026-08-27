# proposal-slicing — design

## Context

`scripts/diff-budget.sh` counts a propose-stage branch like any other and says
so in a comment. `change-slicing` tells an over-budget branch to cut its step,
which a propose-stage branch does not have. The gap between those two has been
crossed once by hand — PRs #130 and #132 — and once badly, by PR #141.

## Goals / Non-Goals

**Goals:**

- Name the seam a large proposal is cut along, in the capability that owns
  slicing.
- Make the wrong answer unavailable rather than discouraged, since the wrong
  answer is one line in a pull request body and the right one is two branches.

**Non-Goals:**

- Everything the proposal lists under *Non-goals* — no exemption, no threshold
  move, no stacked branches, no change to how a save point rides a branch.

## Decisions

### The seam is what the artefacts already are, not a line count

`proposal.md` plus the delta specs answer what the change must do; `design.md`
plus `tasks.md` answer how and in what order. Cutting there gives two pull
requests that each stand alone, and it is the cut #130 and #132 made before
anything told them to.

*Alternative considered*: splitting by capability, one pull request per delta
spec. A design and a task list that span two capabilities would then have no
home, and a change with one capability would not split at all.

### Detection is what the branch adds, not what it is called

The check asks whether the diff adds `proposal.md` and `tasks.md` for one
change. A branch name is a convention the check cannot rely on — `spec/` is
this repository's, not OpenSpec's — and a rename would silently retire the
refusal.

Two details the implementation must get right, both of them ways the pathspec
could match more than intended. The glob has to stop at a path separator, or
`openspec/changes/*/proposal.md` also matches an archived change three levels
down; and the filter has to be additions, so that `/opsx:archive` moving a
change reads as the move it is.

### The check refuses rather than exempts

The override stays available to a propose-stage branch that has been split and
is still over budget — a genuinely large half is a diff the project has already
made as small as its seam allows. What is refused is the unsplit one. This is
narrower than exempting `openspec/**` from the count, and it keeps the number
printed either way.

### The gate line names the remedy

A `FAIL` that only says "over 800" sends the reader to the capability. This one
says which two pull requests to open, because the reader is holding the branch
that needs splitting and the answer is three words long.

### One doc loses a line, the other gains one

`docs/review-toolkit.md` tells an over-budget branch to cut the step or reach
for the override. A propose-stage branch has no step to cut, and this change
takes the override away from it, so the sentence would state a remedy the
check refuses — `agent-rulebook` requires the prose to go when a mechanism
arrives, and this is a mechanism arriving over it.

`docs/git-and-prs.md` moves the other way. It says a proposal ships on
`spec/<proposal-slug>`, which is now half a rule: the second branch and the
base it opens from are what the check cannot dictate — the gate line can name
the seam, but nothing enforces the name or the base — so that is prose the
mechanism does not displace, and the line has to grow rather than shrink.

The asymmetry is the point. A mechanism displaces prose only where it enforces
the same thing; where it merely reports, the prose is still the only rule
there is.

### Tests: the script's existing fixture, extended

`scripts/diff-budget.fixture.ts` already builds throwaway repositories and runs
the gate against them, and `diff-budget-gate.test.ts` already covers the
override's own cases. The propose-stage cases join it: an unsplit proposal with
a marker, one whose marker names no reason, a split half with a marker, an
implementation branch with a marker, and an archive move.

The reasonless marker is the case where the two refusals meet. The override
already refuses a marker with no reason and tells the author to name one; this
change refuses an unsplit proposal whatever its marker says. Reporting the
older message would send the author to write a reason that changes nothing, so
the propose-stage remedy is the one that prints.

## Risks / Trade-offs

- **A branch already over the threshold begins to fail the moment the check
  lands** → nothing open is in that state; #141 was the one that would have
  been, and it was split by hand into #141 and #142 along this seam before the
  check existed. A future one merges before this change's task group, or it
  splits.
- **A proposal that genuinely wants all four artefacts in one pull request has
  no way out** → that is the point, and the escape is the seam rather than a
  marker. If a case appears where the seam is wrong, it is a case against the
  requirement, and the requirement is where it should be argued.
- **The detection is a pathspec, and a pathspec is a guess about layout** →
  OpenSpec resolves the change root through `.openspec.yaml`, so a store
  configured elsewhere would not match. This repository is repo-local and the
  check is a repository check; a store would need the change anyway.

## Open Questions

- Whether the same refusal should reach a `feat/` branch carrying more than one
  task group. That is the existing step requirement, unmechanised, and
  mechanising it needs a way to tell which group a diff belongs to that nothing
  here supplies.
