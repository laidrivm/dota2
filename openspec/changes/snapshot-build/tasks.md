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
      total zero yields no rows and no division [53]; three positions whose
      picks do not divide exactly still sum to 1 within the tolerance the
      criterion is written to [65]. (Req: snapshot-build — Position shares are
      a distribution over a hero's positions)
- [x] 2.2 Write the sufficiency tests at both thresholds: a hero-position at
      `n_eff = 500` is sufficient and at 499 is not [10]; a hero summing to
      1000 is sufficient and to 999 is not [11]; a hero the window never
      picked has no positions to sum and is not sufficient [66]. (Req:
      snapshot-build — Sufficiency thresholds decide what may be suggested)
- [x] 2.3 Implement the position-share normalisation, returning an empty map
      before dividing when a hero's picks total zero, and emitting no row for a
      position with no picks. (Req: snapshot-build — Position shares are a
      distribution over a hero's positions)
- [x] 2.4 Implement the two sufficiency thresholds as one predicate per
      scope, so neither can drift from its stated value. (Req: snapshot-build
      — Sufficiency thresholds decide what may be suggested)
- [x] 2.5 Write the unmeasured-component tests: staging holding no side and
      no phase rows leaves every hero row carrying 0 for both, and the
      snapshot publishes [58]; staging holding side rows for every hero but
      one fails validation [59]; a component measured for every hero, one of
      whose blended deltas is exactly 0, publishes — so the rule cannot be
      passing by treating a measured neutral as unmeasured [60]; staging
      measuring side for every hero while holding no phase rows leaves the
      side deltas standing and zeroes phase alone, so a verdict taken once
      per snapshot rather than per component fails [61]. The verdict is all
      this group can assert: each of the four names a `published` or `failed`
      outcome, which group 4 owns, so the four criteria stay uncited until
      4.1b and 4.2b reach them. (Req: snapshot-build — An unmeasured component
      is zero for every hero)
- [x] 2.6 Implement the per-component measured/unmeasured decision, taken
      once for the whole snapshot from whether staging holds any row for the
      component. The zero to write is stated in that predicate's contract
      rather than exported as a constant: 0 is the identity `src/model.ts`
      already reads as no contribution, not a value anyone may retune. (Req:
      snapshot-build — An unmeasured component is zero for every hero)

## 3. Persistence

The schema, the `Bun.SQL` edge and the CI job that exercises them were this
group's first three tasks and are now `snapshot-ingest`'s group 4. They closed
no criterion here, every group of that change writes through them, and it can
no longer run before this one. This group takes all three as given.

The suite splits three ways under the file cap — `build.test.ts` for what a
build produces, `build-prior.test.ts` for the previous patch's contribution,
`build-pairs.test.ts` for the symmetry, over a shared `build.fixture.ts`. The
split was verified by the full describe path of every case, not by their
count.

Three pull requests, `feat/snapshot-build-3a`, `-3b`, `-3c`: as one step it
measured 798 lines against a budget that fails at 800. The seam is the one
`design.md` already draws — 3a is the row assembly, pure and exercised
without a database, and 3b is the SQL edge around it with the
database-backed cases. It is the seam worth taking rather than the cheapest:
unsplit, `rows.ts` was reached only by a suite a plain `bun test` skips,
which is *Arithmetic testable without a database* read backwards. 3.3a
accordingly ships before 3.1 and 3.2, which are 3b's.

3c is a widening the group took mid-flight rather than a third slice of the
plan: a review found that a stored delta of 0 cannot say whether a component
was measured and neutral or never measured, and the fix needs two columns on
`snapshots` — the schema this change otherwise consumes. It is its own pull
request because it carries a schema change and a proposal amendment, which a
reviewer reads on different terms from a staging read, and because 3b with it
measured 801 lines against a budget that fails at 800.

- [x] 3.3c Record on each snapshot which components its staging measured, and
      read `wr_old` for a component only where the predecessor measured it: a
      component the predecessor never measured is no prior at all, where one
      it measured at exactly neutral is [84], taken over both components
      because the read back guards each on its own; the verdict written is the
      pair of components staging held rather than one answer for the snapshot
      [85]; a run that cannot read the staging its verdict comes from leaves no
      snapshot rather than one marked `failed` [86]; and a `snapshots` table
      predating the two columns gains them with every existing row reading
      unmeasured [87]. Amend the proposal's schema non-goal to state the
      exception, and the delta spec to carry the criterion and what the read's
      new position leaves behind. (Req: snapshot-build — An unmeasured
      component is zero for every hero / A snapshot is published only after it
      validates)

- [x] 3.3a Assemble the rows a snapshot stores from staging and the previous
      patch's deltas, with no database in front of it: a hero's shares,
      deltas and thresholds [72] [73]; an unmeasured component 0 on every
      hero while a measured one stands, which is the row-level half of [58]
      and [61], and a measured component this hero has no row for [74]; a
      pair's two staged directions as two stored rows that cancel [75], read
      from the lower id's side [76], as one synergy row [77], and as none
      where there is nothing to blend [78], and pulled towards the winrate the
      previous patch published, so a `wr_old` key its writer and its reader
      spell differently fails [80]. The build instant is counted on the UTC
      timeline, a `detected_at` anchors at midnight there [67], and an instant
      before the patch's own release counts no days rather than negative ones
      [79].
      (Req: snapshot-build — Patch blending with a decaying prior / Stored
      pair statistics carry their symmetry / An unmeasured component is zero
      for every hero)
- [x] 3.1 Write the determinism tests: two builds over identical staging and
      the same build instant produce statistics rows equal field by field
      [25]; a build completes while its database answers and every *other*
      network call is stubbed to throw [26]; a blend reads `wr_old` from the
      predecessor patch's newest published snapshot [51]; the oldest patch
      records no prior patch and no weight [68];
      a prior decayed to 0 records no prior patch either [69]; a predecessor
      that never published leaves the blend to the current patch alone [70];
      a patch no row holds is refused by name [71]; a patch nothing was staged
      for writes no statistics rows and does not raise [81]; a matchup's
      `wr_old` reaches the blend from the previous snapshot, so a pair key the
      writer and the reader spell differently fails [82], and a side's does
      too, staging holding side and phase rows here although no pull fills
      them [83]; a build that raises after creating its row leaves that row
      `failed` rather than `building` [23], reached through a stub because no
      staging row the schema admits can make the statistics write fail. (Req:
      snapshot-build — The build reads its own database and nothing else /
      Patch blending with a decaying prior)
- [x] 3.2 Write the symmetry tests: `(a,b)` and `(b,a)` matchup rows carry
      `advantage_adj` summing to 0 [21]; `hero_synergies` holds `(a,b)` for
      `a < b` and no mirrored row [22]. (Req: snapshot-build — Stored pair
      statistics carry their symmetry)
- [x] 3.3b Implement the staging read and the statistics write, taking the
      build instant as an argument, writing it to `created_at`, reading
      `wr_old` from the predecessor snapshot retention holds for that purpose,
      and writing 0 for a component 2.6 reports unmeasured. (Req:
      snapshot-build — The build reads its own database and nothing else /
      Stored pair statistics carry their symmetry / An unmeasured component is
      zero for every hero)

## 4. Lifecycle, validation and retention

Four pull requests, `feat/snapshot-build-4a` through `-4d`: as one step the
group closes ten acceptance criteria, and `change-slicing` splits a step that
would close four or more. The cut is by what refuses a snapshot, each check
being reached by its own staging and read by its own cases. 4a is the
transition and the two checks a count and a sum decide, 4b the two a bound and
a missing row decide, 4c the four outcomes *An unmeasured component is zero
for every hero* names — assertions over what 4a and 4b already do — and 4d
retention, which is a requirement of its own with no validation in it.

- [x] 4.1a Write the lifecycle tests: the first snapshot ever built publishes
      with no earlier one to compare hero counts against [15]; a build
      satisfying every check publishes and is newest [16]; a failed validation
      leaves the previously published snapshot newest [24]; and the count that
      refusal rests on comes from the newest *published* snapshot and from no
      other, so neither a failed snapshot's rows nor a reversed ordering can
      supply it [88]. The hero count is what refuses [24]: shares are
      normalised from a hero's own picks, so no staging the schema admits
      produces a hero whose shares sum to anything but 1, and the sum the
      criterion names is asserted on rows handed to the check directly
      instead. (Req: snapshot-build — A snapshot is published only after it
      validates)
- [x] 4.1b Write the outcome tests each of [58], [60] and [61] names, group 2
      having asserted only the verdict behind them and group 3 only the row it
      writes: a snapshot measuring neither component publishes with both
      zeroed throughout [58]; one measured and the other not publishes with
      the measured deltas standing [61]; and a hero whose measured side delta
      is exactly 0 publishes beside a hero whose is not [60] — the same number
      an unmeasured component writes, which is the whole reason the verdict
      reads whether a row exists rather than what it holds. (Req:
      snapshot-build — An unmeasured component is zero for every hero)
- [x] 4.2a Write the boundary tests for the two checks 4a implements: a hero
      count equal to the last published passes and one below fails [18];
      shares within 1e-6 pass and 0.8 fails [19]. Both are read without a
      database, the boundaries being a count and a sum no staging fixture
      hits exactly. (Req: snapshot-build — A snapshot is published only after
      it validates)
- [x] 4.2b Write the boundary tests for the two checks 4b implements: an
      `adj` of exactly ±25 pp passes and beyond fails [20], read off a column
      carrying the delta token in the middle of its name rather than at the
      end; a hero the reference tables know but staging never picked has no
      position rows and still passes [47]; staging holding side rows for every
      hero but one fails validation, taken to the `failed` status the criterion
      names and driven through the phase component so the second of the two
      call sites moves [59]; and a part staging holds for no hero
      at all publishes rather than failing, and stands at 0 on every
      hero row while the parts staging did measure keep their deltas [89],
      which is the reading the delta spec gains here — the parts checked are the ones staging holds,
      never a list the check carries. (Req: snapshot-build — A snapshot is
      published only after it validates / An unmeasured component is zero for
      every hero)
- [x] 4.3 Write the retention tests: a thirty-first snapshot leaves 30 rows,
      removes the oldest by `snapshot_id`, and leaves no statistics row behind
      it in any table carrying `snapshot_id` [17]; 30 snapshots built inside
      one day still leave the previous patch's newest published one, whose
      `wr_old` the prior still weighs [48]; and the same 30 built past the
      window that prior decays over drop it with the rest [90], which is the
      reading the delta spec gains here — without it an exemption covering
      every patch's newest published snapshot passes both other cases; and
      thirty *failing* builds do not carry off the last published snapshot
      [91], the count being taken over snapshots at any status; and two
      patches whose priors are both still weighing each keep the snapshot
      theirs would read, though only one of them is the patch being built
      [92]. (Req: snapshot-build — Snapshot retention)
- [x] 4.4a Implement the `published` transition and the two checks a count
      and a sum decide before it: the hero count against the newest published
      snapshot, and each hero's position shares against its own rows. The
      `failed` a *raise* reaches is 3b's, with [23] and the stub that produces
      it; what starts here is the `failed` a validation reaches. (Req:
      snapshot-build — A snapshot is published only after it validates)
- [x] 4.4b Implement the remaining two checks: every stored `adj` within its
      bound, scoped by the schema's own mark for a stored delta rather than by
      a list of columns, and a measured component staging holds no row for on
      some hero, scoped by the parts staging holds rather than by a list of
      parts.
      (Req: snapshot-build — A snapshot is published only after it validates /
      An unmeasured component is zero for every hero)
- [x] 4.5 Implement retention as a cascade from `snapshots`, so no statistics
      row can outlive its snapshot, exempting from the count the newest
      published snapshot of any patch a blend may still read `wr_old` from —
      which the requirement states in the plural and which is computed from the
      decay rather than from the patch this build happens to be for — a build
      of one patch must not carry off what a build of another would read. And
      the newest published snapshot itself, which `snapshot-export` renders
      from and a run of failing builds would otherwise walk out of the count.
      In the transaction that settles the status, so the statistics, the
      status and the deletion commit or roll back together — the `snapshots`
      row being outside it, which is what a rolled-back build leaves to be
      marked `failed`. In `retention.ts`, which is where the
      per-file cap cut it and where the count and its exemptions are one
      decision.
      (Req: snapshot-build — Snapshot retention)

## 5. Rendering the bundle

Three pull requests, `feat/snapshot-build-5a`, `-5b`, `-5c`: as one step the
group closes six acceptance criteria where `change-slicing` allows three. The
cut is by requirement, each step taking one — selection, the camelCase
boundary, the pair matrices. The render itself is whole in 5a, because half a
bundle is not a bundle the client accepts and a step shipping one would be the
horizontal slice that requirement rejects; 5b and 5c are the cases that close
their criteria over what 5a already renders, as 4c was over 4a and 4b.

- [x] 5.1 Write the selection tests: with no `published` snapshot the export
      raises rather than rendering [27]; a newer `building` snapshot is not the
      one exported [30]; and the newer of two *published* snapshots is, which
      [30] cannot say — leaving one at `building` makes the ordering
      unobservable [93]. Half of [27] is closed here and half is not: nothing
      in group 5 writes a file, so "writes no file" is true of it by having no
      write at all, and the non-zero exit is the entry point's answer to the
      raise — both arrive with 7.2's publication. (Req: snapshot-export — The
      bundle is rendered from the newest published snapshot)
- [x] 5.2 Implement the key check and write the shape tests. The criterion
      says the export *fails* on a key of neither kind, so this is a check the
      render runs before returning, not cases alone: every key at every depth
      is a camelCase name or a decimal integer string, so `patch-id` and
      `PatchId` fail as `patch_id` does, and an undeclared key fails too [34];
      `patch.isMajor` is a JSON boolean and `createdAt` an ISO 8601 timestamp
      carrying an offset, while `patch.detectedAt` stays the bare calendar
      date the shipped contract already holds [35]. Three rules, each with a
      case that fails when it alone is removed — which took writing the
      spelling case against what the refusal *says*, the declared set having
      refused those keys anyway and hidden the pattern. A key the contract
      declares and the render dropped fails too: a check over what is present
      cannot see what is absent. The id keys are read at every bundle root the
      named checks do not descend into, scoped by that exemption rather than
      by naming the two matrices — a matrix the contract grows is scanned by
      being there, and a root added to the declared set and left out of the
      exemption reaches the id check and fails, its keys being names and not
      integers. The cases reach both levels of both matrices; dropping the
      level that walks a matrix row left every one of them passing until they
      did. The declared sets are the contract in a
      second form, unavoidably — the interfaces are erased before the bundle
      exists — so the shipped fixture is walked through the check, and a key
      added to `src/types.ts` and the fixture without a line here fails.
      Value types are 6.4's. The two timestamp keys are asserted as the
      instants they are rather than as patterns they fit — a pattern passes
      for `9999-99-99` — and the UTC slice behind `patch.detectedAt` has a
      case of its own with the zone pinned, since a runner in UTC cannot tell
      a date read off the machine's calendar from one read off the UTC
      timeline. (Req: snapshot-export — The bundle's keys are camelCase)
- [x] 5.3 Write the matrix tests: a synergy stored once appears under both
      hero ids with the same value [36]; `matchups[b][a]` negates
      `matchups[a][b]` exactly, the build having negated one number rather
      than computing the pair twice [37]; both matrices are keyed by every
      hero of the pair at both levels, which is what "full" means and is the
      only case that would see a spurious key — a hero against itself
      included, which the schema refuses to store and nothing otherwise stops
      the export deriving; and a hero's `positions` omits every position
      it was never picked on [38]. The two directional cases each carry a
      second assertion that the value is not 0, without which a matrix of
      zeros — or of absent keys read as `undefined` on both sides — satisfies
      the symmetry; the other two read key sets, where no value is in
      question. Mirroring is
      also read at three heroes, which is the smallest case where the loop
      meets a key its own pass created; at two the only id it creates is one
      the entry snapshot never held, so that half went unexercised. (Req:
      snapshot-export — Pair statistics are expanded into full matrices)
- [x] 5.4 Implement the render: select the newest published snapshot, rename
      keys to camelCase at that boundary, and expand the stored pairs into
      full matrices. Written out field by field rather than derived from the
      column names, the two spellings agreeing on nothing — `short_name` is
      `short`, `phase_adj_1` is `p1`. `stabilizing` ships as `false`, the
      working stub at group 6's seam: an absent key would fail the bundle the
      client accepts, where a wrong one publishes and is replaced. (Req:
      snapshot-export — The bundle is rendered from the newest published
      snapshot / The bundle's keys are camelCase / Pair statistics are
      expanded into full matrices)

## 6. The stabilizing flag and the client's acceptance

- [x] 6.1 Write the stabilizing tests: true one day short of `t_max` after a
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
