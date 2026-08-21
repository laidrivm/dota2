# snapshot-ingest

## Why

`snapshot-build` turns staging rows into a published bundle and takes staging
as given; nothing fills it. Until something does, the only snapshot the
application can serve is the hand-authored fixture, and the whole pipeline
downstream of the database — blending, smoothing, validation, publication —
has never run on a real number. The API key that blocked this arrived, and
`docs/context/stratz-probe-2026-08.md` records what it reaches.

## What Changes

- A STRATZ GraphQL client: the two headers the Cloudflare gate wants, pacing
  under the published per-second ceiling, bounded retries, and a failure path
  that tells a challenge apart from a rejected key — the two arrive as the same
  status code with different content types.
- The meta component and position shares pulled per day rather than per week,
  filtered to ranked All Pick. The endpoint the earlier probe assumed cannot
  express the game mode at all, which is what settles the choice; the daily
  granularity is what makes a nightly job worth running.
- Matchups and synergies pulled per hero over a bounded number of complete
  weeks, that being the only time dimension their endpoint offers.
- Contest rate computed from counts the pulls already return, its denominator
  exact and its ratio documented as the approximation it is — picks and bans
  come from endpoints that do not share a population.
- Patch detection moved off STRATZ. Its version list stopped eight months
  before the probe while its match data did not, so a patch released since is
  invisible to it and every blend would read the wrong `detected_at`.
- The reference tables filled: heroes upserted and never removed, patches
  written once, and hero images mirrored to the app's own origin, which
  `app-shell` requires and no third-party URL in the bundle would satisfy.
- One entry point that runs the ingest, the build and the export in order and
  reports a single outcome, leaving the previously published bundle served when
  any of the three fails.
- `.env.example`, naming the variables a run reads without carrying a value for
  any of them.

The measurable form of each — headers, ceilings, window lengths, paths — is in
the delta specs, and stated there only.

## Non-goals

- The schedule. No cron entry, no timer, no workflow that runs the job — the
  deployment change owns when it runs and the alert when it fails. This change
  owns only the entry point that a schedule would call.
- Deriving the pick phase or the side split. Neither is reachable from any
  STRATZ aggregate, so neither is pulled at all; `snapshot-build` specifies
  what an unmeasured component is and this change measures nothing extra.
- Refitting the smoothing constants or the sufficiency thresholds against real
  data. They are `snapshot-build`'s, provisional by its own design note, and
  refitting them is a change that needs a distribution this one is the first to
  produce.
- The manual cross-check against dota2protracker. It is a comparison a person
  performs, not a step the job takes.
- Letter patches. No current source lists them: STRATZ's version list holds
  them and is stale, the current source holds majors only. A letter patch is
  therefore folded into its base major patch, which is a coarser prior than
  `snapshot-build` provides for, and a later change may reopen it.
- Backfilling patches older than the current one. The build reads `wr_old`
  from a retained snapshot rather than from staging, so a previous patch's
  staging rows buy nothing on a first run.
- A second hero image size. One is mirrored; a screen that needs another is
  the change that adds it.

## Capabilities

### New Capabilities

- `snapshot-ingest`: how staging is filled — the transport and the quota it
  stays inside, the windows each statistic is pulled over, how a run that fails
  part-way leaves the database, and the entry point that carries a run through
  build and export to one outcome.
- `hero-reference`: how the reference tables are kept — heroes upserted and
  never removed, patches detected and written once, and hero images mirrored to
  a path the application serves itself.

### Modified Capabilities

None. `snapshot-build` reads staging without asking who wrote it, and
`snapshot-export` renders whatever `icon` holds — both already say so.
`app-shell`'s ban on third-party runtime requests is satisfied by mirroring
rather than relaxed.

## Impact

- New server-side modules for the client, the pull and the job, outside
  `src/app/**`, alongside the build and export modules `snapshot-build` adds.
- `static-routes.ts` gains the mirrored-image directory; `/icons/*` is a path
  the fixture already names and nothing currently serves.
- Two runtime inputs become required for a real run: the STRATZ key and the
  Postgres connection string. Both stay absent in development and in both test
  suites, which keep running on the fixture.
- A second network source. The patch list and the hero images come from
  outside STRATZ, and both are read at ingest time only — never at runtime.
- No new dependency: `fetch` and `Bun.SQL` ship with the runtime already
  pinned.
