# snapshot-ingest delta — laning-phase-model

## ADDED Requirements

### Requirement: Lane outcomes are pulled per hero and position

The ingest SHALL read each hero's lane-opponent rows from
`heroStats.laneOutcome` with `isWith: false`, one request per hero, position
and week, and SHALL sum them over twelve complete weeks.

The cells asked for SHALL be those where the hero's stored position share is
at least 5%, never every hero at every position: 300 of the reference's 635
cells clear it, and the rest are configurations nobody plays — a hero at a
position it takes 2% of the time returns rows of two and three games.

`positionIds` filters the **hero's own** position rather than the opponent's,
and passing several does not aggregate them: a request naming all five
answers with the hero's dominant position alone. So a cell is a request, and
the pull multiplies where *Pair statistics are pulled per hero over at most
four weeks* does not.

The window SHALL be twelve weeks rather than that requirement's four, and
SHALL be bounded by the **major** patch rather than by the current patch.
A lane delta does not drift over that span: measured on Nyx Assassin at
position 3, weeks 7–12 against weeks 1–6 over the 69 pairs carrying 60 games
in each half, the two halves correlate `+0.801` with a mean absolute
difference of 3.4 pp — across a window containing the 7.41e release. Four
weeks would leave a median pair at 85 games where twelve leaves it at 244.

A run SHALL pace this pull through the same quota reading every other pull
uses. It does not fit inside one hourly window and does not need to: 3 600
requests join the run's existing ~516, against an hourly ceiling of 1 500 and
a daily one of 15 000, and *A run stays inside the quota the API states* has
a run wait for a refilling window and continue rather than fail. The cost is
about three hours of wall clock on a job the schedule already stops from
overlapping itself.

#### Scenario: One request per cell, not per hero

- **WHEN** the lane pull runs for a hero holding two positions above the
  share floor
- **THEN** it SHALL issue one request per position per week, and SHALL NOT
  ask for both positions in one request

#### Scenario: A position below the share floor

- **IF** a hero's stored share at a position is below 5%
- **THEN** no lane request SHALL be issued for that cell, and the run SHALL
  record the count of cells it covered

#### Scenario: A window longer than the hourly ceiling admits

- **WHEN** the pull's requests exceed what remains in the hourly window
- **THEN** the run SHALL wait for that window to turn and continue, and
  SHALL NOT end failed — the daily window being the only one it cannot
  outwait

#### Scenario: A major patch younger than the window

- **WHEN** the current major patch has been live for six complete weeks
- **THEN** exactly six weeks SHALL be requested per cell, and no week
  preceding that patch SHALL be requested

#### Scenario: A letter patch inside the window

- **WHEN** a letter patch was released inside the twelve weeks
- **THEN** the weeks preceding it SHALL still be requested, the window being
  bounded by the major patch alone
