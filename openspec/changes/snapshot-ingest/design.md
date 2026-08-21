# snapshot-ingest — design

## Context

`snapshot-build` settled the database and the arithmetic and left staging as an
argument shape. This change fills it. The API key arrived between the two, and
two probe sessions against the live schema — recorded in
`docs/context/stratz-probe-2026-08.md` — moved several assumptions the data
model was written under. The relevant ones here: the statistics API's per-week
endpoint cannot filter by game mode, its per-day endpoint can; and its own
version list has stopped updating while its match data has not.

Server-side code lives at the repository root alongside `server.ts`;
`src/` is the tree the browser bundle is built from, and nothing this change
adds belongs there.

## Goals / Non-Goals

**Goals:**

- Staging filled from real matches, over windows derived from the current patch
  rather than from when the job happened to start.
- A run that is safe to repeat: the same source data and the same run instant
  leave the same staging rows, and a failure leaves staging as it was. The
  reference rows and the mirrored files are outside that guarantee by
  construction, and `hero-reference` states what each leaves behind instead —
  both are operations a repeat performs identically, which is why they need no
  rollback rather than why they have none.
- A request budget that fits the published quota with room, so the schedule the
  deployment sets is unconstrained by it.
- The transport testable without a network, so the part most likely to break at
  three in the morning is the part cheapest to check.

**Non-Goals:**

- Everything the proposal lists under *Non-goals* — the schedule, the alert,
  side and phase, refitting constants, letter patches, older patches, a second
  image size.
- Caching or replaying responses to disk. A run is cheap enough to repeat.

## Decisions

### The meta comes from the per-day endpoint, not the per-week one

The first probe read the per-week endpoint as the meta component's source and
the second replaced it, on an argument neither granularity nor cost decides:
the weekly endpoint takes no game-mode filter. The product models ranked All
Pick, so every number that endpoint returns pools modes the model does not
describe. The daily endpoint takes `gameModeIds`, and passing it cost about 1%
of one hero's volume at Divine/Immortal — small, but stated rather than
assumed.

Granularity then comes free and matters on its own. The weekly buckets run
Thursday to Wednesday, so the freshest complete one is up to eight days old and
moves once a week; a nightly job over it would rebuild an identical snapshot
six nights in seven. Days move nightly, which is what makes a nightly schedule
worth setting. Cost falls too: one request per position covers every hero over
the whole window, because the window is an argument rather than a series of
requests.

The window is not unbounded, and the bound is the source's. The endpoint serves
the thirty most recent days and no more: a larger page size returns the same
thirty, and its skip argument returns nothing where skip zero returns thirty
rows. The current patch is five times that age, so the meta rests on its last
thirty days. That is tolerable on sample size — thirty days at these brackets
is millions of matches against sufficiency thresholds in the hundreds — and the
days a cap discards are the oldest, which a current meta wants least. The
requirement states the cap and makes the run record when it bound, rather than
leaving a 150-day patch to read as fully covered.

*Alternative considered*: `winWeek`, which takes the same filters, the game
mode included, and reached nineteen weeks when it was measured. It would lift
the cap at the cost of the granularity this decision was made for, and of
reconciling a weekly tail against a daily head without double-counting their
overlap. Recorded rather than taken — it is the only measured way to widen the
window, and the day it is wanted the measurement is already here.

*Alternative considered*: keeping the weekly endpoint and summing its buckets
into a patch window, which is what the first probe's finding suggested. It
cannot express the game mode at all, so no amount of summing fixes what it
measures.

### The two endpoints do not agree, and only one of them can be fixed

The pair endpoint has no game-mode filter either, and takes the coarse bracket
enum rather than the two fine-grained ones the daily endpoint takes.

What was measured is one pair and not this one: over the same week, bracket
family and position, the daily endpoint and the *weekly* one disagree by a
factor of about 2.1, with both filters controlled so neither is being ignored,
and the cause unestablished. The pair endpoint takes the same coarse enum as
that weekly one and offers no mode filter either, so it sits on the same side
of whatever produces the difference — but nothing has measured it, and the size
of its own gap is unknown. Carrying the 2.1 across to it would be an assumption
wearing a measurement's digits.

