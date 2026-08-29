# STRATZ GraphQL API — survey of 2026-08-29

What the API offers, what this project currently reads from it, and what it
could read but does not. Written to answer four questions the draft model had
no data for; kept because the same questions recur whenever a component is
added to the formula.

**This is a survey, not a specification.** Every figure below was read from
the live API on 2026-08-29 under one Immortal-bracket key. Re-check before
depending on one: the schema moves, and a field populated for one game mode
is routinely null for another.

## How this was produced, and how to redo it

The GraphiQL console at <https://api.stratz.com/graphiql> is a single-page app
with no linkable per-type URL, so it was not crawled. Standard GraphQL
introspection answers the same question in one request:

```sh
KEY=$(grep '^STRATZ_API_KEY' .env | cut -d= -f2- | tr -d '"' )
curl -s https://api.stratz.com/graphql -X POST \
  -H "authorization: Bearer $KEY" \
  -H "user-agent: STRATZ_API" \
  -H "content-type: application/json" \
  --data '{"query":"query { __schema { types { kind name description fields(includeDeprecated:true){ name description args{ name type{ kind name ofType{ kind name } } } type{ kind name ofType{ kind name ofType{ kind name } } } } inputFields{ name description type{ kind name ofType{ kind name } } } enumValues{ name } } } }"}'
```

`user-agent: STRATZ_API` is not optional — the Cloudflare gate in front of the
endpoint answers a request without it with a challenge page, which is why
`src/job/ingest/stratz.ts` sends it.

Alongside this file:

- `stratz-schema-2026-08-29.txt` — the draft-relevant surface of the schema:
  every field, argument and result type of the endpoints below, and the enums
  they take. The full response is 513 types and 732 KB, most of it leagues,
  guilds and battle-pass records this project will never read, so only the
  subset is kept. A single-line 732 KB JSON also hangs `biome ci`, which is
  the mechanical reason the raw file is not tracked.
- `query-schema.py` — dumps one type's fields, arguments and enum values from
  a full introspection response, for the case the subset does not answer:
  `python3 docs/research/query-schema.py <schema.json> HeroStatsQuery`

## Quota

Read from `x-ratelimit-*` on any response:

| Window | Ceiling |
|---|---|
| second | 8 |
| minute | 150 |
| hour | 1 500 |
| day | 15 000 |

A nightly ingest run was observed to have consumed roughly 500 of the daily
15 000 before this survey began. `src/job/ingest/quota.ts` already paces on
these headers rather than on constants, so a new pull inherits the pacing.

`take` is capped at **100** on `player.matches`; asking for more is an error,
not a silent truncation.

## What the project reads today

| Endpoint | Module | What it feeds |
|---|---|---|
| `heroStats.winDay` | `ingest/meta.ts` | per-position winrate → `meta` |
| `heroStats.banDay` | `ingest/contest.ts` | ban counts → `contest` |
| `heroStats.matchUp` | `ingest/pairs.ts` | `with`/`vs` match winrate → `synergies`, `matchups` |

Nothing else. All three are aggregates; the project issues no match-level
query at all.

## Findings

### 1. Side (Radiant/Dire) is not available from any aggregate

Searched every field, argument and input field in the schema for
`radiant|faction|side`. Faction appears only on match-scoped and
player-scoped types:

- `MatchType.didRadiantWin`, `MatchPlayerType.isRadiant`
- `PlayerMatchesRequestType.isRadiant`, `MatchGroupByFactionType.isRadiant`

The `heroStats.win*` family takes `bracketIds`, `positionIds`, `regionIds`,
`gameModeIds` and `groupBy`, and `FilterHeroWinRequestGroupBy` offers only
`HERO_ID`, `ALL`, `HERO_ID_DURATION_MINUTES`, `TIME`,
`HERO_ID_POSITION_BRACKET`. **No faction dimension exists.**

