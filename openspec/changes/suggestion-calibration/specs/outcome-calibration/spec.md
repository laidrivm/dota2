# outcome-calibration delta — suggestion-calibration

**Written against the version `beta-refit` leaves behind.** That change
creates both requirements below; there is no version of either on `main`.

## RENAMED Requirements

- FROM: `### Requirement: The logistic's two parameters are fitted over the store`
- TO: `### Requirement: The logistic's parameters are fitted over the store`

The heading counted the parameters and this change adds more, so the count
goes. Renamed rather than edited inside the MODIFIED block below, because a
`MODIFIED` delta matches the live requirement by its heading: changed there
and nowhere else, the sync would look for a heading no spec holds.

The `FROM:` line runs one column past this file's wrap and stays on one line
anyway — the parser reads only a list item's first line, so wrapping it
truncated the heading to `…are fitted over` and the rename would have matched
nothing. Nothing in the repository enforces the wrap and `docs/` already
carries an 87-column line; the parser is the harder constraint.

## MODIFIED Requirements

### Requirement: The logistic's parameters are fitted over the store

A calibration run SHALL fit `α` and the coefficients of
`P(Radiant wins) = 1/(1+e^(−(α + Σ wᵢ·cᵢ)))` by maximum likelihood over every
match the run could score, where `cᵢ` is a component's own contribution to
the draft advantage, and SHALL record them on the run's row beside the
figures it already records.

`Σ wᵢ·cᵢ` is what `beta-refit` fits as `β·Δ`, opened up. `Δ` was never one
quantity: it is the sum of the components `draft-model` §*Suggestion
scoring* names, each multiplied by a weight set by hand and never measured.
Fitting one slope over their sum asks how much the whole is worth; fitting
the coefficients asks how much each is, which is the question the weights
have stood in for.

The run SHALL emit each `cᵢ` **separately** rather than deriving one as the
residual of `Δ` less the others. The enemy contribution is role-inferred
inside the model, so a residual carries that inference into whichever
component is computed last, and the coefficient fitted for it is then a
coefficient for two things.

A component whose column has no variance over the scored matches SHALL be
recorded as unfitted with its hand-set weight kept, and the fit SHALL NOT
fail — publication remaining the refusal requirement's to decide:
`side` is exactly this today, 0 of 127 heroes carrying a non-zero side delta,
so its term is identically 0 and its coefficient is unidentifiable rather
than merely thin. It becomes fittable when `side-and-phase-deltas` lands, and
nothing about that is this requirement's to arrange.

Only components that reach `Δ` may be fitted here. `src/model.ts` sums the
win estimate from four of the eight — `meta`, `side`, `synergy`, `matchups` —
and the other four reach a candidate's score alone: `counterRisk` is 0 once
every enemy slot is filled, `phase` is a fact about when a hero was picked,
and the two lane components are summed over a board still being built. A
stored full draft carries no evidence about any of them, and *Suggestion
weights are fitted over a replayed draft* is where they are fitted instead.

Measured over 1 469 Divine and Immortal drafts against a centred bundle, the
three fittable columns are near enough orthogonal for a fit to separate them
— pairwise |r| at most 0.234, `meta` against `matchups` at −0.018 — so the
question is well posed rather than merely well intentioned.

The fit SHALL run over every scorable match the store holds, not over the
matches the run's own night added. `beta-refit` bootstrapped the single
slope over 1 446 scored matches, and its band narrows with the sample
slowly:

```text
n        median     5–95%             spread
200      0.0168     0.0022–0.0329     ±92%
400      0.0154     0.0075–0.0274     ±65%
800      0.0154     0.0108–0.0241     ±43%
1 446    0.0161     0.0120–0.0215     ±30%
```

Those figures are a **floor** for this requirement rather than its
expectation: they were measured fitting one coefficient, and this fits
several from the same matches. Splitting one sample's information across
more parameters widens every band, so a spread of ±30% at 1 446 is the best
case a many-coefficient fit could inherit and not what it will show. Nothing
here has measured what it does show, and the run's own record of the sample
size is what makes that readable.

`α` is the steady one, sitting between 0.090 and 0.100 at every size. The
coefficients are what the sample buys, and a night's matches do not buy them
— the more of them there are, the less it buys.

Scoring SHALL use the perspective *A stored draft is scored as a
Radiant-perspective session* fixes, so every `cᵢ` and `didRadiantWin` are read
from one side throughout and the fitted `α` is the Radiant advantage rather
than a quantity that changes meaning halfway through the store.

The parameters this requirement fits are `α` and the vector `w`, and **there
is no `β`**: a run's row carries the vector, never a scalar slope beside it.
The last two scenarios below are `beta-refit`'s arithmetic, carried because
it was worked out by hand and still has to hold, restated over the
one-component case — one column, so `w` has one element, which is the number
that change called `β`. The name goes and the value does not.

Two of them fix what the **fit returns**, never what the run publishes:
whether anything reaches the bundle is decided by *A fit that cannot be
trusted is refused, not published* alone. Prose is kept above the first
scenario rather than between two, because the parser reads a paragraph after
a scenario as part of it — `beta-refit`'s version of this requirement has it
between, and this replaces that version.

#### Scenario: A fit over the whole store

