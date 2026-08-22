# snapshot-ingest — delta spec

## ADDED Requirements

### Requirement: Every request carries both halves of the gate

The client SHALL send `Authorization: Bearer <key>` and
`User-Agent: STRATZ_API` on every request to the statistics API, the key read
from the `STRATZ_API_KEY` environment variable. WHERE that variable is absent
or empty the run SHALL fail before its first request, naming the variable.

#### Scenario: No key configured

- **IF** `STRATZ_API_KEY` is unset or empty when the run starts
- **THEN** the run SHALL fail naming that variable, and SHALL issue no request

#### Scenario: Both headers on every request

- **WHEN** any request to the statistics API is issued
- **THEN** it SHALL carry both the `Authorization` and the `User-Agent` header

### Requirement: A response is classified by its body, not its status alone

The client SHALL decide what a response means from its `content-type` and its
body as well as its status. A `403` whose `content-type` is not JSON SHALL be
reported as an unmet challenge naming the `User-Agent`, never as a rejected
key: the gate answers a request missing the header with the same status as one
carrying a bad token, and the body is the only thing that distinguishes them
(`docs/context/stratz-probe-2026-08.md`). A `200` whose GraphQL body carries a
non-empty `errors` array SHALL be a failure and SHALL NOT be read as an empty
result — GraphQL reports a rejected query at `200`, so a status-only reading
would write empty staging rows and call the run a success.

#### Scenario: The challenge, not the key

- **WHEN** a request is answered `403` with `content-type: text/html`
- **THEN** the reported failure SHALL name the `User-Agent` header and SHALL
  NOT describe the key as rejected

#### Scenario: The key, not the challenge

- **WHEN** a request is answered `403` with a JSON body
- **THEN** the reported failure SHALL describe the key as rejected

#### Scenario: Errors under a success status

- **IF** a request is answered `200` with a body carrying a non-empty `errors`
  array
- **THEN** the run SHALL fail reporting those errors, and no staging row SHALL
  be written from that response

### Requirement: A run stays inside the quota the API states

The client SHALL issue no request while eight have already been issued in the
preceding second. WHEN a response reports zero remaining in any of its
rate-limit windows the run SHALL stop without issuing a further request and end
failed, rather than continuing into a refusal. That verdict is terminal and
SHALL take precedence over *A request is retried only where retrying can
succeed*: a `429` reporting zero remaining SHALL NOT be retried, because the
retry answers a request the service might yet accept and this one it will not
until the window turns.

The ceilings are the API's own, carried on every response, and are read from
there rather than configured — a number this specification restated would drift
from the one the service enforces.

#### Scenario: The ninth request in a second

- **WHEN** eight requests have been issued within the preceding second and a
  ninth is due
- **THEN** the ninth SHALL NOT be issued until a second has elapsed since the
  first of those eight

#### Scenario: A window reports nothing remaining

- **IF** a response reports zero remaining in any rate-limit window
- **THEN** the run SHALL end failed, and no further request SHALL be issued

#### Scenario: A rate-limited response with nothing remaining

- **IF** a request is answered `429` and that response reports zero remaining
  in any rate-limit window
- **THEN** exactly one attempt SHALL have been made, and the run SHALL end
  failed

### Requirement: A request is retried only where retrying can succeed

Every attempt SHALL be abandoned after 30 seconds without a complete response,
and an abandoned attempt SHALL be retried on the same terms as a `5xx`. Nothing
else in this change bounds how long a request may take, and an unbounded one is
worse than a failing one: the job's single outcome is reached by the entry point
returning, and a connection that never completes never lets it.

A request answered `429` or any `5xx`, or abandoned at that timeout, SHALL be
retried up to four attempts in total, the delay before each retry twice the one
before it and the first one second. A request answered any other `4xx` SHALL NOT
be retried, its status being a statement about the request rather than about the
service. A request still failing on the fourth attempt SHALL end the run failed.
*A run stays inside the quota the API states* removes from this rule the one
`429` that carries no remaining quota.

#### Scenario: A transient failure

- **WHEN** a request is answered `500` once and `200` on the retry
- **THEN** the call SHALL return the second response's body, and the run SHALL
  continue

#### Scenario: A rejected request

- **IF** a request is answered `400`
- **THEN** exactly one attempt SHALL have been made

#### Scenario: A request that never completes

- **IF** a request has been open for 30 seconds with no complete response
- **THEN** that attempt SHALL be abandoned and retried, and the run SHALL NOT
  wait on it further

#### Scenario: A stall that does not clear

- **IF** all four attempts are abandoned at the timeout
- **THEN** the run SHALL end failed, and the entry point SHALL still reach its
  exit

#### Scenario: A failure that does not clear

- **IF** every one of four attempts is answered `429` with quota remaining
- **THEN** the run SHALL end failed after the fourth, and no fifth SHALL be
  issued

