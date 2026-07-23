## ADDED Requirements

### Requirement: Pure deterministic computation

`computeModel(bundle, session)` SHALL be a pure function: its output SHALL
depend only on its two arguments, and it SHALL NOT mutate either argument,
read the clock, or read any external state.

#### Scenario: Editing invariant (model-spec §7.6)

- **WHEN** a hero pick is added to the session and then removed, restoring
  the session to a value equal to a prior session
- **THEN** `computeModel` SHALL return output byte-for-byte identical to the
  output for that prior session

#### Scenario: Inputs are not mutated

- **WHEN** `computeModel(bundle, session)` returns
- **THEN** `bundle` and `session` SHALL be structurally equal to their
  values before the call

### Requirement: Pick phase derivation

The system SHALL derive the current pick phase `p` from the count `k` of
non-null slots in `session.teamPicks`: WHEN `k ≤ 1` THEN `p = "p1"`; WHEN
`k ∈ {2, 3}` THEN `p = "p2"`; WHEN `k = 4` THEN `p = "last"`.

#### Scenario: Empty team

- **WHEN** `session.teamPicks` has zero non-null slots
- **THEN** `output.phase` SHALL equal `"p1"`

#### Scenario: Four picked

- **WHEN** `session.teamPicks` has exactly four non-null slots
- **THEN** `output.phase` SHALL equal `"last"`

### Requirement: Enemy role inference

The system SHALL enumerate all injective assignments of entered enemy picks
to roles, weight each assignment by the product of `max(share(e, σ(e)), ε)`
with `ε = MODEL_CONSTANTS.epsilon`, normalize over all assignments, and
return per-enemy role marginals that SHALL sum to 1 (± 1e-9) across the five
roles. The system SHALL also compute per-role openness
`open(r) = 1 − Σ_e P(e, r)`.

#### Scenario: No enemies entered

- **WHEN** `session.enemyPicks` is empty
- **THEN** `output.enemyRoles` SHALL be empty **AND** every value in
  `output.enemyOpenRoles` SHALL equal 1

#### Scenario: Marginal redistribution (model-spec §7.4)

- **WHEN** a second enemy whose pick shares are concentrated on the same
  role as an already-entered enemy is added
- **THEN** the first enemy's marginal for that contested role SHALL
  decrease relative to its value before the second enemy was added

### Requirement: Suggestion scoring

For each still-open role of my team the system SHALL score every candidate
`h ∉ teamPicks ∪ enemyPicks ∪ bans` with `sufficient = true` and
`share(h, r) > 0`, using the weighted sum of meta, side, phase, synergy,
lane-weighted matchups, and counter-risk components from model-spec §3 with
the weights in `MODEL_CONSTANTS.weights`, and SHALL return the top
`MODEL_CONSTANTS.suggestionsPerRole` candidates per role, descending by
score, with my own role's block first. Each entry SHALL carry the
per-component breakdown (weights already applied).

#### Scenario: Empty draft components (model-spec §7.1)

- **WHEN** the session has no allies picked and no enemies entered
- **THEN** every suggestion entry's `matchups` and `synergy` components
  SHALL be exactly 0 (both sums are empty). Counter-risk is NOT zero
  pre-draft — with no enemies, `open(r)=1` and `pop(c)=contest(c)`, so it
  still perturbs ordering; the §7.1 "pure meta+side" reading holds only up
  to that term.

#### Scenario: Counter-risk monotonic in bans (model-spec §7.2)

- **WHEN** the heroes that are the dominant counter-threats to a candidate
  are added to `session.bans`
- **THEN** that candidate's `counterRisk` component SHALL increase (toward
  zero) and its total score SHALL not decrease

### Requirement: Win probability at full draft

WHEN and only WHEN `|teamPicks non-null| = 5` and `|enemyPicks| = 5` the
system SHALL compute draft advantage `Δ` per model-spec §4 and return
`winEstimate = { advantage: Δ, winProbability: 1/(1+e^(−β·Δ)) }` with
`β = MODEL_CONSTANTS.beta`; otherwise `output.winEstimate` SHALL be `null`.

#### Scenario: Incomplete draft

- **WHEN** fewer than ten total picks are entered
- **THEN** `output.winEstimate` SHALL be `null`

#### Scenario: Antisymmetry (model-spec §7.3)

- **WHEN** a full draft and its mirror (teams swapped, side disabled to
  remove the side-delta term) are both scored
- **THEN** `winProbability(mirror)` SHALL equal `1 − winProbability(original)`
  to ~1 decimal place. Exact antisymmetry does not hold: the model treats
  my roles as known and enemy roles as inferred, so the residual is the
  role-inference impurity, not floating-point error.

### Requirement: Insufficient-data handling

For any hero or hero-position with `sufficient = false`, the system SHALL
treat its meta/side/phase/matchup/synergy deltas as 0 and its position
shares as uniform over positions where it has any picks, SHALL exclude it
from suggestion candidates and from counter-risk candidates, but SHALL
still include entered picks of such heroes as neutral terms.

#### Scenario: Insufficient hero picked (model-spec §7.5)

- **WHEN** a hero with `sufficient = false` is entered as a pick
- **THEN** it SHALL NOT appear in any suggestion block or affect any
  counter-risk sum, and all other candidates' scores SHALL change only by
  that hero's neutral (zero-delta) contribution
