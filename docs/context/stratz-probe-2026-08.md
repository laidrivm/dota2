# STRATZ with a key — what was measured, 2026-08

Written for a session picking up Phase 3b (`snapshot-ingest`), and for the one
picking up Phase 3a (`snapshot-build`), because two of the findings below
change what 3a must specify. Supersedes the open items at the foot of
`snapshot-sources-2026-08.md`; that file's OpenDota measurements still stand.

**Probe environment.** 2026-08-19, `curl` on macOS over HTTPS, no proxy,
against `https://api.stratz.com/graphql` with a personal API token in
`Authorization: Bearer`. Roughly 30 requests total. Every schema claim below
rests on GraphQL introspection of the live schema (513 types), not on which
endpoint names happened to work; every volume claim rests on a real response.
Treat the numbers as a snapshot, not a contract.

## Conclusion

The key works and the job fits inside the rate limit with room to spare — the
whole nightly pull is about 516 requests against a ceiling of 1500 per hour
(the second probe's count; this line first carried 130, which undercounted
`matchUp` by a factor of four).
The cost is elsewhere: **two of the model's components cannot be sourced from
STRATZ at all**, and only one of them was expected.

## The Cloudflare gate is the User-Agent, not the key

`snapshot-sources-2026-08.md` recorded a keyless request returning Cloudflare's
"Just a moment…" page and left what that meant unestablished. It is
established now, by three requests differing in one header each:

| Request | Result |
|---|---|
| no key, no `User-Agent` | `403`, `text/html`, Cloudflare interstitial |
| key, no `User-Agent` | `403`, `text/html`, Cloudflare interstitial |
| key + `User-Agent: STRATZ_API` | `200`, `application/graphql-response+json` |

So the key alone does not clear the challenge. A client that sends the token
and omits the header gets HTML with a `403`, which is not a shape a JSON
parser or an auth-failure branch will explain. The ingest names this header,
and its failure path distinguishes a `403` carrying `text/html` from a
genuine auth rejection.

## Rate limits, stated rather than inferred

The successful response carries both ceilings and remainders, so these are the
API's own numbers, not an inference from what was left:

```text
x-ratelimit-limit-second:  8       x-ratelimit-limit-hour:  1500
x-ratelimit-limit-minute:  150     x-ratelimit-limit-day:  15000
```

Against that, a full nightly pull costs roughly:

| Call | Requests | Yields |
|---|---:|---|
| `heroStats.stats` grouped by position | 1 | 635 rows = 127 heroes × 5 positions |
| `heroStats.matchUp` per hero | 127 | both matrices whole — 126 `vs` + 126 `with` per hero |
| `constants.heroes`, `constants.gameVersions` | 2 | reference tables |
| `heroStats.banDay` | a few | ban counts for contest rate |

`data-model.md` §8.1 kept "растянуть джоб во времени" as the contingency for
insufficient quota. It is not needed: the per-second ceiling of 8 is the only
one a naive loop could trip. The request count in the table above is
superseded — see the second probe's budget, which reads `matchUp` as one
request per hero **per week** and lands at about 516 rather than 130.

## Pick phase is not available — §8.2 answered

`MatchPlayerTeamPickOrderType` exists and carries exactly the granularity the
model wants (`FIRST_PICK` … `FIFTH_PICK`, which groups onto model-spec §2's
`p1`/`p2`/`last` as 1–2 / 3–4 / 5). It is reachable from two places in the
whole schema, and neither is an aggregate:

- `MatchReplayUploadPlayerType.teamPickOrder` — a field on the replay-upload
  subsystem.
- `FilterMatchReplayUploadRequestType.filterPositionOrder` — a filter on
  requests to that same subsystem.

No field of `HeroStatsQuery` takes it as an argument or returns it. So the
answer to `data-model.md` §8.2 is the deferral the question already allowed:
`phase` is zeroed, for every hero, and the component contributes nothing.

## Side is not available either — this one was not expected

