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
whole nightly pull is about 130 requests against a ceiling of 1500 per hour.
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

```
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
insufficient quota. It is not needed: ~130 requests is under a tenth of the
hourly ceiling, and the per-second ceiling of 8 is the only one a naive loop
could trip.

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
- **One `matchUp` request per hero returns both matrices.** `HeroDryadType`
  carries `with` and `vs` side by side, each 126 rows, with `matchCount`,
  `winCount`, `synergy` and `winRateHeroId1`. 17 KB per hero.
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

- **The job's cadence against a weekly bucket.** History being retrievable
  settles staging's key; what it opens instead is when the job should run at
  all, and whether `winDay` offers a daily granularity `heroStats.stats` does
  not. Both belong to the ingest and to whoever sets the schedule, not to the
  build.
- **Contest rate's denominator.** `banDay` gives bans with a bracket filter and
  a `day` dimension; picks come from `stats`. Nothing here checked that the two
  cover the same match population, which is what makes `(picks + bans) / matches`
  meaningful.
- **The `x-steamid-ok: false` header** on every successful response was not
  explained. It did not prevent any query run here.