### Requirement: The meta is pulled by day over the current patch's life

The ingest SHALL read hero match and win counts by day and by position,
filtered to the ranked All Pick game mode and to the Divine and Immortal
brackets, and SHALL sum those days into one staging row per hero and position.

The window SHALL be measured on the UTC timeline and SHALL be end-exclusive: it
holds every day that both begins at or after the current patch's `detected_at`
and ends at or before the run instant, so a day still in progress is never
half-counted. The basis has to be stated because a local reading of either
instant shifts the window by a day, and the source's own day key is UTC.

The window SHALL be the **lesser of that span and the thirty most recent
complete UTC days**, and the run SHALL record when the cap bound it. Thirty is
the source's limit and not this change's choice: the endpoint returns thirty
days whatever page size is asked for, and its skip argument returns nothing at
all, so no thirty-first day is reachable through it. The cap is tolerable
because thirty days at these brackets carry several million matches, orders
above the sufficiency thresholds `snapshot-build` fixes, and because the days a
cap discards are the oldest ones — the least representative of a current meta.
It is stated here rather than left in the design so that an implementation
cannot silently report a 150-day patch as fully covered.

WHERE that window holds no day the window SHALL be the single most recent
complete UTC day, so that a patch detected today yields a sample rather than
none — those matches were played under the previous patch, and carrying them is
a deliberate approximation that the next day's pull dilutes and the
`stabilizing` flag `snapshot-export` renders already warns about.

The game-mode filter is why this statistic is read by day rather than by week:
the weekly endpoint offers no such argument, so every number it returns pools
the modes the product does not model.

#### Scenario: A patch a week old

- **WHEN** the current patch's `detected_at` is seven whole UTC days before the
  run instant
- **THEN** the request SHALL ask for those seven days, and each staging row
  SHALL hold the sum of that hero and position over them

#### Scenario: The day in progress

- **WHEN** the run instant falls midway through a UTC day
- **THEN** that day SHALL NOT be part of the window

#### Scenario: A patch older than the source will serve

- **WHEN** the current patch's `detected_at` is 150 whole UTC days before the
  run instant
- **THEN** the request SHALL ask for thirty days, and the run SHALL record that
  the window was bound by the source rather than by the patch

#### Scenario: A patch detected today

- **WHEN** no complete UTC day lies between the current patch's `detected_at`
  and the run instant
- **THEN** the window SHALL be the single most recent complete UTC day, and
  staging SHALL hold rows

#### Scenario: The modes the product does not model

- **WHEN** the meta pull is issued
- **THEN** it SHALL name the ranked All Pick game mode, and a response covering
  every mode SHALL NOT be accepted in its place

#### Scenario: The brackets the product models

- **WHEN** the meta pull is issued
- **THEN** it SHALL name the Divine and Immortal brackets

### Requirement: Pair statistics are pulled per hero over at most four weeks

The ingest SHALL read each hero's opponent and ally rows from the pair
endpoint, asking for every other hero rather than the endpoint's default page,
and SHALL sum them over the lesser of four and the number of complete weeks the
current patch has been live — never over a week that precedes the patch. Four
is a cap this change sets, not the source's: the endpoint's only time dimension
is a week and it takes one hero at a time, so a run covering a whole patch
would issue one request per hero per week, exceeding the hourly ceiling on a
patch older than about eleven weeks. Four weeks is the cap because it puts a
typical pair's sample at several times the smoothing constant `snapshot-build`
fixes for a pair statistic — which this requirement therefore does not restate
— leaving most of the raw delta standing rather than pulled towards neutral.

A week SHALL be attributed to the patch in force on its last day. Its span may
cross a patch release, and no argument the endpoint offers can split it.

#### Scenario: Every opponent, not the default page

- **WHEN** a hero's pair rows are requested
- **THEN** the response SHALL carry one opponent row and one ally row for every
  other hero the reference tables hold

#### Scenario: A patch older than the cap

- **WHEN** the current patch has been live for twelve complete weeks
- **THEN** exactly four weeks SHALL be requested per hero, and the run SHALL
  record which weeks it covered

#### Scenario: A patch younger than the cap

- **WHEN** the current patch has been live for two complete weeks
- **THEN** exactly two weeks SHALL be requested per hero, and no week
  preceding the patch SHALL be requested

#### Scenario: A week that crosses a release

- **WHEN** a week's span contains the current patch's `detected_at`
- **THEN** that week SHALL be attributed to the current patch, its last day
  falling under it

### Requirement: Contest rate is a share of the window's matches

For each hero the ingest SHALL store `(picks + bans) / matches`, where `picks`
is that hero's match count over the meta window, `bans` is its ban count over
the same days, and `matches` is the sum of every hero's match count over that
window divided by ten.