`data-model.md` §2 lists "hero winrate по сторонам (Radiant/Dire)" as a
STRATZ-sourced input, and `hero_stats` declares `side_adj_radiant` and
`side_adj_dire` as `NOT NULL`. The schema does not support it:

- `MatchGroupByFactionType` exists, with exactly the right shape
  (`isRadiant`, `matchCount`, `winCount`) — but the only fields returning a
  `MatchGroupBy*` type are `PlayerType.matchesGroupBy`,
  `TeamType.matchesGroupBy` and `LeagueType.matchesGroupBy`. Every one is
  scoped to a single player, team or league. There is no global aggregate.
- `FilterHeroWinRequestGroupBy`, which `winDay`/`winWeek`/`winMonth`/
  `winGameVersion` group by, offers `HERO_ID`, `ALL`,
  `HERO_ID_DURATION_MINUTES`, `TIME`, `HERO_ID_POSITION_BRACKET` — no faction.
- `heroStats.stats` returns no faction dimension and takes no faction filter.

So `side` joins `phase`: a uniform zero for every hero, or nothing. The
boundary `PLAN.md` states for `phase` — never zero it by halves, because
`src/model.ts` weighs the delta without asking whether it was measured — now
governs two components rather than one.

## What this breaks in Phase 3a as specified

3a's delta specs, read against a staging that STRATZ can actually fill,
cannot publish a bundle. The chain is three requirements long:

1. `snapshot-build` §*Patch blending with a decaying prior*: where
   `n_new + prior(t)` is 0, the statistic **is absent from the snapshot**
   rather than blended.
2. `snapshot-build` §*Smoothing towards neutral by sample size* restates it:
   an `n_eff` of 0 never reaches the formula.
3. `snapshot-export` §*A hero entry missing a field the client never checks*:
   a rendered hero lacking `side` or `phase` **fails the export**.

A source that supplies no side and no phase gives `n_new = 0` for both, on
every hero. By (1) they are absent; by (3) the export fails; no snapshot ever
publishes. 3a's `design.md` anticipated the shape of this — "a column STRATZ
cannot fill arrives as zeros without the maths changing" — but its specs
encode the opposite, because "no sample" and "no such measurement" are the
same `n_new = 0` to them and must not be.

The distinction the specs need is between a statistic with **no sample** and a
component the source **does not measure**. The first is absent, as specified.
The second is a uniform zero, written for every hero, present in the payload —
which is what keeps `src/types.ts`'s required `side` and `phase` satisfiable
without a client change, and what keeps the "never by halves" boundary
checkable rather than implicit.

## Smaller findings, each measured

- **The bracket filter genuinely filters.** Hero 1, grouped by position:
  `DIVINE_IMMORTAL` 12,807 matches, `HERALD_GUARDIAN` 30,478, unfiltered
  175,232. Worth stating because the response echoes `bracketBasicIds: null`
  even when the filter was passed and applied — the echo is not evidence
  either way.
- **Two bracket enums exist and are not interchangeable.**
  `RankBracketBasicEnum` (`DIVINE_IMMORTAL` as one bucket) is what
  `heroStats.stats`, `matchUp` and `banDay` take; `RankBracket` (`DIVINE` and
  `IMMORTAL` separate) is what `winDay`/`winWeek`/`winGameVersion` take.
- **Sample size is ample.** One week at `DIVINE_IMMORTAL` carried 1,837,185
  matches across the 635 position rows — far above the 500/1000 sufficiency
  thresholds, and unlike OpenDota's matchup endpoint, not at the level of its
  own noise.
- **One `matchUp` request per hero returns both matrices — for one week.**
  `HeroDryadType` carries `with` and `vs` side by side, each 126 rows, with
  `matchCount`, `winCount`, `synergy` and `winRateHeroId1`. 17 KB per hero.
  Per hero *per week*: the week is the endpoint's only time dimension, which is
  what the budget above got wrong.
