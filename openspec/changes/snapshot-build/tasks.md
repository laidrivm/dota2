# Snapshot build and export — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). The
bracketed numbers are that run's idea numbers, so every one of its 45 ideas
is traceable to the group that closes it. Numbers from 46 up are later work's
own, added where a review finding or an apply run named a case the run had
missed.

Eight groups, so eight pull requests on `feat/snapshot-build-1` … `-8`, in
order. It runs after `snapshot-ingest`'s groups 1 to 11c, which own the schema
both read and fill the staging the build reads, and before its group 12, whose
entry point calls this change's build and export. That entry point writes what
the run covered onto the row the build created, including when the build ends
`failed`, so the build returns that row's `snapshot_id` on both outcomes —
`snapshot-ingest` §*What a run covered is recorded on the snapshot it built*
rests on it.
Groups 1 and 2 add a pure module nothing calls yet; the application
keeps running on the committed fixture until group 8 rewires the route.

## 1. Blending and smoothing

- [x] 1.1 Write the blending tests: `prior(0)` is `k0` for both patch kinds
      [5]; `prior(h)` is half of `k0` [6]; a major patch's prior is positive
      at `t = 3` and 0 at `t = 4` [7]; a letter patch's at `t = 6` and
      `t = 7` [8]; a statistic with no predecessor patch blends to `wr_new`
      [1]; `n_new = 0` against a zeroed prior does not divide by zero [13]; a
      hero absent from the previous patch blends without a prior rather than
      reading the missing value as 50 [14]; a statistic with neither matches
      nor a surviving prior yields no row at all [46]; a statistic inside the
      window is the weighted average of both patches, so a prior dropped
      altogether and one applied undecayed each fail [63]; `n_new = 0` against
      a *live* prior blends to `wr_old` rather than yielding no row [64]. (Req:
      snapshot-build — Patch blending with a decaying prior)
- [x] 1.2 Write the smoothing tests: `n_eff = k` halves the raw delta [9];
      `n_eff = k / 9` leaves a tenth of it [2]; each statistic uses its own
      `k`, so a single shared constant fails [12]. (Req: snapshot-build —
      Smoothing towards neutral by sample size)
- [x] 1.3 Implement `prior(t)` and `wrBlend` over the parameter table, taking
      patch kind and whole days as arguments. (Req: snapshot-build — Patch
      blending with a decaying prior)
- [x] 1.4 Implement the smoothing that maps a blended winrate and `n_eff` to
      a stored delta, with the per-statistic `k` values named at one site.
      (Req: snapshot-build — Smoothing towards neutral by sample size)

## 2. Position shares and sufficiency

- [x] 2.1 Write the share tests: a hero picked on one position gets
      `pick_share` 1 and a single row [3]; a hero picked on three gets three
      rows and none for the positions it never played [4]; a hero whose picks
      total zero yields no rows and no division [53]. (Req:
      snapshot-build — Position shares are a distribution over a hero's
      positions)
- [x] 2.2 Write the sufficiency tests at both thresholds: a hero-position at
      `n_eff = 500` is sufficient and at 499 is not [10]; a hero summing to
      1000 is sufficient and to 999 is not [11]. (Req: snapshot-build —
      Sufficiency thresholds decide what may be suggested)
- [ ] 2.3 Implement the position-share normalisation, returning an empty map
      before dividing when a hero's picks total zero, and emitting no row for a
      position with no picks. (Req: snapshot-build — Position shares are a
      distribution over a hero's positions)
- [ ] 2.4 Implement the two sufficiency thresholds as one predicate per
      scope, so neither can drift from its stated value. (Req: snapshot-build
      — Sufficiency thresholds decide what may be suggested)
- [ ] 2.5 Write the unmeasured-component tests: staging holding no side and
      no phase rows leaves every hero row carrying 0 for both, and the
      snapshot publishes [58]; staging holding side rows for every hero but
      one fails validation [59]; a component measured for every hero, one of
      whose blended deltas is exactly 0, publishes — so the rule cannot be
      passing by treating a measured neutral as unmeasured [60]; staging
      measuring side for every hero while holding no phase rows leaves the
      side deltas standing and zeroes phase alone, so a verdict taken once
      per snapshot rather than per component fails [61]. (Req: snapshot-build
      — An unmeasured component is zero for every hero)
- [ ] 2.6 Implement the per-component measured/unmeasured decision, taken
      once for the whole snapshot from whether staging holds any row for the
      component, and returning the zero to write for an unmeasured one. (Req:
      snapshot-build — An unmeasured component is zero for every hero)

## 3. Persistence

The schema, the `Bun.SQL` edge and the CI job that exercises them were this
group's first three tasks and are now `snapshot-ingest`'s group 4. They closed
no criterion here, every group of that change writes through them, and it can
no longer run before this one. This group takes all three as given.

- [ ] 3.1 Write the determinism tests: two builds over identical staging and
      the same build instant produce statistics rows equal field by field
      [25]; a build completes while its database answers and every *other*
      network call is stubbed to throw [26]; a blend reads `wr_old` from the
      predecessor patch's newest published snapshot [51]. (Req: snapshot-build
      — The build reads its own database and nothing else)
