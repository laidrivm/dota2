# laning-phase-model

## Why

The model has a lane concept and no lane data. `MODEL_CONSTANTS.laneWeights`
is a hand-set 5×5 matrix — 1.0, 1.5, 1.75 — standing for which roles meet in
which lane, and `matchupComponent` weights every enemy through it. What it
then weights is a **match** statistic: `heroStats.matchUp`, the only pair
source the project reads, answers "who won the game".

Those are close to independent quantities. Phantom Lancer at position 1
against its 35 most frequent lane opponents, Divine and Immortal, each pair
at 200 games or more:

```text
opponent            n     lane pp   match pp   the adv stored today
Rubick            964      −10.3       −0.8           +0.56
Pudge             877      −15.3       −3.8           −2.79
Underlord         824       −8.9       +6.6           +4.33
Axe               749      −13.6       −2.5           −3.79
Dawnbreaker       597      −13.5       +0.1           −4.31

spread         lane 32.6 pp    match 14.3 pp
corr(lane pp, match pp)                   +0.066
corr(lane pp, the adv stored today)       +0.204
```

A correlation of 0.066 is not a signal the matrices already carry in weaker
form — it is a different question about the same two heroes, with a spread
more than twice as wide. Underlord is +6.6 pp on the game and −8.9 on the
lane: Phantom Lancer loses the stand-off and wins the match anyway, which is
what a scaling carry does and what the model cannot currently say.

`docs/research/stratz-graphql-2026-08-29.md` §2 establishes that the source
pairs by **shared lane rather than by team membership** — a carry's
opponents are 71.6% the offlane duo and 3.4% other carries — so `heroId2` is
a hero actually stood against, not merely on the other side.

## What Changes

- The ingest gains a pull for lane outcomes against the heroes a candidate
  actually stands against. Which cells are asked for, and what the pull costs,
  are `snapshot-ingest`'s.
- The build stores and blends it as a pair statistic like the two it already
  has, and centres it. Why centring is not deferred is `snapshot-build`'s.
- The bundle carries a third matrix, and the suggestion score a sixth
  component weighted beside `matchups`.

## Capabilities

### New Capabilities

None. Every part of this is a third instance of a pair statistic the
pipeline already pulls, stores, blends, exports and scores twice over.

### Modified Capabilities

- `snapshot-ingest`: *Pair statistics are pulled per hero over at most four
  weeks* fixes what a pair pull asks for and how it is paced, and this adds a
  pull with a different shape — per hero **and position**, where the two it
  covers are per hero alone.
- `snapshot-build`: *Stored pair statistics carry their symmetry* fixes which
  matrices are antisymmetric and which symmetric; a lane matchup is
  antisymmetric and needs saying so.
- `snapshot-export`: *Pair statistics are expanded into full matrices* fixes
  what the bundle's matrices hold; a third one joins them.
- `draft-model`: *Suggestion scoring* fixes the components a score sums and
  the weights they carry.

## Non-goals

- **Lane allies.** `isWith: true` answers the synergy question — who I stand
  *beside* — and belongs against `synergies` rather than `matchups`. It is a
  separate change for a reason beyond scope: it doubles this pull, and
  whether a lane synergy adds anything over the match synergy is a question
  its own measurement has to answer, not one this change's evidence covers.
- **Replacing `laneWeights` with measured pairing frequency.** The source
  publishes who stands against whom, so the hand-set matrix could be fitted.
  It is a different change and a smaller prize: it re-weights the existing
  match-based term and carries none of the 32.6 pp this one is about.
- **The win estimate.** `beta-refit` fits a logistic against the `Δ` the
  model produces today. Adding a term to `Δ` while that fit is in flight
  invalidates it, and the two changes would each be measured through the
  other's movement.
- **Fitting the new weight.** It enters at 1.0 beside the five others that
  were never fitted either. `suggestion-calibration` fits all of them, and
  this change adds a seventh parameter to that fit rather than guessing one.
- **Lower brackets.** The pull is Divine and Immortal, as every pair pull
  here already is.

## Impact

- `src/job/ingest/pairs.ts` — a second query shape beside `matchUp`.
- `src/job/schema.sql` — a table for the statistic, and staging for it.
- `src/job/build/` — the blend and smoothing already generalise; the centring
  is where the new code is.
- `src/job/export/render.ts` — a third matrix assembled the way two are.
- `src/model.ts` — one component in `scoreEntry`, and `src/types.ts` gains
  `lanes` on the bundle and `lane` on a suggestion's components. **The file
  is at exactly its 300-line cap**, so the step that touches it splits it
  first.
- `src/fixtures/snapshot.json` — regenerated.
- No new dependency. The pull is per hero **and position**, where the two it
  joins are per hero alone, so it multiplies where they do not: 300 cells at
  `share >= 5%` against 128 heroes. At the pair pull's four-week cap that is
  1 200 requests on top of today's 508, over the hourly ceiling of 1 500. Two
  weeks fits at 600 added, 1 108 in all.

## Open Questions

**The depth this arrives at is the question the change turns on, and the
evidence above does not settle it.** The 32.6 pp spread was measured over
Phantom Lancer's 35 fattest opponents at position 1 — the busiest cell of the
busiest configuration, each pair at 200 games or more. Away from it the pairs
are thin, because the pull splits by position *and* needs the two heroes
actually stood in one lane:

```text
cell                     2 weeks, per pair   n/(n+400) survives smoothing
Pudge at 2 (busiest)                   132                          25%
Nyx Assassin at 3 (median)              50                          11%
Chen at 5 (thinnest)                    33                           8%
a matchup pair today                 ~2 600                         87%
```

At `k = 400` — the constant *Smoothing towards neutral by sample size* fixes
for a pair statistic — a median lane pair arrives at 11% of its measured
size. Four weeks does not rescue it either: it reaches about 100 a pair.

So one of three has to give, and none is free:

- **A lower `k` for this statistic.** Defensible on its own terms — the
  constant is per statistic already — but it means calling a 50-game delta
  believable, which is what `k` exists to refuse.
- **More weeks.** The lane signal is a laning-phase property and drifts more
  slowly than a match one, so a longer window may be sound; but the requests
  are linear in weeks and the ceiling is 1 500.
- **A coarser pairing.** Lane outcome against an opposing **position** rather
  than an opposing hero pools 126 rows into 5 and puts every cell in the
  thousands. It stops being a pair statistic and much of the 32.6 pp is the
  pairing.

## Ordering

Independent of the calibration chain, with one exception: it adds a component
to the suggestion score, so it SHOULD NOT land between `outcome-calibration`
and `suggestion-calibration` — a weight fit taken over five components and
applied to six is a fit for a model that no longer exists.
