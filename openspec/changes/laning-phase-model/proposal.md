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
  antisymmetric and needs saying so. Its centring and its derived constant
  are an **added** requirement rather than an amendment to *Smoothing towards
  neutral by sample size*, which `side-and-phase-deltas` already modifies.
- `snapshot-export`: an **added** requirement for the lane matrix, which is
  keyed by position as well as by hero. *Pair statistics are expanded into
  full matrices* is deliberately untouched: `score-calibration` modifies it.
- `draft-model`: *Suggestion scoring* fixes the components a score sums and
  the weights they carry, and a seventh component is that sentence.
  **This delta is written against the version `candidacy-gate` leaves
  behind**, which modifies the same requirement.

Three of the four requirements this change would naturally touch are already
being modified by changes that have not been applied. Two of those collisions
are routed into added requirements — and are the better shape anyway, the
lane statistic being keyed differently from the two before it. The third
cannot be: a component joining a weighted sum is the sentence
`candidacy-gate` edits. With no order between two changes modifying one
requirement, the second to sync silently drops the first's edit.

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
  `share >= 5%` against 128 heroes, and twelve weeks rather than the pair
  pull's four: 3 600 requests on top of today's 516, paced across about three
  hours rather than refused. *The window, and the constant it needs* below
  carries why twelve, and what the hourly ceiling does.

## The window, and the constant it needs

The pull is thin per pair, and both halves of the fix are measured rather
than chosen.

**Twelve weeks, because the quantity does not drift.** Nyx Assassin at
position 3, weeks 7–12 against weeks 1–6, over the 69 pairs carrying 60 games
in each half: **corr +0.801, mean absolute difference 3.4 pp**. That window
spans a letter patch — 7.41e released on 30 July — so a lane delta survives
one. It is bounded by the **major** patch rather than by the current letter
patch, which is the opposite of what *Pair statistics are pulled per hero*
does, and the drift figure is why.

**A smoothing constant in the tens, not 400.** `k` is per statistic already —
300 for meta, 400 for a pair, 500 for side and phase — and the right one
follows from how much of a delta's spread is real. Decomposing the observed
spread into signal and binomial noise, over twelve weeks:

```text
cell                     pairs   n/pair   sd obs   noise   sd true    k
Nyx Assassin at 3 (median)  94      323      7.5     3.9       6.4    61
Pudge at 2 (busiest)       106      678     12.9     4.4      12.2    17
Juggernaut at 1            125     5264      8.7     2.1       8.4    35
```

`k = p(1−p)·10⁴ / var_true`, which is the shrinkage that is optimal rather
than cautious. A lane delta needs less shrinking than a match one **because
it carries more signal** — the same fact the 32.6 pp spread showed, arriving
as a constant. At `k = 40` a median pair keeps 0.89 of its delta where
`k = 400` keeps 0.38.

Two independent readings agree: Spearman–Brown on the split-half correlation
gives a reliability of `2(0.801)/1.801 = 0.889` at twelve weeks, against the
0.80 the variance decomposition gives at the same depth.

**What the window costs.** 300 cells at `share >= 5%` times twelve weeks is
3 600 requests on top of today's 516. The hourly ceiling of 1 500 does not
refuse it: *A run stays inside the quota the API states* has a run wait for a
refilling window and continue, failing only on the longest window, and the
daily ceiling is 15 000. So the cost is about three hours of wall clock, and
*An invocation arriving while a run is in flight* already refuses an overlap.

## Open Questions

- **`k` varies by cell — 17 to 61 across three.** A single constant is what
  the build's shape allows and ~40 is the middle of them, but three cells do
  not fix it. It is re-derived over every cell during implementation, and the
  step that does it records the spread rather than the mean alone.
- **The window against a major patch.** Twelve weeks is measured to survive a
  letter patch and nothing here measures a major one. Until something does,
  the window is capped at the major patch's own age.

## Ordering

**`candidacy-gate` must be applied and synced first.** The `draft-model`
delta replaces the requirement that change also replaces, and is copied from
the version it leaves behind; out of order, the sync drops one of the two
edits and nothing says which.

It adds a component to the suggestion score besides, so it SHOULD NOT land
between `outcome-calibration` and `suggestion-calibration` — a weight fit
taken over six components and applied to seven is a fit for a model that no
longer exists.

Otherwise independent of the calibration chain. The two collisions with
`side-and-phase-deltas` and `score-calibration` are routed into added
requirements precisely so that neither change has to wait for the other.
