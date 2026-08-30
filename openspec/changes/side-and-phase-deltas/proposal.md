# side-and-phase-deltas

## Why

Two of the six components the draft model weighs have been a tautological
zero since the pipeline first ran. Measured on the live bundle: **0 of 127
heroes carry a non-zero `side`, 0 of 127 a non-zero `phase`.** A third of the
formula is inert, the UI has printed `phase: 2nd` over it the whole time, and
every gate this repository owns passed on every one of those runs.

The reason was never a defect. `staging_hero_sides` and
`staging_hero_phases` exist and no pull fills them, because the statistics
API publishes no faction dimension —
`docs/research/stratz-graphql-2026-08-29.md` searched every field, argument
and input of the schema for one. `snapshot-ingest` recorded them as a stated
non-goal and shipped.

`match-harvest` removes the reason. Every stored pick carries its side and
its order, every stored match carries which side won, so both components are
computable from the store without one request to the statistics API.

But filling the tables alone would trade one defect for another. The build
stores every delta as `wr_blend − 50` (*Smoothing towards neutral by sample
size*), and a hero winning 55% overall would then read +6 on the side it
prefers — carrying its own strength, which `meta` already carries:

```text
hero at 55% overall, 56% on Radiant, 55% at its role
  base 50    meta +5.0   side +6.0   →  +11.0    strength counted twice
  base 55    meta +5.0   side +1.0   →   +6.0
```

`src/types.ts:71` has said "relative to the hero's overall winrate" all
along. The arithmetic never matched it, and nothing noticed because the
numbers were zero.

## What Changes

- The two staging tables are filled from the harvested matches, so the
  components the build already knows how to blend finally have something to
  blend.
- A side or phase delta is measured against the hero's own overall winrate
  rather than against 50, which is what `src/types.ts` always claimed and
  what keeps the component from restating `meta`.
- `side` and `phase` stop being the components the source is known not to
  measure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `snapshot-build`: *Smoothing towards neutral by sample size* fixes the base
  every delta is taken from, and side and phase need a different one from the
  rest; *An unmeasured component is zero for every hero* names these two as
  the pair the source cannot measure, which stops being true.
- `snapshot-ingest`: *A run leaves staging whole or leaves it untouched*
  covers a staging write that now has two more tables in it.

## Non-goals

- **Pulling side or phase from the statistics API.** There is nothing to
  pull. The survey searched the whole schema for a faction dimension and
  `FilterHeroWinRequestGroupBy` offers none.
- **Changing what `meta`, `matchups` or `synergies` are measured against.**
  `meta` against 50 is correct — it is the hero's strength, and 50 is what
  strength is relative to. The pair matrices are `score-calibration`'s.
- **Fitting the weights.** `side` and `phase` weigh 1.0 each and have never
  weighed anything at all; what they are worth is a question for a figure,
  and `outcome-calibration` produces it.
- **Backfilling.** The components begin at the first run after the harvest
  has matches. No attempt is made to reconstruct what they would have been.
- **The stabilizing banner or anything the client shows.** Nothing about the
  bundle's shape changes; two fields stop being zero.

## Impact

- `src/job/ingest/staging.ts` — its comment says the two tables "are not
  touched: side and phase are this change's stated non-goals"; both halves
  stop being true.
- `src/job/build/rows.ts` — `split()` takes a base per component rather than
  the one `delta()` assumes.
- `src/job/build/blend.ts` — `NEUTRAL` is no longer the only base.
- `src/types.ts` — the two doc comments become true rather than changing.
- No new dependency, no request to the statistics API, no schema change: both
  tables and both `*_measured` flags were built for this.

## Ordering

This change reads `harvest_matches` and `harvest_picks`, so **`match-harvest`
must be applied first**. Like `score-calibration` it moves the score scale
without anything measuring the move, so it should follow
`outcome-calibration` too.
