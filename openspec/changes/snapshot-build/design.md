# snapshot-build — design

## Context

The client is finished and specified: it fetches one URL, validates the
payload, caches the last good one and computes everything from
`SnapshotBundle` as `src/types.ts` declares it. Nothing produces that payload
— `src/fixtures/snapshot.json` is hand-authored by a Python script whose 33
heroes exist to exercise named model and search test cases.

This change builds the producer's second half. Its first half, the STRATZ
ingest, waits on an API key, so staging is taken as given here and the shape
this change settles becomes the contract the ingest fills. Server-side code
already lives at the repository root (`server.ts`, `static-routes.ts`,
`dist-routes.ts`); `src/` is the tree the browser bundle is built from.

## Goals / Non-Goals

**Goals:**

- A schema, a build and an export that turn staging rows into the bundle the
  client already accepts, reaching no source outside its own database.
- Arithmetic testable without a database, so the part most likely to be wrong
  is the part cheapest to check.
- A served URL that works with no database at all, because development, the
  unit suite and the end-to-end suite must keep running on the fixture.

**Non-Goals:**

- Everything the proposal lists under *Non-goals* — the ingest, the schedule,
  the production Postgres service, icon mirroring, pick-phase derivation.
- Refitting the smoothing constants. Data-model §4.2 calls its `k` values
  provisional and refits them by the method of moments against a real
  distribution, which no amount of fixture data can stand in for.

## Decisions

### The arithmetic is a pure module; SQL is a thin edge around it

Blending, smoothing, position shares and thresholds take rows in and return
rows out, exactly as `src/model.ts` maps a bundle and a session to an output.
Postgres is reached only to read staging and write results.

*Alternative considered*: computing in SQL. It would be faster over the full
matchup matrix, and it would move the one part of this change with real
failure modes into the one place the test suite cannot reach without a
running database. Rejected on testability; ~34k numbers is not a volume that
needs SQL to be fast.

### The schema is one idempotent file, not a migration ledger

`schema.sql` with `CREATE TABLE IF NOT EXISTS`, applied on connect. There is
one schema version and nothing to migrate from.

*Alternative considered*: a numbered-migration table from the start. It is
scaffolding for a second version that does not exist. The file carries a
`ponytail:` comment naming the ceiling — the first `ALTER` is where the
ledger arrives.

### `snapshot_id` stays an incremental integer

`docs/api-design.md` exempts an ID that only ever travels inside a payload
from its UUIDv7 requirement, and `snapshotId` is one: no endpoint accepts it,
no consumer resolves it, and the client reads it only to notice that the
bundle changed. `src/types.ts` already declares it as a number and
`snapshot-delivery` pins client behaviour against that, so widening it would
be a client change this proposal excludes. The exemption is carried at the
column, as the rule requires. Hero ids stay Valve's integers for the reason
they keep Valve's spelling.

### The response schema is `src/types.ts` plus the client's own validator

`docs/api-design.md` asks for an explicit response schema. Here the shared
`SnapshotBundle` interface is that schema, and adding zod or typebox for one
payload would be a runtime dependency where the repository has one.

Two checks stand where a schema library would, and they answer different
questions. The client's own validator, reached rather than reimplemented,
answers *would the consumer reject this*. It reaches further than
`snapshot-delivery`'s four named fields — `isBundle` also requires `createdAt`
to parse as a calendar date and every hero to carry a numeric `id` and a
string `name` — but it stops at the hero's identity, so passing it is a floor
and not a guarantee. The export therefore also asserts the payload against
`SnapshotBundle` at runtime, keys and value types at every depth, because a
missing `side` reaches the model as `undefined` and leaves it computing `NaN`,
and a stringified `contest` compares as neither greater nor less. That assertion *is* the runtime schema `docs/api-design.md` asks for —
what the document rules out is a raw DB object reaching the client, not a
hand-written validator instead of a package.

What stays inverted, deliberately, is which of the two is the source of truth.
`SnapshotBundle` is declared in `src/types.ts`, shipped, and pinned by
`snapshot-delivery`; deriving it from a server-side schema would make the
client's contract a build output of the producer, which is a client change
this proposal excludes and the layering `snapshot-delivery` exists to prevent.

`matchups` and `synergies` are keyed by hero id, which reads against the same
document's ban on dynamic keys. That rule guards a record with optional
fields, where a key's absence is information the consumer must branch on;
these are maps, and `src/model.ts` reads them as
`bundle.matchups[String(a.id)]?.[String(b.id)] ?? 0` — indexed by an id it
already holds, never enumerated, with absence already meaning zero. The shape
is declared in `src/types.ts` and shipped, so arrays of explicit ids would be
a client change this proposal excludes, and would inflate ~34k numbers the
data model budgets at 300–500 KB gzipped. `positions` is the same shape.

