# change-slicing delta specification

## ADDED Requirements

### Requirement: The reviewable unit is the step, not the proposal

WHEN a change's `tasks.md` holds more than one task group, the project SHALL
ship it as a sequence of pull requests, one per group, on `feat/<slug>-<step>`
branches. A change whose `tasks.md` holds exactly one group SHALL ship as a
single `feat/<slug>` pull request.

#### Scenario: A proposal with four task groups

- **WHEN** a change's `tasks.md` contains four `## <n>. <group>` headings
- **THEN** the agent opens four pull requests, each on its own
  `feat/<slug>-<step>` branch, in the order the groups appear
- **AND** it does not open one pull request carrying all four

#### Scenario: A single-group change

- **WHEN** a change's `tasks.md` contains one task group
- **THEN** the whole change ships on one `feat/<slug>` branch

### Requirement: A step closes one to three acceptance criteria

A step SHALL close between one and three acceptance criteria and SHALL leave
the application working when merged. The pull request body SHALL name the
criteria the step closes.

#### Scenario: A step names what it closes

- **WHEN** a step's pull request is opened
- **THEN** its body names the acceptance criteria the step closes, by their
  identifiers in the change's spec

#### Scenario: A step closing more than three criteria

- **WHEN** a proposed step would close four or more acceptance criteria
- **THEN** it is split further before the branch is opened

#### Scenario: An infrastructure step closing none

- **IF** a step closes no acceptance criterion because it is infrastructure
- **THEN** its body says so explicitly, rather than leaving the criteria line
  absent

### Requirement: A seam between steps carries a working stub

WHEN a step depends on a capability a later step delivers, the earlier step
SHALL ship a working temporary substitute at the seam and the later step SHALL
delete it. Merging code that no step exercises is prohibited.

#### Scenario: A board that needs a picker not yet built

- **WHEN** a step delivers a board whose picking flow arrives in a later step
- **THEN** the earlier step ships a native control that performs the pick
- **AND** the later step deletes that control in the same pull request that
  introduces its replacement

#### Scenario: Unreachable code offered as a seam

- **WHEN** a step adds a module no shipped code path calls
- **THEN** the step is rejected as a horizontal slice, not accepted as a seam

### Requirement: The diff budget is measured over a defined set of lines

The project SHALL provide a script that counts changed lines in
`<base>...HEAD` and excludes only artefacts no reviewer reads: `bun.lock`,
`*.woff2`, `src/fixtures/snapshot.json`, and the paired removal and addition
of one task-list line that differ solely in the checkbox state. Newly authored
task lines SHALL be counted. Tests SHALL be counted in the total.

#### Scenario: A lockfile-heavy branch

- **WHEN** a branch changes 40 source lines and 900 lines of `bun.lock`
- **THEN** the script reports 40 changed lines

#### Scenario: A branch that only ticks task boxes

- **WHEN** a branch's only diff is `- [ ]` lines becoming `- [x]`
- **THEN** the script reports 0 changed lines

#### Scenario: A proposal that authors new task lines

- **WHEN** a branch adds 60 `- [ ] <task>` lines to a new `tasks.md` and
  removes nothing
- **THEN** the script reports 60 changed lines — the exclusion covers a
  checkbox changing state, not task text arriving

#### Scenario: A test-heavy branch

- **WHEN** a branch changes 340 source lines and 610 test lines
- **THEN** the script reports 950 changed lines, and the source/test split
  beside the total

### Requirement: The budget warns at 500 lines and fails at 800

The script SHALL exit 0 below 500 counted lines, exit 0 with a warning from
500 to 799, and exit non-zero at 800 or above. It SHALL print one gate line
carrying the verdict, the total, and the source/test split. The split SHALL
NOT affect the verdict.

#### Scenario: A branch under the warning threshold

- **WHEN** the count is 340
- **THEN** the script prints `DIFF gate: PASS — 340 lines (280 source / 60
  test)` and exits 0

#### Scenario: A branch between the thresholds

- **WHEN** the count is 610
- **THEN** the script prints a `WARN` gate line naming both thresholds and
  exits 0

#### Scenario: A branch over the failing threshold

- **WHEN** the count is 950
- **THEN** the script prints a `FAIL` gate line and exits non-zero

### Requirement: An over-budget pull request is admitted only with a named reason

WHEN a pull request exceeds 800 counted lines, CI SHALL fail unless the pull
request body contains a line beginning `oversize:` followed by a reason. A
body carrying `oversize:` with no text after it SHALL NOT clear the failure.

#### Scenario: A mechanical rename

- **WHEN** a 1200-line pull request's body contains `oversize: mechanical
  rename of `computeModel` across 14 files`
- **THEN** CI reports the override, names the reason in the gate line, and
  passes

#### Scenario: An empty marker

- **WHEN** the body contains `oversize:` and nothing after it
- **THEN** CI fails and states that the marker needs a reason

### Requirement: The gate is hard in CI and soft before the push

CI SHALL run the budget against the pull request's base branch and fail the
check when the budget is exceeded without an override. The pre-push hook SHALL
run the same script and SHALL NOT block the push.

#### Scenario: An over-budget push

- **WHEN** the agent pushes a branch at 950 counted lines
- **THEN** the pre-push hook prints the `FAIL` gate line and the push proceeds
- **AND** the CI check on the resulting pull request fails

#### Scenario: A branch with no upstream base

- **IF** the base branch is unavailable locally
- **THEN** the pre-push hook reports that it could not measure and exits 0