- [ ] 3.2 Write the symmetry tests: `(a,b)` and `(b,a)` matchup rows carry
      `advantage_adj` summing to 0 [21]; `hero_synergies` holds `(a,b)` for
      `a < b` and no mirrored row [22]. (Req: snapshot-build — Stored pair
      statistics carry their symmetry)
- [ ] 3.3 Implement the staging read and the statistics write, taking the
      build instant as an argument, writing it to `created_at`, reading
      `wr_old` from the predecessor snapshot retention holds for that purpose,
      and writing 0 for a component 2.6 reports unmeasured. (Req:
      snapshot-build — The build reads its own database and nothing else /
      Stored pair statistics carry their symmetry / An unmeasured component is
      zero for every hero)

## 4. Lifecycle, validation and retention

- [ ] 4.1 Write the lifecycle tests: a build satisfying every check ends
      `published` and newest [16]; the first snapshot ever built publishes
      with no earlier one to compare hero counts against [15]; a build
      raising before validation never leaves `published` [23]; a failed
      validation leaves the previously published snapshot newest [24]. (Req:
      snapshot-build — A snapshot is published only after it validates)
- [ ] 4.2 Write the validation boundary tests: a hero count equal to the last
      published passes and one below fails [18]; shares within 1e-6 pass and
      0.8 fails [19]; an `adj` of exactly ±25 pp passes and beyond fails
      [20]; a hero the reference tables know but staging never picked has no
      position rows and still passes [47]. (Req: snapshot-build — A snapshot
      is published only after it validates)
- [ ] 4.3 Write the retention tests: a thirty-first snapshot leaves 30 rows,
      removes the oldest by `snapshot_id`, and leaves no orphan statistics
      row [17]; 30 snapshots built inside one day still leave the previous
      patch's newest published one, whose `wr_old` the prior still weighs
      [48]. (Req: snapshot-build — Snapshot retention)
- [ ] 4.4 Implement the `building` → `published` | `failed` transitions and
      the three validation checks between the last two, plus the fourth that
      fails a measured component staging holds no row for on some hero. (Req:
      snapshot-build — A snapshot is published only after it validates / An
      unmeasured component is zero for every hero)
- [ ] 4.5 Implement retention as a cascade from `snapshots`, so no statistics
      row can outlive its snapshot, exempting from the count the newest
      published snapshot of any patch a blend may still read `wr_old` from.
      (Req: snapshot-build — Snapshot retention)

## 5. Rendering the bundle

- [ ] 5.1 Write the selection tests: with no `published` snapshot the export
      writes no file and exits non-zero [27]; a newer `building` snapshot is
      not the one exported [30]. (Req: snapshot-export — The bundle is
      rendered from the newest published snapshot)