This is accepted rather than resolved, because what the pair endpoint yields is
an *advantage* — a difference between a pair's winrate and the neutral 50 —
and a difference is far less sensitive to which population produced it than an
absolute rate is. The absolute rates, where it would matter, come from the
endpoint that can be pinned to the mode.

### Patch detection leaves the statistics API

Its version list holds 181 entries whose newest is dated December 2025, and its
per-version aggregate returns no rows for that newest entry at all, while its
daily aggregate returns rows through the day before the probe. A major patch
released in March 2026 is absent from the list entirely. So the list is not
merely lagging: a run reading it would set `detected_at` to a release two
patches old, `prior(t)` would be zero from the first run onwards, and the
blending `snapshot-build` specifies would never engage.

The patch list therefore comes from a second source, and `detected_at` is the
release instant that source states rather than the instant this project first
saw the patch. The data model glosses the column as first appearance in the
data; the release instant is the better reading of the same intent, because the
quantity `prior(t)` decays over is how long players have had the patch, not how
long this repository has been running.

*Alternative considered*: deriving the patch from match data directly, which is
what "first appearance in the data" literally describes. Nothing in the
statistics API attributes a recent match to a version, so there is no data to
derive it from.

The cost is letter patches. The second source lists majors only; the first
lists letter patches and is stale. Neither alone is current and complete, and
merging a stale list with a current one to recover a patch kind is more
machinery than the outcome earns — a letter patch folded into its base major
takes the major's prior parameters, which decay more slowly over a shorter
window than a letter patch's would. That is a coarser answer, not a wrong one.

### Staging is replaced in one transaction; there is no ledger of what was pulled

Every window this change defines is a function of the current patch and the run
instant, so a re-run recomputes the same window rather than resuming a partial
one. That makes the simplest idempotence the correct one: delete the patch's
staging rows and insert the run's, inside one transaction. A failure rolls
back, and the previous rows — and with them the last snapshot that could be
built — survive untouched.

The run instant is an argument, not a clock reading, for the same reason
`snapshot-build` takes its build instant as one: without it "the same inputs"
is not a state anyone can arrange. The windows move with it — two runs either
side of a UTC midnight cover different days, and either side of a Thursday
cover different weeks — so a repeat is identical over the same instant and
deliberately not over a later one. Stating that is what keeps *a re-run
recomputes the window* from reading as a promise that a nightly job produces
yesterday's rows.

*Alternative considered*: a table recording each (patch, source, period)
already fetched, so a re-run resumes. It buys a shorter re-run at the cost of a
second consistency problem, and the re-run it shortens is about 516 requests
against a daily ceiling of 15,000. Most of that is the pair pull: one request
per hero per week, four weeks, so 508 of the 516. The meta costs five whatever
the window.

### The pair pull is capped at four weeks, and says so

The pair endpoint's only time dimension is a week and it takes one hero at a
time, so a run covering a whole patch would issue one request per hero per
week — past the hourly ceiling once a patch is about eleven weeks old. Four
weeks is a bound this change chooses. It is in the delta spec rather than only
here, and the run records the weeks it covered, because a cap that is invisible
in the output reads afterwards as complete coverage.

### One entry point, three steps, one exit code

The job is a function that calls the ingest, the build and the export in order
and returns which failed. It owns no schedule and no alert; the deployment
change owns both, and both want an exit code rather than a log line.

The export alone is separately invocable, so a failed export can be repeated
without re-ingesting — which it already supports, reading the newest published
snapshot rather than the one just built. The ingest and the build get no such
mode. A standalone entry point is an interface: it needs its inputs, its
outputs and its failure semantics fixed, and neither has a caller in this
change that would exercise them.

### The mirrored images are served like the fonts, and published like the bundle

