# match-harvest — tasks

Six steps, six pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a step close no criterion only
when it carries infrastructure, and updating `PLAN.md` and running the review
sequence are neither — so they ride with the step that merges last, where
they were always going to happen.

The `snapshot-ingest` delta carries five criteria this change does not close
— `a-run-that-succeeds`, `an-ingest-that-fails`, `a-build-that-fails`,
`an-export-that-fails` and `the-export-invoked-on-its-own`. They are the
requirement's existing scenarios, copied whole because a `MODIFIED` delta
replaces a requirement rather than patching it, and tests on `main` already
close them. Only `a-run-that-succeeds` changes meaning: it now names four
steps, so step 5 re-verifies it rather than assuming it.

## 1. The tables and their reclaim

Closes `match-harvest/deleting-a-match-leaves-nothing-behind`.

- [ ] 1.1 Add `harvest_matches` (match id primary key, started at, which side
      won, bracket, patch), `harvest_picks` and `harvest_bans` to
      `src/job/schema.sql`. Picks carry hero, side, order, position and lane;
      bans carry the hero alone. Both cascade from the match, so retention
      names one table and the schema collects the rest — the reading
      `retention.ts` already relies on for snapshots.
- [ ] 1.2 Add all three to the sentinel reclaim in `src/job/db.fixture.ts`,
      before its `DELETE FROM heroes`. Until they are there no suite may
      write to them at all: the hero delete fails on the foreign key and
      takes every other database suite with it.
- [ ] 1.3 Choose the sentinel range for match ids. `hero_id >= 9000` cannot
      serve — a real match id is eleven digits — so the reclaim needs a range
      no real match falls in, named in `db.fixture.ts` where the others are.
- [ ] 1.4 Write the failing case first (ZOMBIES 28): deleting a match row
      leaves no pick or ban behind. It is the one criterion this step closes,
      and the reason retention below can name one table.
- [ ] 1.5 Give `harvest_picks` a `position` that cannot be null and a `lane`
      that can (ZOMBIES 22, 23). Lane was absent for at least one player in 2
      of 100 sampled matches; position was present in all 100, and a pick
      with no position is a row no scorer can place.

## 2. The member walk

Closes `match-harvest/the-walk-advances-and-stops`,
`match-harvest/a-leaderboard-member-with-no-ranked-all-pick-matches`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 1, 2, 5): a second page of
      members carries a `skip` past the first; the walk stops at its bounded
      number rather than at the end of the division; an empty member does not
      end it. An empty division storing nothing follows from the same walk
      and needs no criterion of its own.

## 3. What is asked of each member, and stored once

Closes `match-harvest/the-bracket-is-asked-for-not-inferred`,
`match-harvest/a-member-with-more-matches-than-one-call-returns`,
`match-harvest/one-match-returned-by-two-members`.

- [ ] 3.1 Write the failing cases first against a fake transport, the way
      `src/job/ingest/*.test.ts` already do (ZOMBIES 1, 2, 3, 6, 7, 8, 9):
      one member with one match stores one row; no call asks for more than
      100; a member with more than 100 is read once and not paged; every
      request carries `bracketIds: [7, 8]` as integers and
      `gameModeIds: [22], lobbyTypeIds: [7]`; one match returned by two
      members is one row with one set of picks (ZOMBIES 3, 4, 6, 7, 8, 9,
      24).
- [ ] 3.2 Check the bracket on the way in as well as asking for it
      (ZOMBIES 10). A returned match whose `bracket` is neither 7 nor 8 is
      not stored: the filter was verified to exclude, but a filter asked for
      and an answer checked are two different assertions.
- [ ] 3.3 Walk `leaderboard.season` members and read each one's
      `player(...).matches(request: {take: 100, gameModeIds: [22],
      lobbyTypeIds: [7], bracketIds: [7, 8]})` through the existing client, so
      the pacing on `x-ratelimit-*` is inherited rather than rewritten.
- [ ] 3.4 Upsert by match id. A second arrival of a stored match produces no
      second set of pick rows. Two members of one match return the same id,
      and a leaderboard division holds around ten thousand members.
- [ ] 3.5 Let the existing client own the failure paths (ZOMBIES 11, 12, 13).
      These close no criterion of this change: `snapshot-ingest` already owns
      them in *A run stays inside the quota the API states* and *A request is
      retried only where retrying can succeed*, and a fourth caller inherits
      both. Assert here that the harvest goes through that client rather
      than reimplementing either.