`patch.detectedAt` is a bare calendar date where the same document asks for
ISO 8601 with an offset. It is the day a patch was first seen in the data, not
an instant, and it ships that way: the fixture carries `"2026-07-14"`,
`src/types.ts` declares it, and `snapshot-delivery` pins the header that reads
it. Giving it an offset is a client contract change, which some later change
may take on its own terms — this one carries `createdAt` with an offset and
leaves the date a date. The calendar the comparison converts on is fixed by
*Patch blending with a decaying prior*, and read from there rather than
repeated here.

The document's remaining API rules do not reach a single static JSON file:
there is no error body to shape as RFC 9457, no list to paginate, and no
cross-origin consumer to configure CORS for.

### `/snapshot.json` becomes a handler, not a prebuilt `Response`

`staticRoutes()` returns `Response` objects built once at startup. That works
for fonts, whose bytes never change under a stable name. The snapshot's
*source* switches — fixture until something is published, the published file
after — and its ETag has to follow. So this route moves out of the static map
into a function that resolves the file and its validator on each request.

The ETag is a hash of the bundle's bytes, not its `mtime` and size. `mtime`
is what `dist-routes.ts` keys its listing cache on and it would be cheaper
here too, but it answers *was this file rewritten* where the client is asking
*is this the payload I hold*: a byte-identical re-export would change the
`mtime` and cost every returning client the whole bundle again. The hash is
computed once when the file is read and cached, so the `stat` does the
per-request work and the hash is paid once per publication.

The cache key is the resolved source path together with `mtimeNs`, not
`mtime` alone, and both halves earn their place. The path, because this route
has two sources — the fixture until something is published, the published
file after — and a key that forgets which one it read hands the previous
source's ETag to the next. The nanoseconds, because two writes inside one
millisecond share a millisecond timestamp, which is the same reason
`dist-routes.ts` reads `mtimeNs` for its listing cache.

### `stabilizing` is computed at export, not stored

It is a function of the snapshot's own `patch.is_major`, `patch.detected_at`
and `created_at` — all frozen when the snapshot is built — so computing it at
export yields the same answer forever while keeping one fewer column that
could disagree with the three it derives from.

### Tests: pure everywhere, with one database-backed job in CI

The arithmetic, the export's rendering and the route's fallback are all
tested without Postgres. The SQL edge gets an integration suite that skips
when no connection string is present, so the local pre-push run stays
offline — and a CI job that supplies one, against a `postgres` service
container, and fails if the suite skipped anyway. Skipping is a local
convenience, never a verdict: a suite that skipped and a suite that passed
report the same green otherwise. This is CI, not deployment: the production
service, its volume and its compose file remain Task 7's.

## Risks / Trade-offs

- **Staging's shape is settled before the source that fills it exists** → the
  arithmetic takes staging as an argument shape, so a column STRATZ cannot
  fill arrives as zeros without the maths changing. There are two such
  columns, not one. Pick phase was expected: the granularity exists in
  STRATZ's schema but only inside its replay-upload subsystem, which no
  aggregate reaches. Side was not: `data-model.md` §2 lists winrate by
  Radiant/Dire as a STRATZ input, and the schema offers a faction grouping
  only under a single player, team or league — never over a rank bracket.
  `docs/context/stratz-probe-2026-08.md` records both, measured against the
  live schema rather than against which endpoint names happened to work.

  Both degrade the same way, and only while the zeros are uniform:
  `src/model.ts` weighs the delta without asking whether it was measured, so
  zeroing every hero moves no candidate's rank, and zeroing some ranks the
  measured above the missing. Which staging must therefore never do by
  halves — *An unmeasured component is zero for every hero* is where that
  stops being a note in a risk list and becomes a validation failure.
- **The fallback is the path everything runs on** → development and both test
  suites never touch the database path, which is how it rots. The CI
  integration job is the counterweight, and it is the only thing standing
  between a published bundle and nobody noticing it was never read.
- **Retention could delete the prior a blend needs** → a count of 30 is only
  safe while builds are at most daily: `prior(t)` reaches zero at the `t_max`
  the blending requirement fixes for each patch kind, and nothing here bounds how
  often the job runs — Task 7 sets the schedule. So retention is not a count
  alone: the newest published snapshot of the patch a blend reads `wr_old`
  from is retained whatever its age, and the count applies to the rest.
- **A failed export leaves a published snapshot unserved** → the bundle on
  disk stays the previous valid one, and re-running the export republishes
  without rebuilding, because the export reads the newest published snapshot
  rather than the one just built.

## Open Questions

- The `k` constants and the sufficiency thresholds are data-model's starting
  values. Refitting them needs a real distribution, so it belongs after the
  ingest, not here.
- Whether the export ships as a subcommand of the build or as its own entry
  point matters only to the job that Task 7 schedules; this change exposes
  both as functions and lets that decision land with the schedule.
