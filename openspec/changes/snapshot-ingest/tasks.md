# The STRATZ ingest — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). The
bracketed numbers are that run's idea numbers, so every one of its 62 ideas is
traceable to the group that closes it. Numbers 63 to 88 are the reviews' own,
added where a finding named a case the run had missed — 76 to 81 during apply,
by the diff-mode `/zombies` run and CodeRabbit, and 85 to 88 with the group
this list had left out. Numbers 89 to 94 came from neither: they are the two
readings this change left open — which heroes a run stores a total for, and
where the window it covered is written down — settled after groups 1 to 11 had
merged. Numbers 95 to 101 are the `/zombies` run over that settlement, 99 and
100 having first been gaps in the requirement rather than in its tests. That
run also named three cases that turned out to be existing criteria applied
rather than behaviour of their own; they are written into the tasks under the
criterion they belong to and carry no number, because a number here promises a
criterion and `openspec/config.yaml` is what makes that a rule.

Thirteen groups on `feat/snapshot-ingest-1` … `-11c` … `-12`, in order, and at
least that many pull requests. Each group is measured against
`bun run diff-budget` when it is cut and splits again if it is over — group 11
did, on the seam between the write and the run that fills it, shipping as
`-11a` and `-11b`, and group 11c is the later arrival that takes their suffix
rather than a number, so that no merged group is renumbered. The groups below
are sized to land under the warn threshold, which is what keeps a reviewer's
pass over any one of them short.

This change owns the schema, the database edge and the CI job that exercises
it — group 4's three tasks, moved here from `snapshot-build`, which closed no
criterion with them and can no longer run before this change. Group 12 is the
exception in the other direction: the entry point calls `snapshot-build`'s
build and export, so it lands after that change rather than before it. Groups 1
to 3 add a module the application does not yet call; group 12 is the entry
point that calls all of them. The served snapshot stays the fixture until a run publishes
over it, which is `snapshot-build`'s route change and not this one's.

## 1. The client and the gate it clears

- [x] 1.1 Write the transport tests: a run with `STRATZ_API_KEY` unset fails
      before any request and names the variable [1]; an empty value is treated
      as unset rather than sent as an empty Bearer [2]; a successful request
      carries both the `Authorization` and the `User-Agent` headers [3]; the
      request posts the query and its variables to the endpoint as a GraphQL
      body [76]; the key appears in no error message, log line or thrown stack
      [10]. (Req: snapshot-ingest — Every request carries both halves of the
      gate)
- [x] 1.2 Implement the client: the two headers, the key read once at
      construction, the queue that holds a request while eight sit inside the
      last second, the 30-second per-attempt timeout, the retry policy with the
      quota rule ahead of it, and the classification that reads the body before
      deciding what failed. The whole module lands in this group rather than
      growing over groups 2 and 3: the transport cannot be exercised at all
      without the paths that surround it, and a client shipped without its
      retry policy is one no later group could call. (Req:
      snapshot-ingest — Every request carries both halves of the gate / A
      response is classified by its body, not its status alone / A run stays
      inside the quota the API states / A request is retried only where
      retrying can succeed)
- [x] 1.3 Add `.env.example` naming every variable a run reads, with no value
      for any of them, confirm `.gitignore` still excepts it from the `.env*`
      wildcard, and rule its extension in `scripts/file-size.test.ts`, which
      fails until somebody decides whether a new type is capped. (Req: none —
      configuration, closing no criterion)

## 2. The quota and what a response means

- [x] 2.1 Write the pacing tests: eight requests issued back to back all go
      out within one second [4]; the ninth of nine waits until a second has
      elapsed since the first [5]; requests already a second apart are not
      delayed further [6]; exactly eight inside one second leaves the eighth
      undelayed [7]; a response reporting zero remaining in any rate-limit
      window ends the run with no further request [16]; a remaining header that
      is blank or carries no number does not end the run [77]; a negative
      remaining count does [78]; a later request on the same client is refused
      without reaching the network, the verdict stopping the run rather than
      the request that met it [83]. (Req: snapshot-ingest
      — A run stays inside the quota the API states)
- [x] 2.2 Write the classification tests: a `403` carrying `text/html` reports
      an unmet challenge naming the `User-Agent` [11]; a `403` carrying no
      content type at all reports the same [79]; a `403` carrying JSON reports
      the key as rejected [12]; a `200` whose body carries a non-empty
      `errors` array fails the run and writes no staging row from it [17]; a
      `200` whose body does not parse is retried rather than read as a rejected
      query, and fails once its attempts are spent [80].
      (Req: snapshot-ingest — A response is classified by its body, not its
      status alone)

