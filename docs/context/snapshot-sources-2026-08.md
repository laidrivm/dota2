# Snapshot data sources — what was measured, 2026-08

Written for a session picking up Phase 3b (`snapshot-ingest`) cold. Everything
below was probed live on 2026-08-17; treat the numbers as a snapshot, not a
contract.

## Conclusion

STRATZ has no substitute for this model, and the reason is lane position.

`PLAN.md` carries the one-line constraint. The evidence is here.

## What OpenDota gives, measured

- `GET /api/heroStats` — 127 heroes, keyless. Carries per-rank-bracket picks
  and wins as `1_pick`/`1_win` … `8_pick`/`8_win`, so Divine (7) and Immortal
  (8) are separable. Also `img` and `icon`, which is what a mirroring job would
  read.
- Rate limits, from the response headers: `x-rate-limit-remaining-minute: 58`
  and `x-rate-limit-remaining-day: 2998` — so 60/min and 3000/day without a
  key.
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
- **OpenDota's `/explorer` as the nightly ingest.** One aggregate over
  `public_matches` for a 24-hour window returned
  `{"err":"Error: Query read timeout"}`. Their timeout is well below what a
  daily aggregate needs.
- **dotabuff.com and dota2protracker.com.** Both answered `403` to a plain
  request; neither publishes an API. d2pt's role in `spec-inbox/data-model.md`
  is the manual spot-check only (US-29), so its absence costs nothing.

## Open, and where it stopped

- **The STRATZ key.** A keyless `POST https://api.stratz.com/graphql` returned
  a Cloudflare interstitial ("Just a moment…"), not a `401`. That is bot
  protection for a browserless request; it neither confirms nor refutes the
  report that their sign-in was down. The key still has to come from a web
  login.
- **Pick-phase granularity** (`data-model.md` §8.2) is still unresolved and is
  *not* a release blocker: zeroing `phase` for every hero leaves the component
  contributing nothing to any ranking. `src/model.ts:225` multiplies the weight
  by the delta without asking whether it was measured, and `src/model.ts:50-51`
  returns the stored value for a sufficient hero — so a uniform zero is safe
  and a partial zero ranks the measured above the missing. `PLAN.md`'s Phase 3b
  entry states that boundary.
- **STRATZ rate limits** were never measured, for want of a key. That is the
  one number Phase 3b's design needs before it can size the job.