Consequence: per-hero side deltas cannot be pulled. They have to be counted
from match-level data — the same source a prediction backtest needs, so the
two belong together.

### 2. Lane outcome is published, separately from match outcome

`heroStats.laneOutcome(heroId, isWith, week, bracketBasicIds, positionIds)`
returns `HeroLaneOutcomeType`:

```
heroId1  heroId2  position  bracketBasicIds  week
matchCount  winCount  lossCount  drawCount        <- the LANE result
stompWinCount  stompLossCount                     <- decisive lane results
matchWinCount                                     <- the MATCH result
csCount
```

`isWith` switches between allies and opponents. Crucially, the pairing is by
**shared lane, not by team membership** — established by mapping every
`heroId2` in a position-1 pull to that hero's own dominant position:

| dominant position of `heroId2` | share of `isWith: true` samples | share of `isWith: false` |
|---|---|---|
| 1 | 2.4% | 3.4% |
| 2 | 2.7% | 6.9% |
| 3 | 1.6% | 38.7% |
| 4 | 27.5% | 32.9% |
| 5 | 65.8% | 18.1% |

A carry's allies are 93.3% supports and its opponents 71.6% offlane duo. Under
team membership a mid would be a quarter of the ally list; it is 2.7%. So this
is the lane, and `heroId2` is a hero actually stood next to or against.

The five verdicts are mutually exclusive and exhaustive — verified on all 104
rows of one pull:

```
matchCount = winCount + drawCount + lossCount + stompWinCount + stompLossCount
```

`matchWinCount` is counted over the same `matchCount` but is otherwise
independent of the five, which is the whole point of the endpoint. Phantom
Lancer at position 1, Divine/Immortal, wins folded with stomps and draws
counted as half:

| ally | n | lane pp | match pp |
|---|---|---|---|
| Lion | 943 | **−9.4** | **+3.3** |
| Winter Wyvern | 798 | +5.8 | +8.6 |
| Lich | 671 | +2.0 | +6.3 |
| Undying | 658 | +18.5 | +5.3 |
| Disruptor | 620 | +0.8 | +6.1 |
| Crystal Maiden | 611 | −0.4 | +0.2 |
| Pudge | 606 | −5.1 | −0.3 |
| Hoodwink | 585 | +7.7 | +2.5 |

The lane column spans 28 pp across these eight; the match column spans 9 pp.
The lane signal is both wider and, for PL with Lion, of the opposite sign to
the match signal `heroStats.matchUp` publishes — which is the only source the
project reads today.

Sample sizes for one hero at one position, Divine/Immortal:

| | rows | lane samples |
|---|---|---|
| `isWith: true` | 104 | 15 672 |
| `isWith: false` | 125 | 31 220 |

Cost of a full pull: 126 heroes × 5 positions × 2 (`isWith`) = **1 260
requests**, about one hour under the 1 500/hour ceiling and 8% of the daily
quota. Restricting to the positions a component actually weights cuts it
proportionally.

### 3. Match-level data: reachable, but only through a player

There is no global "recent matches" feed. `DotaQuery.match(id)` and
`DotaQuery.matches(ids)` both require ids. The reachable route is:

```
leaderboard.season(request: {leaderBoardDivision: EUROPE})
  .players(skip, take) -> steamAccountId
     |
     v
player(steamAccountId).matches(request: PlayerMatchesRequestType)
     |
     v
MatchType { didRadiantWin, pickBans, players, bracket, ... }
```

`leaderboard.season` reports `playerCount: 10043` for EUROPE alone; four
divisions exist (`AMERICAS`, `SE_ASIA`, `EUROPE`, `CHINA`). Sourcing match
ids from leaderboard members makes every match Immortal by construction,
which matches the `bracketIds: [DIVINE, IMMORTAL]` filter the meta pull
already applies. `PlayerMatchesRequestType` additionally offers `rankIds`,
`bracketIds`, `startDateTime`, `endDateTime`, `gameModeIds`, `lobbyTypeIds`,
`isParsed` and `isStats`.

