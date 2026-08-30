# snapshot-ingest delta — match-harvest

## MODIFIED Requirements

### Requirement: The job carries a run to one outcome

One entry point SHALL run the ingest, then the build, then the export, then
the harvest, and SHALL exit non-zero WHEN any of the four fails, having
reported which. A run that fails before the export SHALL leave the previously
published bundle served, and a run that fails after it SHALL leave the bundle
the export wrote; either way the application never loses the snapshot it had.
Only the harvest can fail after the export, and that it can is why this is
stated as two cases rather than one.

The harvest SHALL run last, after the export, and its failure SHALL NOT
prevent the export or unpublish what the export wrote. Nothing the harvest
stores is served, so an order that let it delay or endanger the bundle would
trade the thing the application needs for the thing only a later measurement
does. It still exits non-zero: a harvest that fails silently is how a step
stops working for a month unnoticed, which is the failure `match-harvest`
exists to end.

The export SHALL also be invocable on its own, rendering the newest published
snapshot whichever run built it, so that an export that failed can be repeated
without paying for the ingest and the build again. That one is named because a
failing export is the case where repeating the whole run buys nothing; the
ingest, the build and the harvest have no such standalone mode in this change,
and one invented here would be an entry point no task tests and no criterion
bounds.

#### Scenario: A run that succeeds

- **WHEN** the ingest, the build, the export and the harvest all succeed
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

#### Scenario: The export invoked on its own

- **WHEN** the export is invoked without the ingest or the build
- **THEN** it SHALL render the newest published snapshot and exit zero, no
  request to the statistics API having been made
