# match-harvest — design

## Context

The pipeline computes a bundle nightly and nothing checks the result against
anything. `docs/research/stratz-graphql-2026-08-29.md` settles what is
reachable; this file settles what is stored and what bounds it.

Two measurements drove the two decisions below. Both were taken against the
live API on 2026-08-30 and neither is in the survey, which predates them.

## Goals / Non-Goals

**Goals:** finished ranked All Pick drafts and their results, in the
database, bounded, on the nightly schedule, without risking the bundle.

**Non-Goals:** as the proposal's *Non-goals* fixes them — no scoring, no side
or phase deltas, no draft replay, no lane outcome, no `imp`, no alerting.

### Where the field-level contract lives

Not here. `docs/research/stratz-schema-2026-08-29.txt` carries every field,
argument, result type and wrapper of `leaderboard.season`, `player.matches`,
`MatchType`, `MatchStatsPickBanType` and `MatchPlayerType`, and
`docs/research/stratz-graphql-2026-08-29.md` records which of them were seen
populated and which were null. Copying those selections into this file would
be a second statement of one fact, which the single-source rule in
`CLAUDE.md` refuses.

What this change depends on, and what the delta spec therefore fixes rather
than the survey, is narrower than the shapes: the bracket integers, the
per-call cap, that a ban entry carries `bannedHeroId` alone, and that a draft
short of ten picks is refused. The survey is dated and says to re-check
before depending on it, so step 3's cases are written against a fake
transport carrying recorded shapes — a field that moved fails there rather
than in production.

## Decisions

### The draft is captured now, because capturing it later costs 100×

The tempting economy is to store only the match id and the result, and fetch
the draft when a scorer needs it. Two measurements refuse it.

Nothing expires, so this is not a race: a match from 2023-02-03 still returns
its players, positions and lanes, and a ranked match from 2024-09 still
returns its full `pickBans` with order. The question is purely price.

```
capture with the harvest   player.matches(take: 100)   1 request / 100 matches
fetch afterwards           match(id)                   1 request / 1 match
                           matches(ids: [...])         "User is not an admin."
```

The batch-by-ids query exists and is closed to this key, so a backfill is one
request per match: 100 000 matches would be seven days of the whole daily
quota with the nightly ingest stopped. The same 100 000 cost 1 000 requests
at harvest time.

What the draft costs at harvest time is payload, not quota — 78 bytes per
match for id, result and bracket, against 2 754 with the picks, bans,
positions and lanes. The quota counts requests. So the expensive resource is
untouched and the cheap one grows 35×, which is the trade to take.

`imp` is refused on its own terms rather than this one: it is null in four of
six matches sampled, and it judges a player after the game rather than
describing the draft.

### The store is bounded by a count, and the patch is a column

An earlier draft of this plan bounded retention by patch — keep the current
patch, top up from the previous to a floor. Measuring the patch cadence
killed it: over the thirteen most recent versions the gap runs from 7 days to
200, median 48, and the current one is 159 days old. A patch-shaped bound
admits 14 000 matches or 400 000 depending on something nobody here controls.

```
   matches   days at 2 000/day   on disk
    10 000            5             23 MB
    25 000           12             57 MB
    50 000           25            115 MB
   400 000          200            917 MB   ← where a patch bound leads
```

The VPS is shared with other people's services, so 917 MB is not free.

How many are enough is a question about what the store is *for*. Simulating a
paired Brier comparison over 300 runs per point:

```
detect a gross error   (beta 0.1 vs a true 0.045)
   250 matches   97% of runs pick the better        500 matches  100%

separate two near calibrations   (beta 0.050 vs 0.045, an 11% difference)
 1 000 matches   63%      10 000   92%
 2 500 matches   80%      25 000   98%      50 000  100%
```

So one night answers "is the current β wildly wrong"; tuning needs 25 000,
and the curve is flat past it — every further 25 000 buys under 0.00005 of
standard error. The count *The store is bounded by a count of matches* fixes
is twice the point the curve flattens, which leaves room to slice the store
by draft stage later and still have a population in each slice.

The patch is recorded on every match and never read by retention. That is the
seam: retention bounds disk, and *which matches a scorer should trust* is the
scorer's filter — it depends on the snapshot doing the scoring, which
retention cannot know.

### The harvest runs last and still fails the run

Nothing it writes is served. Putting it after the export means no harvest
failure, timeout or quota exhaustion can delay or unpublish the bundle. It
still exits non-zero, because a step that fails quietly is exactly how `side`
and `phase` stayed zero for months.

### Rejecting a short draft, and counting the rejection

Seven of a hundred sampled matches carry fewer than ten picks. A 5v5 scorer
cannot use them, and storing them would make every reader re-implement the
same filter. They are rejected — and counted, because "the source stopped
returning picks" and "these matches were abandoned during the draft" produce
the same empty result and only a count separates them.

## Risks / Trade-offs

- **The harvest samples leaderboard members, not the ranked population.** It
  is a biased sample of very high MMR, which is the bracket the bundle is
  built from too, so the bias is shared rather than introduced. → Recorded
  here; a scorer that generalises past that bracket is claiming something
  this data cannot support.
- **A leaderboard is ~10 000 members per division and they overlap in the
  same matches.** Two members of one match yield the same id twice. → The
  match id is the primary key, so a duplicate is an upsert, not a row.
- **The count bound deletes matches a scorer was mid-way through reading.**
  → Retention runs inside the harvest's own step, once, after the write, on
  the terms `retention.ts` already applies to snapshots.
- **The bracket integers are read, not inferred.** `MatchType.rank` is the
  two-digit medal, so filtering one leaderboard member's history by bracket
  and reading the ranks back settles the mapping: `[6]` returns ranks 60–64
  (Ancient), `[7]` returns 74 (Divine), `[8]` returns 80 (Immortal). The
  harvest asks for `[7, 8]`, which is `ingest/meta.ts`'s
  `bracketIds: [DIVINE, IMMORTAL]` in the integer space this endpoint takes.
  `[1]` returns nothing for that member, so the filter excludes rather than
  being ignored.

## Open Questions

- How many leaderboard members to walk per night, which fixes the daily
  match count and so how many days the bound spans. It is a constant in the
  harvest, decided when the first run's real yield is measured rather than
  guessed here.