## 3. Retrying and abandoning

- [x] 3.1 Write the retry tests: the three delays between four attempts are
      1s, 2s and 4s [8]; the fourth failing attempt issues no fifth [9]; a
      `500` then a `200` returns the second body and continues [13]; a `400`
      is attempted exactly once [14]; four consecutive `429`s **with quota
      remaining** end the run failed [15]; a `429` **reporting zero remaining**
      is attempted exactly once, the quota rule taking precedence over this one
      [63]; a window reported spent on a *later* attempt stops the run there,
      the verdict being read on every attempt rather than the first [84]. (Req: snapshot-ingest — A request is retried only where retrying
      can succeed / A run stays inside the quota the API states)
- [x] 3.2 Write the timeout tests: an attempt open for 30 seconds with no
      complete response is abandoned and retried rather than waited on [71]; a
      response whose status arrives but whose body never finishes streaming is
      abandoned on the same bound, since what is bounded is a complete response
      [81]; four attempts all abandoned at the timeout end the run failed, the
      entry point still reaching its exit [72]. (Req: snapshot-ingest — A
      request is retried only where retrying can succeed)

## 4. The schema and the database edge

Moved here from `snapshot-build`, whose group 3 held these three as
infrastructure closing no criterion. They come first among the database groups
because every group below writes through them, and `snapshot-build` now takes
them as given rather than adding them.

- [x] 4.1 Add `schema.sql` — reference, snapshot and staging tables per
      data-model §3 — applied idempotently on connect, with a `ponytail:`
      comment naming the missing migration ledger and the `ALTER` that would
      bring it, and the `snapshot_id` column carrying the reason it is exempt
      from the UUIDv7 rule. (Req: none — this group is the seam the later ones
      write through, and closes no criterion by itself)
- [x] 4.2 Add the `Bun.SQL` connection edge and make the integration suite
      skip when no connection string is present, so the pre-push run stays
      offline, and add the connection string to `.env.example`. (Req: none —
      infrastructure, as 4.1)
- [x] 4.3 Add a CI job running the database-backed suite against a `postgres`
      service container, supplying its connection string and failing when the
      suite skips — a suite that skipped and one that passed report the same
      green otherwise. (Req: none — infrastructure, as 4.1)

## 5. Patch detection and the hero reference

- [x] 5.1 Write the patch tests: a first run against an empty `patches` table
      inserts the current patch [39]; a patch the table lacks is inserted with
      the source's release instant rather than the run instant [40]; the
      current patch is the held one with the latest `detected_at` not after
      the run instant, so a listed future release does not become current
      [41]; a name with no trailing letter sets `is_major` true and one ending
      in a letter sets it false with the letter stripped for `base_version`
      [42]; a second run does not rewrite a held patch's `detected_at` [43].
      (Req: hero-reference — Patches are detected from a source that is
      current)
- [x] 5.2 Write the patch-source failure tests: a patch list unreachable after
      its retries fails the run before any staging row is written [67]; a list
      parsing to no patch, and one whose newest entry carries no name or no
      release instant, each fail the run naming which, without falling back to
      the patch `patches` already holds [68]. (Req: hero-reference — Patches
      are detected from a source that is current)
- [x] 5.3 Write the hero-upsert tests: a hero the tables lack is inserted with
      `first_seen_at` set to the run instant [45]; a hero a later response
      omits keeps its row and its original `first_seen_at` [51]; a hero whose
      display name changed takes the new name and keeps `first_seen_at` [52];
      a run failing after the upsert leaves those rows, and a repeat leaves
      them unchanged [66]. (Req: hero-reference — A hero is upserted and never
      removed)
- [x] 5.4 Implement patch detection against OpenDota's
      `/api/constants/patch`, mapping `name` to the patch name and
      `base_version` and `date` to `detected_at`, including the major/letter
      split, the insert-once rule and the three failure paths, with a comment
      naming why the statistics API's own version list is not read. (Req:
      hero-reference — Patches are detected from a source that is current)
- [x] 5.5 Implement the hero upsert with no delete path at all, so removal is
      absent rather than guarded. (Req: hero-reference — A hero is upserted
      and never removed)

## 6. Mirrored images and the route that serves them

