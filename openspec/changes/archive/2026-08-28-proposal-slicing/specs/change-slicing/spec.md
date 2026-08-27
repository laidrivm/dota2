# change-slicing — delta spec

## ADDED Requirements

### Requirement: The propose stage's reviewable unit is the artefact pair

A propose-stage branch carries no step, so the remedy that *The reviewable unit
is the step, not the proposal* names has nothing to act on. Its reviewable unit is
one of the two questions a proposal answers: what the change must do, which
`proposal.md` and the delta specs answer, and how it will be built and in what
order, which `design.md` and `tasks.md` answer.

WHEN a propose-stage branch's counted lines reach the failing threshold that
*The budget warns at 500 lines and fails at 800* fixes, the stage SHALL ship as two
pull requests in that order, on `spec/<slug>` and `spec/<slug>-plan`. The
second SHALL open from the updated base after the first merges, so that the
design is read against requirements already on `main` rather than against a
branch. WHERE the four artefacts stay under that threshold, one pull request
SHALL carry all four.

The order is not arbitrary and is not this requirement's to justify: the
feature workflow already reviews the system before the code, and requirements
before a design that argues for them is the same order one stage earlier.

#### Scenario: A proposal that fits

- **WHEN** a change's four artefacts count below the failing threshold
- **THEN** one pull request on `spec/<slug>` SHALL carry all four

#### Scenario: A proposal that does not fit

- **WHEN** a change's four artefacts count at or above the failing threshold
- **THEN** `proposal.md` and the delta specs SHALL ship on `spec/<slug>`, and
  `design.md` and `tasks.md` SHALL ship on `spec/<slug>-plan` afterwards
- **AND** neither pull request SHALL carry an artefact belonging to the other

#### Scenario: The second pull request's base

- **WHEN** `spec/<slug>-plan` is opened
- **THEN** its base SHALL be the default branch with `spec/<slug>` already
  merged into it, not `spec/<slug>` itself

### Requirement: The override does not admit an unsplit propose-stage branch

WHEN a branch's diff adds both `proposal.md` and `tasks.md` for one change, and
its counted lines reach the failing threshold, the budget SHALL fail it whatever
its pull request body carries. An `oversize:` marker SHALL NOT clear that
failure, because the marker admits a diff the project cannot make smaller and
this one it can, along the seam the requirement above names. The gate line SHALL
say which seam, so the failure is answerable without reading the capability.

A branch adding one of the two and not the other is a split half and SHALL be
measured as any other diff, override included.

#### Scenario: An unsplit proposal reaching for the override

- **IF** a branch adds `proposal.md` and `tasks.md` for one change, counts at
  or above the failing threshold, and its body carries `oversize:` with a
  reason
- **THEN** the gate SHALL report `FAIL` and name the split as the remedy

#### Scenario: An unsplit proposal whose marker names no reason

- **IF** a branch adds `proposal.md` and `tasks.md` for one change, counts at
  or above the failing threshold, and its body carries `oversize:` with no text
  after it
- **THEN** the gate SHALL name the split as the remedy rather than report that
  the marker needs a reason, because the reason it would ask for is one this
  requirement refuses to accept

#### Scenario: A split half over budget

- **WHEN** a branch adds `proposal.md` and the delta specs but no `tasks.md`,
  counts at or above the failing threshold, and its body carries `oversize:`
  with a reason
- **THEN** the gate SHALL report the override, as it does for any other diff

#### Scenario: An implementation branch is untouched

- **WHEN** a `feat/<slug>-<step>` branch counts at or above the failing
  threshold and its body carries `oversize:` with a reason
- **THEN** the gate SHALL report the override — the branch adds neither
  artefact, so the propose-stage refusal SHALL NOT reach it

#### Scenario: An archived change is not a new proposal

- **WHEN** a branch's only `proposal.md` and `tasks.md` changes are the move of
  a change into `openspec/changes/archive/`
- **THEN** the propose-stage refusal SHALL NOT apply, no proposal having been
  authored