The route's exact response shape is fixed by `hero-reference` §*The mirrored
images are served from the application's origin* and is not repeated here. What
belongs here is why it takes that shape. Immutable caching is the fonts'
reasoning applied unchanged — the filename encodes the hero, and the bytes
under that name do not change. The route is built from the directory listing,
as the font routes are, so a request can only ever name a file that is there
and has no path to traverse out of. Unlike the fonts it cannot be a prebuilt
map: the directory is written by the job while the server is running, so the
listing is resolved per request.

That last property is what forces the write-then-rename. A prebuilt map would
have made a half-written file unreachable until restart; a per-request listing
makes it reachable the moment it is created, so a download that streams into
its final name is a truncated PNG served to whoever asks during it. The bundle
faces the same race and `snapshot-export` already answers it the same way, so
this is the repository's existing idiom rather than a new one.

*Alternative considered*: resolving the listing at startup after all, and
restarting the server when the job finishes. It trades a race the rename
already closes for a deployment coupling between the job and the web process,
which Task 7 would then have to carry.

*Alternative considered*: carrying the source's image URL into the bundle.
`app-shell` forbids the running application any request off its own origin, so
this is not a trade-off to weigh but a requirement to meet.

### No new dependency: `fetch`, `Bun.SQL`, and a limiter that is a queue

The pacing the quota needs is "issue no request while eight are already inside
the last second", which is a timestamp ring and an await. A rate-limiting
package would be a runtime dependency where the repository has one, for a
dozen lines whose failure mode is a `429` the retry policy already handles.

### Tests: the transport is pure, the database edge reuses the build's CI job

The client, the pacing, the retry policy, the window arithmetic and the contest
formula are all exercised against a stubbed `fetch` with no network. The
staging writes join the database-backed suite `snapshot-build` adds, against
the same `postgres` service container, and skip locally when no connection
string is present — while the CI job fails if they skipped there.

No suite calls the live API. A test that did would be a test of someone else's
availability, and would need a key to run at all, which is the one thing a
public repository's CI cannot be given. What the probe measured against the
live schema is recorded in the save-point instead, and the fixtures the client
tests run on are shaped from those recorded responses.

## Risks / Trade-offs

- **The two endpoints' populations do not reconcile** → the absolute rates come
  from the one that can be pinned to the game mode; the other yields only
  differences, where the population matters far less. The ratio is recorded
  with its controls in the save-point rather than explained away, and remains
  the strongest candidate for the first spot-check against dota2protracker.
- **A patch detected today carries the previous patch's matches** → the meta
  window falls back to a single day rather than none, so a snapshot exists at
  all. Those matches were played under the old patch. The next day's pull
  dilutes them, `snapshot-export`'s `stabilizing` flag is true over exactly
  this period, and the alternative — no rows, so no snapshot, so a failed build
  every night until a day accumulates — is worse in every direction.
- **The patch source could stop being current too** → then `detected_at` freezes
  and every blend reads a stale prior, silently. Nothing here detects that. It
  is the same failure the statistics API's own list is already in, which is why
  the possibility is named rather than assumed away, and a check that the
  current patch is not implausibly old belongs to whoever adds the alert.
- **Two more sources to be unavailable** → the patch list and the images are
  both read at ingest time only. A failure of either fails the run, and the run
  failing leaves the previous bundle served, which is the behaviour the data
  model already specifies for a failed job.
- **The key lives in an environment file** → `.gitignore` covers `.env*` with
  `.env.example` excepted, and the example carries variable names with no
  values. A key that has been exposed is rotated at its source; nothing in the
  repository can undo that for it.

## Open Questions

- The cadence itself. Daily data makes a nightly run meaningful, but how often
  it should actually run is the deployment change's, together with the alert
  that tells anyone it stopped.
- Why the two endpoints disagree by a factor of two. Answering it would need
  either a bracket mapping the schema does not publish or a per-match
  reconciliation, and neither changes what this change does.
- Whether any current source lists letter patches. If one appears, restoring
  them is a small change: the column and the parameters already exist.
