# snapshot-ingest — delta spec

## ADDED Requirements

### Requirement: Every request carries both halves of the gate

The client SHALL send `Authorization: Bearer <key>` and
`User-Agent: STRATZ_API` on every request to the statistics API, the key read
from the `STRATZ_API_KEY` environment variable. WHERE that variable is absent
or empty the run SHALL fail before its first request, naming the variable. A
`403` whose `content-type` is not JSON SHALL be reported as an unmet challenge
naming the `User-Agent`, never as a rejected key: the gate answers a request
missing the header with the same status as one carrying a bad token, and the
body is the only thing that distinguishes them
(`docs/context/stratz-probe-2026-08.md`).

#### Scenario: No key configured

- **IF** `STRATZ_API_KEY` is unset when the run starts
- **THEN** the run SHALL fail naming that variable, and SHALL issue no request

#### Scenario: The challenge, not the key

- **WHEN** a request is answered `403` with `content-type: text/html`
- **THEN** the reported failure SHALL name the `User-Agent` header and SHALL
  NOT describe the key as rejected

#### Scenario: The key, not the challenge

- **WHEN** a request is answered `403` with a JSON body
- **THEN** the reported failure SHALL describe the key as rejected

### Requirement: A run stays inside the quota the API states

The client SHALL issue no request while eight have already been issued in the
preceding second. WHEN a response reports zero remaining in any of its
rate-limit windows the run SHALL stop without issuing a further request and end
failed, rather than continuing into a refusal. The ceilings are the API's own,
carried on every response, and are read from there rather than configured — a
number this specification restated would drift from the one the service
enforces.

#### Scenario: The ninth request in a second

- **WHEN** eight requests have been issued within the preceding second and a
  ninth is due
- **THEN** the ninth SHALL NOT be issued until a second has elapsed since the
  first of those eight

#### Scenario: A window reports nothing remaining

- **IF** a response reports zero remaining in any rate-limit window
- **THEN** the run SHALL end failed, and no further request SHALL be issued

### Requirement: A request is retried only where retrying can succeed

A request answered `429` or any `5xx` SHALL be retried up to four attempts in
total, the delay before each retry twice the one before it and the first one
second. A request answered any other `4xx` SHALL NOT be retried, its status
being a statement about the request rather than about the service. A request
still failing on the fourth attempt SHALL end the run failed.

#### Scenario: A transient failure

- **WHEN** a request is answered `500` once and `200` on the retry
- **THEN** the call SHALL return the second response's body, and the run SHALL
  continue

#### Scenario: A rejected request

- **IF** a request is answered `400`
- **THEN** exactly one attempt SHALL have been made

#### Scenario: A failure that does not clear

- **IF** every one of four attempts is answered `429`
- **THEN** the run SHALL end failed after the fourth, and no fifth SHALL be
  issued

### Requirement: The meta is pulled by day over the current patch's life

The ingest SHALL read hero match and win counts by day and by position,
filtered to the ranked All Pick game mode and to the Divine and Immortal
brackets, over every whole day from the current patch's `detected_at` to the
run instant, and SHALL sum those days into one staging row per hero and
position. WHERE that window holds no whole day the window SHALL be the single
most recent whole day, so that a patch detected today yields a sample rather
than none — those matches were played under the previous patch, and carrying
them is a deliberate approximation that the next day's pull dilutes and the
`stabilizing` flag `snapshot-export` renders already warns about.

The game-mode filter is why this statistic is read by day rather than by week:
the weekly endpoint offers no such argument, so every number it returns pools
the modes the product does not model.

#### Scenario: A patch a week old

- **WHEN** the current patch's `detected_at` is seven whole days before the run
  instant
- **THEN** the request SHALL ask for seven days, and each staging row SHALL
  hold the sum of that hero and position over them

#### Scenario: A patch detected today

- **WHEN** the current patch's `detected_at` is less than one whole day before
  the run instant
- **THEN** the request SHALL ask for one day, and staging SHALL hold rows

#### Scenario: The modes the product does not model