- **No hero icon anywhere in the schema.** `HeroType` carries `id`, `name`,
  `displayName`, `shortName`, `aliases`, and no image or URL field; a search
  across every `Hero*` type for `img`/`image`/`icon`/`url`/`portrait` returned
  nothing. `app-shell` forbids a third-party runtime request, so the mirroring
  step still stands — but its source is not STRATZ. `shortName` is the handle
  a Valve CDN path would be built from; OpenDota's `heroStats` carries `img`
  and `icon` outright and is already known to work keylessly.
- **STRATZ buckets by week, and history is retrievable, so staging can stay
  keyed by patch.** `heroStats.stats` returns one week per call, and its `week`
  argument is a **Unix timestamp in seconds**, not the bucket id the response
  carries: `week: 2954` returns nothing at all, while a timestamp inside that
  week returns its rows. Six distinct buckets were pulled this way, from week
  2954 back to 2920 (2025-12-23), each with counts of its own. So an ingest
  can sum the weeks inside a patch window rather than accumulating them from
  first run onwards. `groupByTime: true` splits by a duration dimension rather
  than by calendar week — its row totals do not reconcile with the ungrouped
  query, and why was not investigated.
- **A bucket covers Thursday to Wednesday and the current one is empty.**
  Superseded for the meta component by the second probe below — this describes
  `heroStats.stats`, which the ingest no longer reads. It still describes
  `matchUp`, whose only time argument is the same week.
  Every timestamp from 2026-08-13 (Thu) to 2026-08-19 (Wed) returned week 2954
  with an identical 12,852 matches for hero 1; 2026-08-12 returned 2953; and
  2026-08-20, the Thursday the probe ran, returned nothing. The freshest
  complete bucket is therefore the week that ended the previous Wednesday.
  This bears on the nightly job `data-model.md` §7 assumes: run against
  `heroStats.stats`, six nights in seven would rebuild an identical snapshot
  and the seventh would jump. It also sits oddly beside a `prior(t)` that
  decays in whole days over a `t_max` of 4 or 7. Whether a daily granularity
  exists elsewhere was not tested — `winDay` takes `bracketIds: RankBracket`
  and is the obvious place to look.
- **`constants.gameVersions` newest entry is 7.40b, `asOfDateTime`
  2025-12-24** — about eight months before the probe date. Whether the list is
  stale, ordered unexpectedly, or correct was not established, and patch
  detection rests on it.

## Open, and where it stopped

- **The job's cadence against a weekly bucket.** Answered by the second probe
  below: `winDay` does offer the daily granularity `heroStats.stats` does not,
  and the meta component moves to it.
- **Contest rate's denominator.** `banDay` gives bans with a bracket filter and
  a `day` dimension; picks come from `stats`. Nothing here checked that the two
  cover the same match population, which is what makes `(picks + bans) / matches`
  meaningful.
- **The `x-steamid-ok: false` header** on every successful response was not
  explained. It did not prevent any query run here.

# Second probe, 2026-08-21 — a daily, mode-filtered source

Written while drafting `snapshot-ingest`. Same environment as above: `curl` on
macOS, the same token, roughly fifteen requests. Three findings change what the
ingest is; where they contradict the first probe, they are the newer
measurement and the older one is named as superseded rather than deleted.

## `winDay` is daily, current, and the only source that filters by game mode

The first probe left `winDay` untested and read `heroStats.stats` as the meta
component's source. `winDay` is strictly better for it, on three counts
measured here:

| | `heroStats.stats` | `heroStats.winDay` |
|---|---|---|
| Time dimension | week, Thu–Wed | day |
| Freshest row | week ending the previous Wednesday | the previous day |
| Bracket enum | `RankBracketBasicEnum` | `RankBracket` |
| Game-mode filter | none | `gameModeIds` |
| Cost for all heroes × all positions | 1 request per week | 5 requests |
| Reach | any week, back to 2920 | the 30 most recent days, no page past them |

One `winDay` request — no `heroIds`, `positionIds: [POSITION_1]`,
`bracketIds: [DIVINE, IMMORTAL]`, `groupBy: HERO_ID`, `take: 30` — returned
3,784 rows: 127 heroes × 30 days, 2026-07-22 to 2026-08-20. `take` counts days,
so the window is an argument rather than a series of requests.

