# snapshot-build

## Why

The client fetches one snapshot URL, validates what comes back and computes
everything from it, but nothing in the repository produces that bundle: the
only producer is a hand-authored Python generator whose 33 heroes exist to
exercise the model's test cases. The half of the real producer that computes
rather than fetches — the maths and the export — is this change, and it
settles the published artefact the deployment has to mount a volume for.

## What Changes

- The snapshot build: the arithmetic that turns raw per-patch aggregates into
  the deltas the client reads, the thresholds that decide which of them may be
  suggested at all, and the rule that a component the source never measured is
  zero on every hero rather than absent — which is what keeps a bundle
  publishable at all once the ingest fills staging.
- A snapshot lifecycle, with validation gating publication and retention
  bounding what is kept.
- The export: a published snapshot rendered into the bundle, published where
  a reader can never catch it half-written.
- `/snapshot.json` served from what the export publishes, falling back to the
  committed fixture — which is what development, the test suite and the
  end-to-end suite run on.
- The database-backed suite this change's own build and export need, run by
  the CI job `snapshot-ingest` adds against its `postgres` service container.
  Without that job the only exercised path is the fixture one, and a build that
  never touched a database would pass every gate.
- The STRATZ client, its rate-limit budget, and anything that fills staging
  from a network source. Staging is taken as given here; the shape this
  change settles is the contract the ingest change fills.
- The schedule. No cron entry, no timer, no workflow that runs the job — the
  deployment change owns when the job runs, and the alert when it fails. The
  CI job above is not that: it runs the tests, never the pipeline.
- The deployed Postgres service: no compose file, no volume, no image. The
  database this change provisions is the ephemeral one its tests run against;
  the one production connects to belongs to the deployment.
- Mirroring hero icons. The `icon` field keeps whatever staging holds; the
  ingest change is where a third-party URL becomes a local one.
- The versioned file and `latest` pointer sketched in the data model. One URL
  is served, because the client is specified to make exactly one request; the
  version lives in the payload and in Postgres.
- Deriving the pick phase or the side split. The ingest's source measures
  neither, so both are carried through as zeros on every hero — this change
  specifies what an unmeasured component is and refuses a partly zeroed one,
  and derives nothing.
- Retiring the fixture generator. Its heroes are hand-chosen for named model
  and search test cases that real data would not reproduce.

## Capabilities

### New Capabilities

- `snapshot-build`: how staging becomes a published snapshot — blending,
  smoothing, priors, sufficiency, the lifecycle a snapshot moves through, the
  validation that gates publication, and retention.
- `snapshot-export`: how a published snapshot becomes the bundle at the served
  URL — the rename that makes publication atomic, the camelCase boundary, the
  matrices' expansion, the ETag, and the fixture the URL falls back to.

### Modified Capabilities

None. `snapshot-delivery` specifies the client, and the client is unchanged:
it already revalidates a `no-cache` URL, so an ETag reaches it as a cheaper
answer to a request it was going to make anyway.

## Impact

- New server-side modules for the build and the export, outside
  `src/app/**` and importing `src/types.ts` for the bundle contract.
- `static-routes.ts` stops naming the fixture directly and reads the export
  directory instead, with the fixture as its fallback; `static-routes.test.ts`
  gains the cases that distinguish the two.
- The schema, the connection edge and the database-backed CI job are
  `snapshot-ingest`'s, which this change now follows rather than precedes.
- A Postgres connection string becomes a runtime input, absent in development
  and in both test suites, which run on the fallback.
- No new dependency: `Bun.SQL` ships with the runtime already pinned.
