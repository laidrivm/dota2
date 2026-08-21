# The STRATZ ingest — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). The
bracketed numbers are that run's idea numbers, so every one of its 62 ideas is
traceable to the group that closes it. Numbers 63 to 69 are the review's own,
added where a finding named a case the run had missed.

Six groups, so six pull requests on `feat/snapshot-ingest-1` … `-6`, in order.
Groups 1 to 3 add modules the application does not yet call; group 6 is the
entry point that calls all of them. The served snapshot stays the fixture until
a run publishes over it, which is `snapshot-build`'s route change and not this
one's.

## 1. The client, its quota and its failure paths

- [ ] 1.1 Write the transport tests: a run with `STRATZ_API_KEY` unset fails
      before any request and names the variable [1]; an empty value is treated
      as unset rather than sent as an empty Bearer [2]; a successful request
      carries both the `Authorization` and `User-Agent` headers [3]; the key
      appears in no error message, log line or thrown stack [10]. (Req:
      snapshot-ingest — Every request carries both halves of the gate)
- [ ] 1.2 Write the pacing tests: eight requests issued back to back all go
      out within one second [4]; the ninth of nine waits until a second has
      elapsed since the first [5]; requests already a second apart are not
      delayed further [6]; exactly eight inside one second leaves the eighth
      undelayed [7]; a response reporting zero remaining in any rate-limit
      window ends the run with no further request [16]. (Req: snapshot-ingest
      — A run stays inside the quota the API states)
- [ ] 1.3 Write the retry tests: the three delays between four attempts are
      1s, 2s and 4s [8]; the fourth failing attempt issues no fifth [9]; a
      `500` then a `200` returns the second body and continues [13]; a `400`
      is attempted exactly once [14]; four consecutive `429`s **with quota
      remaining** end the run failed [15]; a `429` **reporting zero remaining**
      is attempted exactly once, the quota rule taking precedence over this one
      [63]. (Req: snapshot-ingest — A request is retried only where retrying
      can succeed / A run stays inside the quota the API states)
- [ ] 1.4 Write the classification tests: a `403` carrying `text/html` reports
      an unmet challenge naming the `User-Agent` [11]; a `403` carrying JSON
      reports the key as rejected [12]; a `200` whose body carries a non-empty
      `errors` array fails the run and writes no staging row from it [17].
      (Req: snapshot-ingest — A response is classified by its body, not its
      status alone)
- [ ] 1.5 Implement the client: the two headers, the key read once at
      construction, the queue that holds a request while eight sit inside the
      last second, the retry policy with the quota rule ahead of it, and the
      classification that reads the body before deciding what failed. (Req:
      snapshot-ingest — Every request carries both halves of the gate / A
      response is classified by its body, not its status alone / A run stays
      inside the quota the API states / A request is retried only where
      retrying can succeed)
- [ ] 1.6 Add `.env.example` naming every variable a run reads, with no value
      for any of them, and confirm `.gitignore` still excepts it from the
      `.env*` wildcard. (Req: none — configuration, closing no criterion)

## 2. Patch detection and the hero reference

- [ ] 2.1 Write the patch tests: a first run against an empty `patches` table
      inserts the current patch [39]; a patch the table lacks is inserted with
      the source's release instant rather than the run instant [40]; the
      current patch is the held one with the latest `detected_at` not after
      the run instant, so a listed future release does not become current
      [41]; a name with no trailing letter sets `is_major` true and one ending
      in a letter sets it false with the letter stripped for `base_version`
      [42]; a second run does not rewrite a held patch's `detected_at` [43].
      (Req: hero-reference — Patches are detected from a source that is
      current)
- [ ] 2.2 Write the patch-source failure tests: a patch list unreachable after
      its retries fails the run before any staging row is written [67]; a list
      parsing to no patch, and one whose newest entry carries no name or no
      release instant, each fail the run naming which, without falling back to
      the patch `patches` already holds [68]. (Req: hero-reference — Patches
      are detected from a source that is current)
- [ ] 2.3 Write the hero-upsert tests: a hero the tables lack is inserted with
      `first_seen_at` set to the run instant [45]; a hero a later response
      omits keeps its row and its original `first_seen_at` [51]; a hero whose
      display name changed takes the new name and keeps `first_seen_at` [52];
      a run failing after the upsert leaves those rows, and a repeat leaves
      them unchanged [66]. (Req: hero-reference — A hero is upserted and never
      removed)
- [ ] 2.4 Implement patch detection against the second source, including the
      major/letter split, the insert-once rule and the three failure paths,
      with a comment naming why the statistics API's own version list is not
      read. (Req: hero-reference — Patches are detected from a source that is
      current)
- [ ] 2.5 Implement the hero upsert with no delete path at all, so removal is
      absent rather than guarded. (Req: hero-reference — A hero is upserted
      and never removed)

## 3. Mirrored images and the route that serves them

- [ ] 3.1 Write the mirroring tests: a first run against an empty directory
      leaves a file for every hero [44]; a run with every file present issues
      no image request [46]; every stored `icon` is a path beginning with `/`
      and never an absolute URL to another origin [47]; a new hero whose image
      fetch fails ends the run failed with no `icon` naming an absent file
      [53]; a hero already mirrored survives a failed refetch, nothing being
      refetched [54]; reads taken repeatedly across the ingest writing an image
      answer the complete file or a `404` and never part of one [69]. (Req:
      hero-reference — Hero images are mirrored to the application's own
      origin)