- [x] 6.1 Write the mirroring tests: a first run against an empty directory
      leaves a file for every hero [44]; a run with every file present issues
      no image request [46]; every stored `icon` is a path beginning with `/`
      and never an absolute URL to another origin [47]; a new hero whose image
      fetch fails ends the run failed with no `icon` naming an absent file
      [53]; a hero already mirrored survives a failed refetch, nothing being
      refetched [54]; reads taken repeatedly across the ingest writing an image
      answer the complete file or a `404` and never part of one [69]. (Req:
      hero-reference — Hero images are mirrored to the application's own
      origin)
- [x] 6.2 Write the route tests: a mirrored image answers `200` with
      `content-type: image/png` and the immutable cache header [48]; an unheld
      name answers `404` with an empty body [49]; a request naming a segment
      outside the mirror directory cannot reach a file outside it [50]; a file
      written after the server started is served without a restart [55]. (Req:
      hero-reference — The mirrored images are served from the application's
      origin)
- [x] 6.3 Implement the mirror: fetch once per hero into a temporary name the
      route cannot serve, move it to its final name only once the whole file is
      on disk, skip a name already present, and fail the run only where a hero
      has no file at all. (Req: hero-reference — Hero images are mirrored to
      the application's own origin)
- [x] 6.4 Add the `/icons/*` route to `static-routes.ts`, resolved from the
      directory listing per request rather than prebuilt, since the job writes
      that directory while the server is running. (Req: hero-reference — The
      mirrored images are served from the application's origin)

## 7. The hero reference source

Nothing above reads the heroes it upserts and mirrors: groups 5 and 6 each take
a list, and this group is what supplies one. It was missing from this list
rather than deferred by it, which is why its ideas are numbered past the
proposal run's.

- [x] 7.1 Write the hero-source tests: a hero is carried as the id, the display
      name, the slug, and the image location that slug names [85]; a response
      parsing to no hero fails the run naming that, rather than upserting
      nothing [86]; a response the transport gave up on fails the run before a
      hero is written [87]; an entry carrying no id or no slug fails the run
      naming it, rather than upserting a hero the mirror cannot name a file for
      [88]. (Req: hero-reference — The hero reference is read whole or the run
      fails / A hero the source describes incompletely)
- [x] 7.2 Implement the hero source: one `constants.heroes` request through the
      client group 1 ships, mapped to what the upsert and the mirror each take,
      with the content delivery network's path carrying the measurement behind
      it — every slug the source returns answers under that path, so no second
      vendor is asked where a hero's image lives. (Req: hero-reference — The
      hero reference is read whole or the run fails / A derived image
      location)

## 8. The meta pull

- [x] 8.1 Write the meta-window tests: a patch seven whole UTC days old is
      pulled over exactly seven days and each staging row is the sum over them
      [20]; a patch with no complete day behind it is pulled over the single
      most recent complete day rather than none [18]; a hero the source returns
      no rows for produces no position rows rather than rows of zeros [19];
      days returned out of order sum to the same row as days in order [21];
      five position pulls produce one row per hero and position with none
      overwriting another [22]; the day boundary is counted in UTC, so a run
      instant whose local date is a day ahead does not add a day [26]; the day
      the run instant falls inside is not part of the window [64]; a patch 150
      days old is pulled over thirty days and the run records that the source
      bound the window, not the patch [70]. (Req:
      snapshot-ingest — The meta is pulled by day over the current patch's
      life)
- [x] 8.2 Write the meta-request tests: the request names the ranked All Pick
      game mode and a response covering every mode is rejected rather than
      accepted in its place [27]; the request names the Divine and Immortal
      brackets [28]. (Req: snapshot-ingest — The meta is pulled by day over
      the current patch's life)
- [x] 8.3 Implement the meta pull: one request per position over the
      UTC-normalised, end-exclusive window capped at the thirty days the source
      serves, the game mode and brackets named at one site, summed into staging
      rows, and the cap reported when it bound. (Req: snapshot-ingest — The
      meta is pulled by day over the current patch's life)

## 9. The pair pull

- [x] 9.1 Write the pair-window tests: a patch live for exactly four complete
      weeks pulls four [23]; one live for twelve pulls exactly four and the
      run records which four [24]; one live for two pulls two, and no week
      preceding the patch is requested [25]; a week whose span contains the
      current patch's `detected_at` is attributed to the current patch [31].
      (Req: snapshot-ingest — Pair statistics are pulled per hero over at most
      four weeks)
- [x] 9.2 Write the pair-response tests: the request asks for every other hero
      so the response carries one opponent and one ally row per other hero
      rather than the endpoint's default page [29]; a response short of one
      row per other hero fails the run rather than writing a partial matrix
      [30]; a response carrying a surplus row, a duplicated opponent or ally,
      or a hero the reference tables do not hold fails on the same terms — the
      criterion fixes *one* row per other hero, not at least one [82]. (Req:
      snapshot-ingest — Pair statistics are pulled per hero over at most four
      weeks)
- [x] 9.3 Implement the pair pull: one request per hero per week over the
      lesser of four and the weeks the patch has been live, asking for every
      opponent, summed across the weeks, and reporting the weeks covered.
      (Req: snapshot-ingest — Pair statistics are pulled per hero over at most
      four weeks)

## 10. Contest rate and the ban pull

- [x] 10.1 Write the contest tests: a hero whose match count equals the
      window's match total with no bans has a rate of 1 [32]; two heroes with
      equal picks rank by bans [33]; the denominator is the summed hero counts
      divided by ten, so counts summing to a non-multiple of ten still yield
      the stated ratio rather than a rounded one [34]; a window whose matches
      are 0 gives every hero 0 with no division attempted [35]. (Req:
      snapshot-ingest — Contest rate is a share of the window's matches)
- [x] 10.2 Write the ban-pull tests: the days requested are the meta window's
      and one request asks for every hero [73]; a ban request failing after its
      retries fails the run rather than storing a contest rate from picks alone
      [74]; a hero-and-day pair the ban response carries no row for contributes
      zero bans and does not fail the run [75]. (Req: snapshot-ingest — Contest
      rate is a share of the window's matches)
- [x] 10.3 Implement the ban pull as one request over the meta window's days,
      since the pick counts carry no ban dimension: pass the required `heroId`
      as a constant with the comment saying it does not filter, convert the
      window to `banDay`'s day numbers rather than reusing the meta pull's Unix
      timestamps, read `matchCount` as the ban count, and sum an absent pair as
      zero. (Req: snapshot-ingest — Contest rate is a share of the window's
      matches)
- [x] 10.4 Implement the contest formula over the counts the meta and ban pulls
      return, with the divisor carrying the comment naming why it is exact and
      the ratio carrying the one naming why it is not. (Req: snapshot-ingest —
      Contest rate is a share of the window's matches)

## 11. The staging write

- [x] 11.1 Write the staging tests: two runs over identical responses **and the
      same run instant** leave identical rows rather than doubled counts [36];
      two runs whose instants fall either side of a UTC day boundary cover
      different days and leave different rows [65]; a run failing after the
      meta pull produced rows leaves staging holding exactly its pre-run rows
      [37]; a run writing a newer patch leaves the previous patch's rows and
      removes anything older [38]. (Req: snapshot-ingest — A run leaves
      staging whole or leaves it untouched)
- [x] 11.2 Implement the staging write as a delete-then-insert inside one
      transaction, taking the run instant as an argument, with the retention
      that drops anything older than the previous patch. (Req: snapshot-ingest
      — A run leaves staging whole or leaves it untouched)

## 11c. Every reference hero gets a total

A later arrival, and it runs **before** `snapshot-build` rather than after
group 11: 3a's fixtures seed staging, so a build written against staging that
holds 126 heroes where the reference holds 127 would encode the defect in the
tests that are meant to catch it.

- [ ] 11c.1 Write the zero-pick tests: a hero the meta response carries no row
      for, but the ban response does, reaches staging with `matches` 0, `wins`
      0, a contest rate from those bans alone, and no position row, the
      window's matches not being 0 [89]; a hero
      neither response carries reaches staging with contest rate 0 over a
      window whose matches are not 0 [90]; a run's `staging_hero_stats` rows
      number what the reference holds [91]. (Req: snapshot-ingest — Contest
      rate is a share of the window's matches)
- [ ] 11c.2 Write the edge tests this run's `/zombies` named: an empty
      reference yields no row and attempts no division [95]; a hero with bans
      and no picks over a window whose matches are 0 rates 0 rather than
      `Infinity`, which is newly reachable now that such a hero gets a row
      [96]; a zero-pick row satisfies `staging_hero_stats`'s
      `CHECK (wins BETWEEN 0 AND matches)` where both bounds are 0 [97]; a
      hero the meta response names and the reference does not still fails the
      run, which building the row set from the reference could silently drop
      [98]. (Req: snapshot-ingest — Contest rate is a share of the window's
      matches)
- [ ] 11c.3 Re-aim the two tests that pin the reading being reversed:
      `contest.test.ts`'s *a hero banned but never picked in the window gets no
      row* inverts, its comment saying the reading was unsettled deleted with
      it; *no hero at all yields no row and no division* moves off the empty
      meta response and onto an empty **reference**, which is what "no hero at
      all" now means and is [95] above — an empty meta response over a
      non-empty reference yields a zero row per reference hero, not none, and
      is [90] and [91]. (Req: snapshot-ingest — Contest rate is a share of the
      window's matches)
- [ ] 11c.4 Implement the totals over the hero reference rather than over the
      meta response: build the row set from the heroes the reference returned,
      fill each from the meta rows it has, and leave the position rows built
      from the meta response alone. (Req: snapshot-ingest — Contest rate is a
      share of the window's matches)

## 12. The job

This group alone runs **after** `snapshot-build`. The entry point calls the
ingest, then that change's build, then its export, so it is the one place where
the two changes' order reverses: groups 1 to 11c land first, `snapshot-build`
follows them, and this group closes over both.

- [ ] 12.1 Write the outcome tests: all three steps succeeding exits zero and
      the served bundle is the one just written [56]; the failure report names
      which of the three failed [57]; a failing ingest builds no snapshot,
      leaves the previous bundle served and exits non-zero [58]; a build
      ending `failed` does not run the export and exits non-zero [59]; a
      failing export writes no bundle, leaves the previous one served and
      exits non-zero [60]; the export invoked alone renders the newest
      published snapshot and exits zero with no request to the statistics API
      [61]. (Req: snapshot-ingest — The job carries a run to one outcome)
- [ ] 12.2 Implement the entry point: ingest, then build, then export,
      returning which step failed and exiting non-zero when one did, with the
      export — and only the export — also invocable on its own. (Req:
      snapshot-ingest — The job carries a run to one outcome)
- [ ] 12.3 Write the coverage tests: a run whose meta window was the patch's
      own span records that window's first and last day, that the cap did not
      bind it, and the weeks the pair pull covered [92]; a run over a patch
      live for 150 complete UTC days records that the cap bound the window and
      the thirty most recent complete days as the window [93]; a snapshot no
      entry point completed carries null coverage and is not failed for it
      [94]; a build ending `failed` still carries what its run covered [99];
      an export failing after the write leaves the coverage standing [100].
      (Req: snapshot-ingest — What a run covered is recorded on the snapshot
      it built)
- [ ] 12.3a Write the cap-seam test: a patch live for exactly thirty complete
      UTC days records that the cap did **not** bind it [101], which [93] does
      not reach — it tests 150 days, where the two windows differ. (Req:
      snapshot-ingest — What a run covered is recorded on the snapshot it
      built)
- [ ] 12.3b Cover two degenerate windows under [92], both of them that
      criterion applied rather than behaviour of their own: a patch detected
      today records a window whose first and last day are the same, and a
      patch live for less than one complete week records an empty weeks list
      beside a non-empty meta window. (Req: snapshot-ingest — What a run
      covered is recorded on the snapshot it built)
- [ ] 12.3c Extend `ingest.test.ts`'s *a run reports the window and the weeks
      it covered* [36], which asserts only what `ingest` returns, so that it
      also asserts the `snapshots` row carries it once the entry point has run
      — [92] again, the criterion being about the record and not the return.
      (Req: snapshot-ingest — What a run covered is recorded on the snapshot
      it built)
- [ ] 12.4 Add the coverage columns to `snapshots` beside `prior_weight` —
      the meta window's first and last UTC day, whether the source's cap bound
      it, and the weeks the pair pull covered — all nullable, with the comment
      naming why the build cannot fill them. (Req: snapshot-ingest — What a
      run covered is recorded on the snapshot it built)
- [ ] 12.5 Implement the write: the entry point records what the ingest
      returned on the row the build produced, before the export runs. (Req:
      snapshot-ingest — What a run covered is recorded on the snapshot it
      built)
- [ ] 12.6 Write the end-to-end test: a seeded source runs ingest → build →
      export and the served bundle is accepted by the client's loader [62].
      (Req: snapshot-ingest — The job carries a run to one outcome)