The filter that returns ranked All Pick pubs:
`{gameModeIds: [22], lobbyTypeIds: [7]}` → `ALL_PICK_RANKED` / `RANKED`.

**Not every leaderboard member yields matches.** Of six mid-leaderboard
players sampled, three returned ranked All Pick matches and three returned
none — the top of the board is pros playing `CAPTAINS_MODE` / `PRACTICE`
scrims. A harvester must expect empty players and page past them.

### 4. What a ranked All Pick match actually carries

Read from match `8972858399` (`ALL_PICK_RANKED`, `RANKED`, bracket 8):

`pickBans` — 28 entries, 10 picks and 18 bans:

| field | picks (10) | bans (18) |
|---|---|---|
| `heroId` | set | null |
| `bannedHeroId` | null | set |
| `order` | **set** | null |
| `isRadiant` | **set** | null |
| `wasBannedSuccessfully` | null | set |

So the ten picks carry both their order and their side — a draft can be
replayed pick by pick. Bans carry neither, so which team banned what is not
recoverable; `Session.bans` is a flat list too, so nothing is lost.

`players` — all ten, with `position` non-null (`POSITION_1`..`POSITION_5`),
`lane` (`SAFE_LANE` / `MID_LANE` / `OFF_LANE`), and `imp`. Positions being
populated is what makes a replayed draft comparable to this project's
per-role suggestions.

`averageRank` was null on every ranked pub sampled; `bracket` was set (8).
Do not filter on `averageRank`.

`MatchStatsPickBanType` also carries `baseWinRate` and `adjustedWinRate` —
STRATZ's own pre-match numbers, usable as a free baseline for any accuracy
harness.

## Available and unused — candidates for the formula

Ranked by how directly they answer a question the model currently guesses at.
None of these is verified beyond its schema entry and, where marked, one live
call.

| Endpoint | What it adds | Verified |
|---|---|---|
| `heroStats.laneOutcome` | lane result separated from match result, pairwise, per position, with/vs | live |
| `MatchType.pickBans` + `players.position` | draft replay with order and side; ground truth for suggestion scoring | live |
| `MatchType.{top,mid,bottom}LaneOutcome`, `laneReport` | per-match lane verdict | schema only |
| `heroStats.heroVsHeroMatchup` | comparison of skill between heroes, hero-page series | schema only |
| `heroStats.winWeek` / `winMonth` / `winGameVersion` | longer windows than the 12-day `winDay` the meta pull uses | schema only |
| `heroStats.stats(groupByPosition, groupByBracket, minTime, maxTime)` | per-minute detail; a duration-conditional reading of hero strength | schema only |
| `MatchPlayerType.imp` | STRATZ's per-player performance score, per match | live |
| `heroStats.itemStartingPurchase`, `itemFullPurchase`, `talent`, `abilityMinLevel` | build-level signal; irrelevant to a draft-time model | schema only |

`stompWinCount` / `stompLossCount` on `laneOutcome` are worth a look on their
own: a decisive lane loss is the outcome the model most wants to warn about,
and it is counted separately from an ordinary one.

## Reference: enums worth having to hand

```
RankBracket             UNCALIBRATED HERALD GUARDIAN CRUSADER ARCHON
                        LEGEND ANCIENT DIVINE IMMORTAL
RankBracketBasicEnum    UNCALIBRATED HERALD_GUARDIAN CRUSADER_ARCHON
                        LEGEND_ANCIENT DIVINE_IMMORTAL FILTERED ALL
MatchPlayerPositionType POSITION_1..POSITION_5 UNKNOWN FILTERED ALL
LeaderboardDivision     AMERICAS SE_ASIA EUROPE CHINA
FilterHeroWinRequestGroupBy
                        HERO_ID ALL HERO_ID_DURATION_MINUTES TIME
                        HERO_ID_POSITION_BRACKET
```