- [ ] 3.2 Write the route tests: a mirrored image answers `200` with
      `content-type: image/png` and the immutable cache header [48]; an unheld
      name answers `404` with an empty body [49]; a request naming a segment
      outside the mirror directory cannot reach a file outside it [50]; a file
      written after the server started is served without a restart [55]. (Req:
      hero-reference — The mirrored images are served from the application's
      origin)
- [ ] 3.3 Implement the mirror: fetch once per hero into a temporary name the
      route cannot serve, move it to its final name only once the whole file is
      on disk, skip a name already present, and fail the run only where a hero
      has no file at all. (Req: hero-reference — Hero images are mirrored to
      the application's own origin)
- [ ] 3.4 Add the `/icons/*` route to `static-routes.ts`, resolved from the
      directory listing per request rather than prebuilt, since the job writes
      that directory while the server is running. (Req: hero-reference — The
      mirrored images are served from the application's origin)

## 4. The windows each statistic is pulled over

- [ ] 4.1 Write the meta-window tests: a patch seven whole UTC days old is
      pulled over exactly seven days and each staging row is the sum over them
      [20]; a patch with no complete day behind it is pulled over the single
      most recent complete day rather than none [18]; a hero the source returns
      no rows for produces no position rows rather than rows of zeros [19];
      days returned out of order sum to the same row as days in order [21];
      five position pulls produce one row per hero and position with none
      overwriting another [22]; the day boundary is counted in UTC, so a run
      instant whose local date is a day ahead does not add a day [26]; the day
      the run instant falls inside is not part of the window [64]. (Req:
      snapshot-ingest — The meta is pulled by day over the current patch's
      life)
- [ ] 4.2 Write the meta-request tests: the request names the ranked All Pick
      game mode and a response covering every mode is rejected rather than
      accepted in its place [27]; the request names the Divine and Immortal
      brackets [28]. (Req: snapshot-ingest — The meta is pulled by day over
      the current patch's life)
- [ ] 4.3 Write the pair-window tests: a patch live for exactly four complete
      weeks pulls four [23]; one live for twelve pulls exactly four and the
      run records which four [24]; one live for two pulls two, and no week
      preceding the patch is requested [25]; a week whose span contains the
      current patch's `detected_at` is attributed to the current patch [31].
      (Req: snapshot-ingest — Pair statistics are pulled per hero over at most
      four weeks)
- [ ] 4.4 Write the pair-response tests: the request asks for every other hero
      so the response carries one opponent and one ally row per other hero
      rather than the endpoint's default page [29]; a response short of one
      row per other hero fails the run rather than writing a partial matrix
      [30]. (Req: snapshot-ingest — Pair statistics are pulled per hero over
      at most four weeks)
- [ ] 4.5 Implement the meta pull: one request per position over the
      UTC-normalised, end-exclusive window, the game mode and brackets named at
      one site, summed into staging rows. (Req: snapshot-ingest — The meta is
      pulled by day over the current patch's life)
- [ ] 4.6 Implement the pair pull: one request per hero per week over the
      lesser of four and the weeks the patch has been live, asking for every
      opponent, summed across the weeks, and reporting the weeks covered.
      (Req: snapshot-ingest — Pair statistics are pulled per hero over at most
      four weeks)

## 5. Contest rate and the staging write

- [ ] 5.1 Write the contest tests: a hero whose match count equals the
      window's match total with no bans has a rate of 1 [32]; two heroes with
      equal picks rank by bans [33]; the denominator is the summed hero counts
      divided by ten, so counts summing to a non-multiple of ten still yield
      the stated ratio rather than a rounded one [34]; a window whose matches
      are 0 gives every hero 0 with no division attempted [35]. (Req:
      snapshot-ingest — Contest rate is a share of the window's matches)
- [ ] 5.2 Write the staging tests: two runs over identical responses **and the
      same run instant** leave identical rows rather than doubled counts [36];
      two runs whose instants fall either side of a UTC day boundary cover
      different days and leave different rows [65]; a run failing after the
      meta pull produced rows leaves staging holding exactly its pre-run rows
      [37]; a run writing a newer patch leaves the previous patch's rows and
      removes anything older [38]. (Req: snapshot-ingest — A run leaves
      staging whole or leaves it untouched)
- [ ] 5.3 Implement the contest formula over the counts the meta and ban pulls
      already return, with the divisor carrying the comment naming why it is
      exact and the ratio carrying the one naming why it is not. (Req:
      snapshot-ingest — Contest rate is a share of the window's matches)
- [ ] 5.4 Implement the staging write as a delete-then-insert inside one
      transaction, taking the run instant as an argument, with the retention
      that drops anything older than the previous patch. (Req: snapshot-ingest
      — A run leaves staging whole or leaves it untouched)

## 6. The job

- [ ] 6.1 Write the outcome tests: all three steps succeeding exits zero and
      the served bundle is the one just written [56]; the failure report names
      which of the three failed [57]; a failing ingest builds no snapshot,
      leaves the previous bundle served and exits non-zero [58]; a build
      ending `failed` does not run the export and exits non-zero [59]; a
      failing export writes no bundle, leaves the previous one served and
      exits non-zero [60]; the export invoked alone renders the newest
      published snapshot and exits zero with no request to the statistics API
      [61]. (Req: snapshot-ingest — The job carries a run to one outcome)
- [ ] 6.2 Implement the entry point: ingest, then build, then export, each
      separately invocable, returning which step failed and exiting non-zero
      when one did. (Req: snapshot-ingest — The job carries a run to one
      outcome)
- [ ] 6.3 Write the end-to-end test: a seeded source runs ingest → build →
      export and the served bundle is accepted by the client's loader [62].
      (Req: snapshot-ingest — The job carries a run to one outcome)