- [ ] 5.2 Write the shape tests: every key at every depth is a camelCase name
      or a decimal integer string, so `patch-id` and `PatchId` fail as
      `patch_id` does, and an undeclared key fails too [34];
      `patch.isMajor` is a JSON boolean and `createdAt` an ISO 8601 timestamp
      carrying an offset, while `patch.detectedAt` stays the bare calendar
      date the shipped contract already holds [35]. (Req: snapshot-export —
      The bundle's keys are camelCase)
- [ ] 5.3 Write the matrix tests: a synergy stored once appears under both
      hero ids with the same value [36]; `matchups[b][a]` negates
      `matchups[a][b]` [37]; a hero's `positions` omits every position it was
      never picked on [38]. (Req: snapshot-export — Pair statistics are
      expanded into full matrices)
- [ ] 5.4 Implement the render: select the newest published snapshot, rename
      keys to camelCase at that boundary, and expand the stored pairs into
      full matrices. (Req: snapshot-export — The bundle is rendered from the
      newest published snapshot / The bundle's keys are camelCase / Pair
      statistics are expanded into full matrices)

## 6. The stabilizing flag and the client's acceptance

- [ ] 6.1 Write the stabilizing tests: true one day short of `t_max` after a
      major patch's `detected_at`, false at exactly `t_max` [32]; false for a
      letter patch however recent [33]; a `created_at` whose offset puts it in
      a later local date than its UTC one counts by UTC [57]. (Req:
      snapshot-export — The stabilizing flag marks a settling major patch)
- [ ] 6.2 Write the acceptance tests: an exported bundle passes the validation
      `snapshot-delivery` specifies for a fetched payload [39]; a hero entry
      missing `side`, `phase`, `contest` or `sufficient` fails the export
      although that validation would accept it [49]; a `contest` rendered as
      the string `"0.13"` fails it too [52]; so does any numeric leaf that is
      `NaN`, an infinity or `null` [54]; and a snapshot whose `side` and
      `phase` are zero on every hero renders both fields and publishes, the
      zeros surviving to the payload rather than being dropped as empty [62].
      (Req: snapshot-export — The exported bundle is what the client accepts)
- [ ] 6.3 Implement `stabilizing` from the snapshot's own `patch.is_major`,
      `patch.detected_at` and `created_at` — the build instant itself, so the
      window it measures and the decay a blend applied share one clock —
      storing no column for it. (Req: snapshot-export — The stabilizing flag
      marks a settling major patch)
- [ ] 6.4 Reach the client's validator from the export's test without
      duplicating it, so a second copy cannot drift from the one the client
      runs, and add the runtime assertion over `SnapshotBundle`'s keys and
      value types that the validator's four fields do not reach — by hand,
      since a schema package would be the change's only new dependency. (Req:
      snapshot-export — The exported bundle is what the client accepts)

## 7. Atomic publication

- [ ] 7.1 Write the atomicity tests: reads taken repeatedly across an export
      always parse as complete JSON [31]; an export failing before its rename
      leaves the previous bundle served [44]; a temp file left by a crashed
      export is not served at `/snapshot.json` [43]. (Req: snapshot-export —
      Publication is atomic)
- [ ] 7.2 Implement the write-then-rename publication, naming the temporary
      file so the serving route cannot mistake it for the bundle. (Req:
      snapshot-export — Publication is atomic)

## 8. Serving the published bundle

- [ ] 8.1 Write the route tests: a published bundle is served in preference
      to the fixture [29]; an absent publication directory serves the fixture,
      and so does one that exists but holds no bundle [28] [55]; the published-bundle response carries `cache-control: no-cache`
      [42]. (Req: snapshot-export — The served URL answers from the published
      bundle)
- [ ] 8.2 Write the revalidation tests: a matching `If-None-Match` is
      answered 304 with an empty body [40]; a republished bundle answers 200
      with a different ETag [41]; a byte-identical re-export still answers 304
      [50]; the first publication after the fixture was served answers 200 with
      a new ETag, rather than reusing the fixture's [56]. (Req: snapshot-export
      — The served snapshot is revalidated by ETag)
- [ ] 8.3 Move `/snapshot.json` out of the prebuilt route map into a handler
      that resolves its source per request, leaving the font routes static.
      (Req: snapshot-export — The served URL answers from the published
      bundle)
- [ ] 8.4 Implement the ETag as a hash of the served bytes, cached against the
      resolved source path and `mtimeNs` so it is paid once per publication
      rather than per request and cannot survive a change of source, and the 304 answer to a matching `If-None-Match`. (Req:
      snapshot-export — The served snapshot is revalidated by ETag)
- [ ] 8.5 Write the end-to-end test: staging seeded from the fixture builds,
      exports, and the served bundle is accepted by the client's loader [45].
      (Req: snapshot-export — The served URL answers from the published
      bundle / The exported bundle is what the client accepts)