**Thirty days is the ceiling, and there is no page past it.** `take: 200`
returns the same 30 days, and `skip: 30` and `skip: 120` each return nothing
where `skip: 0` returns 30 rows — so the argument is being honoured and the
data behind it is not there. The current patch is 150 days old, so an ingest
reading only `winDay` covers the last fifth of it.

`winWeek` takes the same filters, `gameModeIds` included, and reaches further:
`take: 40` returned 19 weeks, 2026-04-09 to 2026-08-13. That is a longer window
at coarser granularity, two weeks short of the patch. It is not used — thirty
days at these brackets is already millions of matches, orders above the
sufficiency thresholds, and the days a cap discards are the oldest — but it is
recorded because the cap is now load-bearing and this is the only thing
measured that would lift it.

The game-mode filter is the decisive one. The product models ranked All Pick,
and `stats` cannot express that: it has no `gameModeIds` argument, so every
number the first probe recorded from it pools Turbo and the rest. `winDay`
takes `gameModeIds: [ALL_PICK_RANKED]`, and doing so cost hero 1 about 1% of
its position-1 volume — the mode mix at Divine/Immortal is nearly all ranked
All Pick, but the filter is stated rather than assumed.

**The two endpoints do not reconcile, and this was not explained.** Hero 1,
Divine/Immortal, position 1, the seven days of week 2954: `winDay` sums to
25,510 matches where `stats` reports 11,989 for the same week — a ratio of
2.1, and 2.4 with the position filter dropped on both. Both filters were
controlled: `positionIds: [POSITION_5]` returns 38–51 a day against position
1's 3,605, and dropping `bracketIds` raises the daily count from ~4,000 to
~75,000, so neither argument is being ignored. The likeliest cause is that
`RankBracketBasicEnum.DIVINE_IMMORTAL` and `RankBracket.[DIVINE, IMMORTAL]`
are not the same population, but that was not established. It matters because
`matchUp` takes only the *basic* enum, so the matchup matrices are drawn from
a differently-scoped population than the meta.

## Per-patch aggregates exist, and are eight months stale

`heroStats.winGameVersion` returns `gameVersionId, heroId, durationMinute,
winCount, matchCount`, filterable by `positionIds` and `bracketIds` — the
patch-keyed aggregate `data-model.md` §3.3 assumes staging can be built from,
in one request for all 127 heroes. It cannot be used:

- `constants.gameVersions` holds 181 entries, newest id 182 = **7.40b**,
  `asOfDateTime` 2025-12-24.
- `winGameVersion` returns rows for ids 181, 180, 179 … and **none for 182**,
  with or without a bracket or position filter. Its newest populated version is
  7.40, released 2025-12-16.
- OpenDota's `/api/constants/patch` lists **7.41, released 2026-03-24** —
  a major patch STRATZ's version list does not know about at all.

So STRATZ's patch attribution stopped roughly eight months before this probe
while its match data did not: `winDay` returns rows through 2026-08-20. Patch
detection cannot rest on `constants.gameVersions`, and the current patch's
aggregates cannot come from `winGameVersion`. OpenDota's patch constant is the
current source, and it lists majors only — 7.40b is in STRATZ's list and not in
OpenDota's, so no single source gives a current letter-patch list.

## The request budget, restated against `winDay`

| Call | Requests | Yields |
|---|---:|---|
| `winDay` per position | 5 | 127 heroes × up to 30 days, one request per position |
| `matchUp` per hero per week | up to 508 | 126 `vs` + 126 `with` rows, at `take: 200` |
| `banDay` with `groupByDay: true` | 1 | every hero × `take` days |
| `constants.heroes` | 1 | the hero reference |
| OpenDota `/api/constants/patch` | 1 | the patch list |

**About 516 requests, not the 135 the first probe estimated.** The difference
is entirely `matchUp`: its only time dimension is a week, so the ingest's cap of
four complete weeks costs 4 × 127 rather than 127. That is still about a third
of the hourly 1500 and a thirtieth of the daily 15000, so the job fits — but
the per-second ceiling of 8 now sets a floor on how long it takes, a little
over a minute of pure pacing rather than seventeen seconds.

