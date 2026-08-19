# Snapshot data sources — what was measured, 2026-08

Written for a session picking up Phase 3b (`snapshot-ingest`) cold.

**Probe environment.** Every observation below was taken on 2026-08-17 with
`curl` on macOS, keyless and unauthenticated, over plain HTTPS, no proxy.
Where a count is quoted it is the count one response carried. Treat all of it
as a snapshot, not a contract.

## Conclusion

Of the sources tested, none can replace STRATZ, and the reason is lane
position. Tested were OpenDota's `heroStats` and `heroes/{id}/matchups`
endpoints, its `/explorer` SQL interface and the schema of the three tables
that would feed this model, plus unauthenticated requests to dotabuff.com and
dota2protracker.com. Sources not tested — paid tiers, authenticated APIs,
anything behind an account — are ruled out by nothing here.

The position finding is the stronger half, because it rests on
`information_schema` rather than on which endpoints exist: OpenDota holds
`lane_role` only on `player_matches`, whose rows exist for parsed matches, and
`public_matches` — the bracket-filterable table — carries hero-id arrays with
no per-player lane at all.

`PLAN.md` carries the one-line constraint. The evidence is here.

## What OpenDota gives, measured

- `GET /api/heroStats` — 127 heroes, keyless. Carries per-rank-bracket picks
  and wins as `1_pick`/`1_win` … `8_pick`/`8_win`, so Divine (7) and Immortal
  (8) are separable. Also `img` and `icon`, which is what a mirroring job would
  read.
- Rate limits: the response carried `x-rate-limit-remaining-minute: 58` and
  `x-rate-limit-remaining-day: 2998`. Those are *remaining* quota after two
  requests, not stated ceilings; 60/min and 3000/day is the inference from
  them, and OpenDota's own documentation is where to confirm it.
- `GET /api/heroes/2/matchups` — 126 rows of `{hero_id, games_played, wins}`.
  **No bracket filter**, and the sample is thin: Axe against hero 11 was 434
  games across all brackets. The model smooths matchups with `k = 400` and sets
  sufficiency at 500/1000, so this endpoint delivers data at roughly the level
  of its own noise.
- `GET /api/explorer` — raw SQL over their match database. Works on trivial
  queries (`select 1` returned). Schema of the tables that matter:
  - `public_matches`: `match_id, match_seq_num, radiant_win, start_time,
    duration, lobby_type, game_mode, avg_rank_tier, num_rank_tier, cluster,
    radiant_team, dire_team` — bracket-filterable hero-id arrays, from which
    winrate by side, matchups, synergies and contest rate can all be derived.
  - `picks_bans`: `match_id, is_pick, hero_id, team, ord` — `ord` is pick
    order, so pick *phase* is recoverable, but only for matches whose draft is
    recorded (captains mode / parsed), which ranked All Pick is not.
  - `player_matches`: has `lane_role`, i.e. position — but only for **parsed**
    matches, a volunteer-requested subset, and the table carries no rank tier
    of its own.

## What was ruled out, and why

- **OpenDota as the source.** No lane position outside the parsed-match subset.
  `hero_position_stats` is what enemy-role inference and per-role suggestions
  both rest on, so a source without positions cannot feed the model at all.
- **OpenDota's `/explorer` as the nightly ingest.** One `GROUP BY` over
  `public_matches` for a 24-hour window returned HTTP 400 with
  `{"err":"Error: Query read timeout"}`. One query shape, tried once; whether
  a differently written aggregate fits inside their timeout was not tested.
- **dotabuff.com and dota2protracker.com.** `HEAD https://api.dotabuff.com/`
  and `HEAD https://dota2protracker.com/api` both returned `403`. No public
  API was found, which is not the same as neither publishing one — no
  documentation of either was read. d2pt's role in `spec-inbox/data-model.md`
  is the manual spot-check only (US-29), so its absence costs little either
  way.

## Open, and where it stopped

- **The STRATZ key.** A keyless `POST https://api.stratz.com/graphql` with
  `content-type: application/json` and body `{"query":"{__typename}"}`
  returned an HTML page titled "Just a moment…" carrying Cloudflare's headers
  — not a `401`, and not JSON. What that means was not established: it is
  consistent with a challenge shown to any browserless client, and equally
  with whatever the user saw when their sign-in failed. Nothing observed here
  bears on how a key is obtained.
- **Pick-phase granularity** (`data-model.md` §8.2) is still unresolved and is
  *not* a release blocker: zeroing `phase` for every hero leaves the component
  contributing nothing to any ranking. `src/model.ts:225` multiplies the weight
  by the delta without asking whether it was measured, and `src/model.ts:50-51`
  returns the stored value for a sufficient hero — so a uniform zero is safe
  and a partial zero ranks the measured above the missing. `PLAN.md`'s Phase 3b
  entry states that boundary.
- **STRATZ rate limits** were never measured, for want of a key. That is the
  one number Phase 3b's design needs before it can size the job.
