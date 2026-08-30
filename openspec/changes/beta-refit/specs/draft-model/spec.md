# draft-model delta — beta-refit

## MODIFIED Requirements

### Requirement: Win probability at full draft

WHEN and only WHEN `|teamPicks non-null| = 5` and `|enemyPicks| = 5` the
system SHALL compute draft advantage `Δ` per model-spec §4 and return
`winEstimate = { advantage: Δ, winProbability: 1/(1+e^(−(α·s + β·Δ))) }`;
otherwise `output.winEstimate` SHALL be `null`.

`β` is the slope per percentage point of advantage and `α` the side's own
advantage in log-odds. Both SHALL be read from `bundle.calibration` when it
is present, and from `MODEL_CONSTANTS` when it is not — a bundle published
before the pair existed is one the client holds in its cache, and the model
is handed it. `MODEL_CONSTANTS` SHALL therefore carry `alpha` beside `beta`,
which it does not today: a requirement naming a fallback that its source of
truth does not hold is a requirement satisfied by `undefined`.

`Δ` is computed from **my team's** perspective — `src/model.ts` sums the
allies' terms and subtracts the enemies' — while the pair is fitted over
`Δ` computed from Radiant's, which is what *A stored draft is scored as a
Radiant-perspective session* fixes. The two need no conversion, and the
reason is the antisymmetry below: a Dire draft's `Δ` is the negative of the
same draft scored as Radiant, so `σ(−α − β·Δ_radiant)` is both `1 − P(Radiant
wins)` and the serve-time formula at `s = −1`. One fitted pair therefore
serves both sides. The residual is the same role-inference impurity
*Antisymmetry* already bounds, and no larger: `α` and `β` inherit it rather
than adding one.

`s` SHALL be `+1` when `session.side` is `"radiant"`, `−1` when it is
`"dire"`, and `0` when it is `null`. The intercept is the side's advantage
and not a constant of the model, so it carries the side's sign; a flat `α`
would answer the same for both teams, which is the one thing the quantity
cannot mean. It is also what keeps *Antisymmetry* below exact: swapping the
teams swaps the side, so `α·s` changes sign with `β·Δ` rather than surviving
the swap.

WHERE `session.side` is `null` the estimate SHALL answer 50% at `Δ = 0`,
which is correct rather than a fallback: without a side there is no side
advantage to apply.

#### Scenario: Incomplete draft

- **WHEN** fewer than ten total picks are entered
- **THEN** `output.winEstimate` SHALL be `null`

#### Scenario: A bundle carrying no calibration

- **IF** the bundle handed to the model has no `calibration`, as one cached
  before this change does
- **THEN** the estimate SHALL use `MODEL_CONSTANTS.beta` and
  `MODEL_CONSTANTS.alpha`, and SHALL NOT be `null` and SHALL NOT be `NaN`

#### Scenario: The side carries the intercept's sign

- **WHEN** one full draft is scored with `side: "radiant"` and the same
  draft with `side: "dire"`, at a bundle whose `α` is greater than 0
- **THEN** the two `winProbability` values SHALL differ, and the Radiant one
  SHALL be the larger — the ordering follows `α`'s sign, so a negative `α`
  would reverse it and a zero one would collapse the two

#### Scenario: No side entered

- **WHEN** a full draft is scored with `session.side` of `null` and a `Δ` of
  0
- **THEN** `winProbability` SHALL be 0.5 exactly, the intercept applying
  only where a side is known

#### Scenario: Antisymmetry (model-spec §7.3)

- **WHEN** a full draft and its mirror (teams swapped, side disabled to
  remove the side-delta term) are both scored
- **THEN** `winProbability(mirror)` SHALL equal `1 − winProbability(original)`
  to ~1 decimal place. Exact antisymmetry does not hold: the model treats
  my roles as known and enemy roles as inferred, so the residual is the
  role-inference impurity, not floating-point error.

#### Scenario: The bundle's slope is the one used

- **WHEN** one draft whose `Δ` is not 0 is scored against two bundles alike
  in every field but `calibration.beta`
- **THEN** the two `winProbability` values SHALL differ, so that a refit
  reaches the client without a deploy. `Δ ≠ 0` is required of the case: at
  `Δ = 0` the slope multiplies nothing and the two bundles agree however far
  apart their `β` is
