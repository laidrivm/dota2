# snapshot-ingest delta — outcome-calibration

Copied from the version `match-harvest` leaves behind, not from `main`. That
change adds the fourth step and this one adds the fifth, so this delta cannot
be synced before it.

## MODIFIED Requirements

### Requirement: The job carries a run to one outcome

One entry point SHALL run the ingest, then the build, then the export, then
the harvest, then the scorer, and SHALL exit non-zero WHEN any of the five
fails, having reported which. A run that fails before the export SHALL leave
the previously published bundle served, and a run that fails after it SHALL
leave the bundle the export wrote; either way the application never loses the
snapshot it had. Only the harvest and the scorer can fail after the export,
and that they can is why this is stated as two cases rather than one.

The harvest and the scorer SHALL run after the export, and neither failing
SHALL prevent the export or unpublish what the export wrote. Nothing either
stores is served, so an order that let them delay or endanger the bundle
would trade the thing the application needs for the thing only a later
measurement does. Both still exit non-zero: a step that fails silently is how
a step stops working for a month unnoticed, which is the failure
`match-harvest` exists to end.

The scorer SHALL run after the harvest rather than before it, so that a run's
figures are computed over the matches that run collected rather than over the
store as it stood the night before.

The export and the scorer SHALL each also be invocable on their own. The
export is, so that one that failed can be repeated without paying for the
ingest and the build again. The scorer is for a different reason and a
stronger one: it issues no request to the statistics API at all, so repeating
it costs nothing that has to be paced, which is what lets a calibration
variant be tried against the same matches without waiting a day. The ingest,
the build and the harvest have no such standalone mode in this change, and
one invented here would be an entry point no task tests and no criterion
bounds.

#### Scenario: A run that succeeds

- **WHEN** the ingest, the build, the export, the harvest and the scorer all
  succeed
- **THEN** the entry point SHALL exit zero and the served bundle SHALL be the
  one the export just wrote

#### Scenario: An ingest that fails

- **IF** the ingest fails
- **THEN** no snapshot SHALL be built, the served bundle SHALL be the one
  served before the run, and the entry point SHALL exit non-zero

#### Scenario: A build that fails

- **IF** the build ends at `status = 'failed'`
- **THEN** the export SHALL NOT run, and the entry point SHALL exit non-zero

#### Scenario: An export that fails

- **IF** the export fails
- **THEN** it SHALL have written no bundle, the served bundle SHALL be the one
  served before the run, and the entry point SHALL exit non-zero

#### Scenario: A harvest that fails

- **IF** the harvest fails
- **THEN** the bundle the export wrote SHALL still be served, the entry point
  SHALL exit non-zero, and the report SHALL name the harvest as what failed
- **AND** the scorer SHALL NOT run, its figures otherwise covering a store the
  run failed to fill

#### Scenario: A scorer that fails

- **IF** the scorer fails
- **THEN** the bundle the export wrote SHALL still be served, the harvest's
  own work SHALL stand, the entry point SHALL exit non-zero, and the report
  SHALL name the scorer as what failed

#### Scenario: The export invoked on its own

- **WHEN** the export is invoked without the ingest or the build
- **THEN** it SHALL render the newest published snapshot and exit zero, no
  request to the statistics API having been made
