# snapshot-schedule — delta spec

## ADDED Requirements

### Requirement: The job runs on a schedule outside the application

The job SHALL be started by the host's own scheduler once a day, as a
container run for that invocation and removed when it ends — never as a
service kept up. `src/job/run.ts` owns no schedule by design, returns a report
and turns it into an exit code, and a process that exits is not a service.

The schedule SHALL live on the host rather than inside the compose project,
so that the deployment and the schedule can be changed without restarting the
application. The compose file names the job as a service so it can be invoked
with the same image, environment and mounts the application has, and the
scheduler is what invokes it.

#### Scenario: The job is not kept running

- **WHEN** the compose project is brought up
- **THEN** the job SHALL NOT be started, and no job container SHALL be left
  running

#### Scenario: A scheduled invocation

- **WHEN** the scheduled time arrives and no run is in flight
- **THEN** one job container SHALL run to completion and be removed

### Requirement: Every invocation leaves a record of when it ran and how it ended

Each invocation SHALL append to a file on the host the instant it started and
the exit status it ended with, with anything the job wrote between the two.

All three parts are load-bearing and none substitutes for another. The report
alone answers *why* a run failed — `run.ts` composes one line naming the step
— but it says nothing when a run succeeds, so a file holding only reports
cannot distinguish a healthy schedule from a scheduler that never fired. The
start instant is what answers *whether* it ran. The exit status is what
separates the outcomes that produce no report at all.

This file is the whole of the record, and deliberately: this change ships no
alert, so nothing carries a run's outcome anywhere on its own. Giving the
record a reader belongs to the change that adds error tracking.

#### Scenario: A run that fails

- **WHEN** a run fails at one of its steps
- **THEN** the file SHALL hold, for that invocation, the instant it started,
  the report naming the step and the reason, and a non-zero status

#### Scenario: A run that succeeds

- **WHEN** a run completes with every step done
- **THEN** the file SHALL hold the instant it started and a zero status — so
  that a schedule which is working and a scheduler which never fired are
  distinguishable without reading anything else

### Requirement: A second run cannot start while one is in flight

An invocation arriving while another is still running SHALL be refused
without starting a second job container, and SHALL end with status `99`, so
the record separates *refused* from *failed*.

`99` rather than an adjective, and `99` rather than any small number:
`src/job/run.ts` exits `0` when every step completed and `1` for every report
it returns, and those two are the whole of what the job emits — so a refusal
carrying either is a refusal the record cannot tell from a run. The exclusion
mechanism's own default for a conflict is `1`, which is the collision this
value exists to avoid.

The refusal is what closes a hole the build cannot close for itself.
`buildSnapshot` reads the newest published snapshot's hero count before the
transaction that settles its own status, and Postgres runs READ COMMITTED
here, so two runs in flight together validate against the same older count:
the larger publishes first, and the smaller then publishes against a count
nothing holds any more. Every reader — the export, and the next patch's blend
— takes the newest published snapshot, so what they read afterwards is the
smaller one. `publishBundle` has the same exposure from the other side, two
runs writing one temporary name.

The refusal SHALL be demonstrated by starting a run that is still going and
invoking the schedule's own entry against it, observing that no second
container started. It SHALL NOT be argued from the interval between runs: an
interval says how often invocations begin, never how long one lasts, and the
run this protects against is precisely the one that ran longer than expected.

#### Scenario: An invocation arriving while a run is in flight

- **WHEN** a run is still executing and the schedule's entry is invoked again
- **THEN** no second job container SHALL start, the running one SHALL be
  unaffected, and the record SHALL carry status `99`

#### Scenario: The refusal is distinguishable from a failure

- **WHEN** the record is read for an invocation that was refused
- **THEN** its status SHALL be `99`, which is neither the `0` a completed run
  produces nor the `1` every failing one does

#### Scenario: The lock after the run ends

- **WHEN** a run completes and the schedule's entry is invoked afterwards
- **THEN** it SHALL run normally, the exclusion applying only while a run is
  actually in flight

#### Scenario: A run that dies without tidying up

- **IF** a run is killed without being allowed to clean up
- **THEN** the next invocation SHALL still start — the exclusion is held for
  the lifetime of the process and released by the operating system however
  that process ended, never by anything the job does on its way out