- **WHEN** the meta pull is issued
- **THEN** it SHALL name the ranked All Pick game mode, and a response covering
  every mode SHALL NOT be accepted in its place

### Requirement: Pair statistics are pulled per hero over four complete weeks

The ingest SHALL read each hero's opponent and ally rows from the pair
endpoint, asking for every other hero rather than the endpoint's default page,
and SHALL sum them over the four most recent complete weeks. Four is this
change's own bound, not the source's: the endpoint's only time dimension is a
week, and a run that covered a whole patch would issue one request per hero per
week, exceeding the hourly ceiling on a patch older than about eleven weeks. Four
weeks is chosen because it puts a typical pair's sample at several times the
smoothing constant `snapshot-build` fixes for a pair statistic — which this
requirement therefore does not restate — leaving most of the raw delta standing
rather than pulled towards neutral.

A week SHALL be attributed to the patch in force on its last day. Its span may
cross a patch release, and no argument the endpoint offers can split it.

#### Scenario: Every opponent, not the default page

- **WHEN** a hero's pair rows are requested
- **THEN** the response SHALL carry one opponent row and one ally row for every
  other hero the reference tables hold

#### Scenario: A patch older than the bound

- **WHEN** the current patch has been live for twelve complete weeks
- **THEN** exactly four weeks SHALL be requested per hero, and the run SHALL
  record which weeks it covered

#### Scenario: A week that crosses a release

- **WHEN** a week's span contains the current patch's `detected_at`
- **THEN** that week SHALL be attributed to the current patch, its last day
  falling under it

### Requirement: Contest rate is a share of the window's matches

For each hero the ingest SHALL store `(picks + bans) / matches`, where `picks`
is that hero's match count over the meta window, `bans` is its ban count over
the same days, and `matches` is the sum of every hero's match count over that
window divided by ten. The divisor is exact rather than an estimate: an All
Pick match holds ten distinct heroes, so every match contributes exactly ten to
that sum. Stating it closes the question of whether the two pulls cover the
same population — they are the same pull.

This is a share rather than a winrate, so it SHALL be stored ready and carried
through the build unblended and unsmoothed. Blending a share against a previous
patch's share would answer a question nothing asks, and smoothing towards 50
would be meaningless for a quantity whose neutral value is not 50.

#### Scenario: A hero picked in every match

- **WHEN** every hero's match counts over the window sum to ten times the
  number of matches, and one hero's own count equals that number with no bans
- **THEN** that hero's contest rate SHALL be 1

#### Scenario: Bans count towards contest

- **WHEN** two heroes have equal pick counts and one has bans and the other
  none
- **THEN** the one with bans SHALL have the higher contest rate

### Requirement: A run leaves staging whole or leaves it untouched

The ingest SHALL replace the current patch's staging rows rather than adding to
them, and SHALL write every row of a run inside one transaction. IF a run fails
at any point before that transaction commits, staging SHALL hold exactly the
rows it held before the run started. Two runs over unchanged source data SHALL
therefore leave identical staging rows.

Replacing rather than accumulating is what removes the need for a ledger of
what has been pulled: the windows above are derived from the patch and the run
instant, so a re-run recomputes them rather than resuming a partial one.

#### Scenario: Two runs over unchanged data

- **WHEN** the ingest runs twice against a source returning identical responses
- **THEN** staging SHALL hold the same rows with the same counts after the
  second run as after the first

#### Scenario: A run that fails part-way

- **IF** the pair pull fails after the meta pull has produced its rows
- **THEN** staging SHALL hold the rows it held before the run started

#### Scenario: Rows from an older patch

- **WHEN** a run writes staging for a patch newer than the one staging holds
- **THEN** rows older than the previous patch SHALL be gone

### Requirement: The job carries a run to one outcome

One entry point SHALL run the ingest, then the build, then the export, and
SHALL exit non-zero WHEN any of the three fails, having reported which. A
failed run SHALL leave the previously published bundle served, the export
having written nothing, so the application never loses the snapshot it had.

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