`bans` comes from a request of its own — the pick counts carry no ban dimension
— and that request SHALL cover the same days as the meta window and SHALL be
one request asking for every hero rather than one request per hero. IF it
fails, the run SHALL fail: a contest rate stored from picks alone is not the
quantity this requirement defines, and it would be indistinguishable afterwards
from one whose heroes were simply never banned. A hero the response omits SHALL
be read as zero bans: silence from a count endpoint is a zero, and whether this
one omits never-banned heroes at all is unmeasured — so failing the run on a
short response would fail it on any window in which some hero simply went
unbanned. The divisor is exact: an All Pick match holds ten
distinct heroes, so every match contributes exactly ten to that sum.

The **ratio** is nonetheless a heuristic, and SHALL be documented as one rather
than as a measurement. Picks and the divisor come from one endpoint; bans come
from another, which takes the coarse bracket enum and offers no game-mode
filter at all. The two therefore describe different match populations. By how
much is **not known**: the factor of about 2.1 the probe records was measured
between two other endpoints, and nothing has compared this pair. Neither is it
known whether the difference falls alike on every hero, which a ranking would
need. So the quotient orders heroes by contest and is not an absolute share,
and a later change that measures the pair may narrow that or widen it.

IF the window's matches are 0, every hero's contest rate SHALL be 0 and no
division SHALL be attempted.

#### Scenario: A hero picked in every match

- **WHEN** every hero's match counts over the window sum to ten times the
  number of matches, and one hero's own count equals that number with no bans
- **THEN** that hero's contest rate SHALL be 1

#### Scenario: Bans count towards contest

- **WHEN** two heroes have equal pick counts and one has bans and the other
  none
- **THEN** the one with bans SHALL have the higher contest rate

#### Scenario: The ban request's window

- **WHEN** the ban counts are requested
- **THEN** the days asked for SHALL be the days of the meta window, and one
  request SHALL ask for every hero

#### Scenario: A hero absent from the ban response

- **IF** the ban response carries no row for a hero the meta window holds
- **THEN** that hero's `bans` SHALL be 0 and the run SHALL continue

#### Scenario: Bans cannot be read

- **IF** the ban request fails after its retries
- **THEN** the run SHALL fail, and no contest rate SHALL be stored from picks
  alone

#### Scenario: A window with no matches

- **IF** every hero's match count over the window is 0
- **THEN** every hero's contest rate SHALL be 0, and no division SHALL be
  attempted

### Requirement: A run leaves staging whole or leaves it untouched

The ingest SHALL take the run instant as an argument rather than reading a
clock, so that the windows derived from it are fixed for the run and a repeat
over the same argument selects the same days and weeks. It SHALL replace the
current patch's staging rows rather than adding to them, and SHALL write every
row of a run inside one transaction. IF a run fails at any point before that
transaction commits, staging SHALL hold exactly the rows it held before the run
started. Two runs over unchanged source data **and the same run instant** SHALL
therefore leave identical staging rows; two runs whose instants fall either
side of a UTC day boundary SHALL NOT, the window itself having moved.

Replacing rather than accumulating is what removes the need for a ledger of
what has been pulled: the windows are a function of the patch and that
argument, so a re-run recomputes them rather than resuming a partial one.

This guarantee reaches staging and nothing else. The reference upserts and the
mirrored images are outside this transaction and are not undone by a failure
after them — `hero-reference` states what each leaves behind instead.

#### Scenario: Two runs over unchanged data

- **WHEN** the ingest runs twice with the same run instant against a source
  returning identical responses
- **THEN** staging SHALL hold the same rows with the same counts after the
  second run as after the first

#### Scenario: Two runs a day apart

- **WHEN** two runs' instants fall either side of a UTC day boundary
- **THEN** the second run's window SHALL hold a day the first's did not, and
  the rows SHALL differ

#### Scenario: A run that fails part-way

- **IF** the pair pull fails after the meta pull has produced its rows
- **THEN** staging SHALL hold the rows it held before the run started

#### Scenario: Rows from an older patch

- **WHEN** a run writes staging for a patch newer than the one staging holds
- **THEN** rows older than the previous patch SHALL be gone

### Requirement: The job carries a run to one outcome

One entry point SHALL run the ingest, then the build, then the export, and
SHALL exit non-zero WHEN any of the three fails, having reported which. A
failed run SHALL leave the previously published bundle served, so the
application never loses the snapshot it had.

The export SHALL also be invocable on its own, rendering the newest published
snapshot whichever run built it, so that an export that failed can be repeated
without paying for the ingest and the build again. That one is named because a
failing export is the case where repeating the whole run buys nothing; the
ingest and the build have no such standalone mode in this change, and one
invented here would be an entry point no task tests and no criterion bounds.

#### Scenario: A run that succeeds

- **WHEN** the ingest, the build and the export all succeed
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

#### Scenario: The export invoked on its own

- **WHEN** the export is invoked without the ingest or the build
- **THEN** it SHALL render the newest published snapshot and exit zero, no
  request to the statistics API having been made
