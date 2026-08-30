# match-harvest

## Why

Nothing in this project has ever measured whether the model is any good.

The cost of that is not hypothetical. Two of the six components the draft
model weighs — `side` and `phase` — are a tautological zero for every hero in
the published bundle, and have been since the pipeline first ran: no pull
fills `staging_hero_sides` or `staging_hero_phases`, so `sideDelta` and
`phaseDelta` return 0 whatever the draft. Measured on the live bundle on
2026-08-29: 0 of 127 heroes carry a non-zero `side`, 0 of 127 a non-zero
`phase`. A third of the formula has been inert for months, the UI has printed
`phase: 2nd` over it the whole time, and every gate this repository owns
passed on every one of those runs. A suite fails on what someone thought to
assert; an accuracy figure fails on what nobody thought of at all.

`docs/research/stratz-graphql-2026-08-29.md` establishes that the data to
compute one exists and what it costs: ranked All Pick matches come back with
their picks in order, their bans, every player's position, and who won.

This change harvests them and stores them. Scoring them is the next change's;
the harvest is what that change has nothing to read without.

## What Changes

- The nightly job gains a fourth step, after the export, that records
  finished ranked All Pick matches: the draft as it was, and the result.
- New tables hold one row per match and one per pick and ban, carrying the
  pick order, the side, the position and the lane the API returns in the same
  response — measured at 1 request per 100 matches, against 1 request per
  match to fetch any of it afterwards, the batch-by-ids query being closed to
  non-admin keys.
- The store is bounded by a count of matches. The patch each match belongs to
  is recorded but never consulted by the bound: relevance is the reader's
  filter, disk is retention's business, and patches run from 7 to 200 days,
  so a patch-shaped bound is not a bound.
- The run's report says how many matches the harvest added, rejected and
  dropped, so a step that silently stopped working is visible where a failed
  pull already is.

## Capabilities

### New Capabilities

- `match-harvest`: where finished matches come from, what of each one is
  kept, what bounds the store, and what the run reports about it.

### Modified Capabilities

- `snapshot-ingest`: its *The job carries a run to one outcome* requirement
  fixes the entry point at three steps in a stated order; there are four now,
  and where the fourth sits relative to the export is the whole of why a
  harvest can never cost the application its bundle.

## Non-goals

- **Scoring anything.** No prediction, no Brier score, no accuracy figure, no
  baseline. This change stores the inputs and the outcome and computes
  nothing from them — `outcome-calibration` is the change that reads them,
  and splitting the two means a wrong metric costs a rewrite of the metric
  rather than of the harvest.
- **Side and phase deltas.** They are computable from what this stores, and
  that is the point, but counting them is `side-deltas`.
- **Replaying a draft.** The pick order this stores is what makes calibrating
  suggestions possible later; nothing here replays anything.
- **Lane outcome.** `heroStats.laneOutcome` is an aggregate endpoint with its
  own cost, not match-level data, and not this change's.
- **`imp`.** STRATZ's per-player performance score arrives in the same
  response and is null in four of six matches sampled. It is a post-game
  judgement of a player, not an input to a draft.
- **Alerting.** A harvest that fails is reported where a failed pull already
  is; routing that anywhere is `PLAN.md`'s open error-tracking task.

## Impact

- `src/job/schema.sql` — three tables, and their reclaim in
  `src/job/db.fixture.ts`, without which no suite may write to them: the
  cleaner's `DELETE FROM heroes` would fail on the foreign key and take every
  other database suite with it.
- `src/job/` — a new module for the harvest, and its retention beside it, for
  the reason `retention.ts` sits beside `build.ts`.
- `src/job/ingest/stratz.ts` — unchanged. The client already paces on the
  `x-ratelimit-*` headers the API states, so a fourth caller inherits the
  pacing rather than adding to it.
- `src/job/run.ts` — a fourth step and a fourth failure to report.
- `openspec/specs/snapshot-ingest/spec.md` — one requirement modified.
- `PLAN.md` — its queue, in the pull request that merges the last step.
- No new dependency. No change to `src/model.ts`, `src/types.ts`, the bundle,
  or anything the client fetches: nothing this change writes is served.