The first probe's "about 130 requests" is superseded. It assumed one `matchUp`
request per hero, which is one hero-week, not one hero.

Two argument defaults were measured rather than assumed. `matchUp` defaults to
`take: 10`, which is why 200 is passed for the full 126 rows; and its `week`
argument is a Unix timestamp exactly as `stats`'s is — `week: 2954` returns
nothing, a timestamp inside that week returns the same rows as passing no week
at all, so the default is the current week. `banDay` requires a `heroId` but
ignores it under `groupByDay: true`, returning every hero.

## What this settles for the ingest

- The meta component and position shares come from `winDay`, filtered to
  `ALL_PICK_RANKED`, over the lesser of the days since the current patch's
  release and the thirty the endpoint will serve. The straddling-week problem
  the first probe raised does not arise for it.
- Matchups and synergies stay weekly, from `matchUp`, one request per hero per
  week, and carry the population mismatch above.
- Contest rate needs no extra request, but it is an approximation and not a
  measurement. The **divisor** is exact: a match holds ten distinct heroes in
  All Pick, so the total matches in a window is the sum of `matchCount` over
  every hero divided by 10. The **numerator** is not, because picks come from
  `winDay` and bans from `banDay`, and those two do not share a population —
  `banDay` takes the basic bracket enum and offers no game-mode filter at all.
  How far apart they are was **not measured**: the 2.1 above is `winDay` against
  `stats`, a different pair, and carrying it here would be an assumption wearing
  a measurement's digits. Nor is it known whether the difference falls alike on
  every hero, which a ranking needs. So the first probe's open question about
  the denominator is closed and a different one is opened in its place:
  `(picks + bans) / matches` orders heroes by contest and is not an absolute
  share.
- `constants.gameVersions` is not read at all.

# Third probe, 2026-08-22 — what `banDay` actually returns

Written while `snapshot-ingest` sat proposed and its ban requirement rested on
an unmeasured reading. Same environment and token, five requests: two
introspections and three queries. Everything below is measured; where it
contradicts what the delta spec assumed, the spec is what moves.

- **`heroId` is required and does not filter.** `banDay(heroId: Short!, day,
  bracketBasicIds, take, skip, groupByDay, groupByRank)` refuses a query
  without `heroId` — `PROVIDED_NON_NULL_ARGUMENTS` — and then ignores it.
  Control: `heroId: 1` and `heroId: 45`, identical otherwise, returned 3641
  rows each and the same set of `(heroId, day, matchCount)` triples. So one
  request does carry every hero, and the argument is a token the query must
  present rather than a filter it may use. Pass any valid id.
- **An absent row is a zero, and absence is the common case.** At
  `DIVINE_IMMORTAL` with `groupByDay: true, take: 30`, the response held 3641
  rows over 127 heroes and 30 days. The full grid is 3810, so 169 pairs are
  missing — and **no row carried `matchCount: 0`**. 51 of the 127 heroes are
  missing at least one day; hero 66 appears on 12 days of the 30. A run that
  treated an incomplete response as a failure would therefore fail on almost
  every window, and reading a missing pair as zero bans is the only reading the
  data supports.
- **`day` is a day number, not a Unix timestamp.** The rows run 20658 to 20687,
  and 20658 is 2026-07-24 counted in days from the epoch. This is *not* how
  `winDay` behaves: its `day` argument is a Unix timestamp in seconds, measured
  in the first probe. Two endpoints, two encodings of the same word.
- **There is no `banCount`.** `HeroBanType` carries `heroId`, `day`,
  `bracketBasicIds`, `matchCount` and `winCount`. The ban count is
  `matchCount`, which on this endpoint reads as bans rather than matches — a
  top hero's day peaks at 330 where a match count would run to thousands. That
  reading is an inference from magnitude and is the one thing here not measured
  directly.
