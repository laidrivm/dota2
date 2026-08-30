# snapshot-ingest delta — lane-synergy-model

**Written against the version `laning-phase-model` leaves behind.** That
change creates the requirement below; there is no version of it on `main`.

One of its scenarios is **renamed** rather than dropped, because the
behaviour widens: `One request per cell, not per hero` becomes `One request
per cell and side`. The identifier changes with the heading, so a test citing
the old one stops resolving and is re-pointed by the step that lands this.

## MODIFIED Requirements

### Requirement: Lane outcomes are pulled per hero and position

The ingest SHALL read each hero's lane rows from `heroStats.laneOutcome`, one
request per hero, position, week **and side of the lane** — `isWith: false`
for the opponents it stands against and `isWith: true` for the ally it stands
beside — and SHALL sum each over twelve complete weeks.

The cells asked for SHALL be those where the hero's stored position share is
at least 5%, never every hero at every position: 300 of the reference's 635
cells clear it, and the rest are configurations nobody plays — a hero at a
position it takes 2% of the time returns rows of two and three games.

`positionIds` filters the **hero's own** position rather than the other
hero's, and passing several does not aggregate them: a request naming all
five answers with the hero's dominant position alone. So a cell and a side
together are a request, and the pull multiplies twice where *Pair statistics
are pulled per hero over at most four weeks* does not multiply at all.

The `week` argument SHALL be a Unix timestamp in seconds taken from **inside**
the bucket, and from its middle, exactly as `pairs.ts` already computes one:
a bucket id returns nothing at all — measured, `week: 2956` answered with zero
rows where a timestamp inside that week answered with 126 — and the buckets
turn on an hour nobody here knows.

The window SHALL be twelve weeks rather than that requirement's four, and
SHALL be bounded by the **major** patch rather than by the current letter
patch. A lane delta does not drift over that span: measured on Nyx Assassin
at position 3, weeks 7–12 against weeks 1–6 over the 69 pairs carrying 60
games in each half, the two halves correlate `+0.801` with a mean absolute
difference of 3.4 pp — across a window containing the 7.41e release.

A run SHALL pace both pulls through the same quota reading every other pull
uses. Together they do not fit inside one hourly window and do not need to:
7 200 requests join the run's existing ~516, against an hourly ceiling of
1 500 and a daily one of 15 000, and *A run stays inside the quota the API
states* has a run wait for a refilling window and continue rather than fail.
The cost is about six hours of wall clock on a job the schedule already stops
from overlapping itself.

The ally pull SHALL be issued after the opponent pull rather than interleaved
with it, so that a run cut short by the daily window leaves one statistic
whole rather than both half-covered — and *An unmeasured component is zero
for every hero* is what then decides whether the half-covered one publishes.

#### Scenario: One request per cell and side

- **WHEN** the lane pull runs for a hero holding two positions above the
  share floor
- **THEN** it SHALL issue four requests per week — two positions by two
  sides — and SHALL NOT ask for both sides in one request

#### Scenario: A position below the share floor

- **IF** a hero's stored share at a position is below 5%
- **THEN** no lane request SHALL be issued for that cell on either side, and
  the run SHALL record the count of cells it covered

#### Scenario: A window longer than the hourly ceiling admits

- **WHEN** the pull's requests exceed what remains in the hourly window
- **THEN** the run SHALL wait for that window to turn and continue, and
  SHALL NOT end failed — the daily window being the only one it cannot
  outwait

#### Scenario: A major patch younger than the window

- **WHEN** the current major patch has been live for six complete weeks
- **THEN** exactly six weeks SHALL be requested per cell and side, and no
  week preceding that patch SHALL be requested

#### Scenario: A letter patch inside the window

- **WHEN** a letter patch was released inside the twelve weeks
- **THEN** the weeks preceding it SHALL still be requested, the window being
  bounded by the major patch alone

#### Scenario: A run that runs out of quota part way

- **IF** the daily window empties after the opponent pull and before the ally
  pull completes
- **THEN** the opponent statistic SHALL be whole and the ally one SHALL be
  left as staging holds it, rather than both being partial