- **WHEN** a run scores the matches its own night added and the store holds
  older scorable ones
- **THEN** the fit SHALL be taken over all of them, and the count it was
  taken over SHALL be recorded on the run's row

#### Scenario: A component with no variance

- **WHEN** every scored draft carries the same value for one component, as
  `side` does at 0 today
- **THEN** the fit SHALL return that component as unfitted with its hand-set
  weight kept and the others fitted over the remaining columns, and SHALL NOT
  fail — whether the set then reaches the bundle is *A weight fit that cannot
  be trusted is refused*'s alone, and a set carrying an unfitted component
  still has to clear it

#### Scenario: Each component measured, none derived

- **WHEN** a run emits the columns it fits over
- **THEN** each SHALL be computed from its own definition, and none SHALL be
  taken as `Δ` less the others — a residual carries the enemy role inference
  into whichever component is computed last

#### Scenario: Both parameters, never one

- **WHEN** a fit is taken over ten matches at `Δ = −1` of which five are
  Radiant wins and ten at `Δ = +1` of which eight are
- **THEN** it SHALL return `α = 0.6931` and a one-element `w` of `0.6931` to
  four decimals, whose log-likelihood is `−11.9355` against the `−12.9489` of
  the best fit holding `α` at 0

#### Scenario: A sample the slope alone already fits

- **WHEN** a fit is taken over ten matches at `Δ = −1` of which three are
  Radiant wins and twenty at `Δ = +1` of which fourteen are, a marginal
  Radiant rate of 56.67%
- **THEN** it SHALL return `α = 0` and a one-element `w` of `0.8473`, the two
  log-likelihoods being equal at `−18.3259` — a maximum-likelihood `α` of 0 is
  a fitted value rather than an unfitted one

## ADDED Requirements

### Requirement: Suggestion weights are fitted over a replayed draft

The four components that never reach `Δ` SHALL be fitted over stored drafts
replayed **pick by pick**: at each pick the store records, the run SHALL
build the session as it stood before that pick and score the hero actually
taken, so that a component defined over open slots has open slots to be
defined over.

The response fitted against SHALL be the match outcome, attributed to the
side that made the pick. That is a weaker signal than the full draft's — one
outcome answers for ten picks — and the requirement says so rather than
implying otherwise: what it can establish is whether a component's score at
pick time carries information about the result, not how much of the result
that pick caused.

Every row a replay produces SHALL inherit the fold of the match it came from,
so that a match's ten picks fall on one side of the held-out partition
together. Split row by row they would land on both, and the fit would be
scored on an outcome it had already seen ten times — the Brier reading
better than the model is. *A fit that cannot be trusted is refused, not
published* fixes the partition as `match_id mod 5`, which is already
match-level; this says the replay's rows take their match's value rather than
one of their own.

A replay SHALL use the pick order the store holds and the bundle the run is
scoring against, never the bundle in force when the match was played. The
second would be a different question — how good the advice was at the time —
and no stored bundle answers it.

#### Scenario: A component with open slots to be defined over

- **WHEN** the third pick of a side is replayed
- **THEN** the session scored SHALL hold that side's two earlier picks and no
  later one, and `counterRisk` SHALL be non-zero, the enemy having slots
  still open

#### Scenario: One match's picks share a fold

- **WHEN** a match's ten replayed picks are partitioned
- **THEN** all ten SHALL fall in the same fold, and none of the fitted
  coefficients SHALL have been fitted on a row whose match also appears in
  the held-out set

#### Scenario: The replay uses the current bundle

- **WHEN** a match played under an earlier patch is replayed
- **THEN** it SHALL be scored against the bundle the run holds, and a match
  naming a hero that bundle lacks SHALL be counted unscorable rather than
  scored short

#### Scenario: One outcome, ten picks

- **WHEN** the fit records what it established
- **THEN** it SHALL record the number of picks each outcome was attributed
  to, so that a coefficient's precision is readable rather than implied

### Requirement: A weight fit that cannot be trusted is refused

A run SHALL publish a fitted weight set only when it clears the conditions
*A fit that cannot be trusted is refused, not published* fixes for the pair,
read over the whole set rather than over one coefficient — every coefficient
inside `[0, 5]` where that requirement bounds `β` by `[0, 1]`, a weight of 5
being a component the fit says is worth five times what the hand-set set
assumed and 5.01 being a fit that has come apart — and one more condition of
its own: **the fitted set SHALL beat the hand-set weights on the same
held-out partition**, not merely the base rate. A set that predicts better than
answering the base rate and worse than the weights already shipped is a
regression the base-rate floor cannot see.

A refused fit SHALL leave the previously published set standing, and where
none has been published the bundle SHALL omit the set and the model SHALL
fall back to `MODEL_CONSTANTS.weights`, on the terms the pair's own refusal
already fixes.

#### Scenario: Better than the base rate and worse than what ships

- **IF** the fitted set's held-out Brier is below the base-rate predictor's
  and at or above the hand-set weights' over the same partition
- **THEN** no set SHALL be published, and the run SHALL record both figures

#### Scenario: An unfitted component in a published set

- **WHEN** a set is published while one component was recorded as unfitted
- **THEN** that component's published weight SHALL be its hand-set value, and
  the run's row SHALL name it as unfitted rather than as fitted to that
  number