- [ ] 3.6 Measure the first real run's yield — matches per member walked —
      and record it against the design's open question, which fixes how many
      members a night should walk. Closes no criterion: it is a measurement
      that sets a constant, and a criterion fixing a number nobody has
      measured yet would be one written before its evidence.

## 4. What a match keeps, and what it refuses

Closes `match-harvest/a-complete-draft`,
`match-harvest/a-ban-has-no-side`,
`match-harvest/a-draft-short-of-ten-picks`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 14, 15, 18, 19, 20, 21): a
      ten-pick match stores ten picks with hero, side, order and position; a
      match with no bans stores ten picks and no ban rows rather than failing
      on an empty list; nine picks are stored nowhere and counted; a ban's
      hero comes from `bannedHeroId` and never from `heroId`, which is null
      there; a ban has no side; `imp` reaches no column.
- [ ] 4.2 Store the picks and bans. `harvest_bans` holds the hero and
      nothing else — no order column, no side column — because a ban *entry*
      of the API's `pickBans` carries `bannedHeroId` alone, its `order` and
      `isRadiant` being null. Read both from the pick entries, and give the
      ban table no column that would have to be filled from them.
- [ ] 4.3 Take `order` and `isRadiant` from the entry, never from its place
      in the array (ZOMBIES 16, 17). `pickBans` interleaves ten picks among
      about twenty-eight entries, so an index is not an order, and five picks
      to a side is not a position in the list.
- [ ] 4.4 Store `lane` where the API returns one. It was present for all ten
      players in 98 of 100 sampled matches, so a missing lane is a value to
      admit, not a match to reject.
- [ ] 4.5 Do not store `imp`. Null in four of six matches sampled, and a
      judgement of a player after the game rather than a fact about the
      draft — recorded here so a later reader does not add it back believing
      it was overlooked.

## 5. The bound

Closes `match-harvest/the-store-at-its-bound`,
`match-harvest/a-patch-longer-than-the-bound`.

- [ ] 5.1 Write the failing cases first (ZOMBIES 25, 26, 27, 29), on the
      shape `src/job/build/build-retention.test.ts:52` already uses, written
      against the bound rather than against a copy of its number: one match
      past the bound leaves the bound with the oldest gone; a store exactly
      at it deletes nothing; a match of the current patch is deleted when it
      is the oldest; adding two hundred to a full store ends at the bound and
      not two hundred below it, retention running after the write.
- [ ] 5.2 Retain the count *The store is bounded by a count of matches*
      fixes, as one constant in one place, citing that requirement rather
      than restating the number beside it.
- [ ] 5.3 Read the patch column in no part of retention. It is on every match
      for a reader's benefit; a bound that consulted it would be the bound
      the design measured and rejected.

## 6. The order in the run, and the report

Closes `snapshot-ingest/a-harvest-that-fails`,
`match-harvest/a-harvest-that-stored-nothing`.

- [ ] 6.1 Write the failing cases first (ZOMBIES 31, 32, 33, 34, 35, 36, 37),
      beside the cases `run.test.ts` already carries: a harvest that throws
      leaves the exported bundle served, exits non-zero and names itself in
      the report the way `[57]` requires of the other three; a failing export
      runs no harvest at all; the export invoked alone runs none and issues
      no request; the report carries the three counts, zeros included.
- [ ] 6.2 Run the harvest from `src/job/run.ts` after the export, never
      before. `runJob` returns a report string and exits non-zero on any
      step; the harvest joins that without the export becoming conditional
      on it.
- [ ] 6.3 Report matches added, rejected and dropped, including when all
      three are zero.
- [ ] 6.4 Reconcile the three places in `src/job/run.ts` that say three
      where there are now four — the module comment at line 2, the `runJob`
      comment at line 43, and the comment at line 68. A comment naming a count the
      code no longer has is the defect no test sees, which is why they are
      listed rather than left to be noticed.
- [ ] 6.5 Re-verify `snapshot-ingest/a-run-that-succeeds` (ZOMBIES 30), whose
      text this change rewrites from three steps to four — `run.test.ts:79`
      is the case that carries it and it now has a fourth step to pass.
- [ ] 6.6 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 6.7 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
      Steps 1 to 4 all touch the database, so each one's suite must assert it
      ran rather than skipping, and `bun run test:db` is the run that counts.
