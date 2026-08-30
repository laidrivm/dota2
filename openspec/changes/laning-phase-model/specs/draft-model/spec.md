# draft-model delta — laning-phase-model

**This delta is written against the version `candidacy-gate` leaves behind,
not against `main`.** That change modifies the same requirement — it fixes
which candidates are scored at all — and with no order between them the
second to sync would drop the first's edit. Unlike `snapshot-build` and
`snapshot-export` above, the collision cannot be routed into an added
requirement: a component joining the weighted sum is the same sentence
`candidacy-gate` edits, and two requirements each naming the components of
one score would be the duplication a delta spec exists to prevent.

## MODIFIED Requirements

### Requirement: Suggestion scoring

For each still-open role of my team the system SHALL score every candidate
`h ∉ teamPicks ∪ enemyPicks ∪ bans` that `candidacy-gate`'s conditions admit,
using the weighted sum of meta, side, phase, synergy, lane-weighted matchups,
**lane**, and counter-risk components from model-spec §3 with the weights in
`MODEL_CONSTANTS.weights`, and SHALL return the top
`MODEL_CONSTANTS.suggestionsPerRole` candidates per role, descending by
score, with my own role's block first. Each entry SHALL carry the
per-component breakdown (weights already applied).

The `lane` component SHALL be `Σ_e lanes[h][r][e]` over the entered enemies,
weighted by `MODEL_CONSTANTS.weights.lane`, where **each absent leaf reads as
0** rather than removing the term. One enemy the row does not cover
contributes nothing and leaves every covered enemy's contribution standing;
the whole component is 0 only when the row is absent, or when no entered
enemy has a value in it.

It SHALL NOT be weighted through `laneWeights`, which `matchups` is. That
matrix is a hand-set guess at which roles meet in which lane, and this
statistic was counted from who actually stood together — weighting a measured
lane pairing by a guessed one would apply the same correction twice, once
right and once approximately.

The component answers a different question from `matchups` rather than a
sharper version of it, which is why it is summed beside rather than folded
in: over Phantom Lancer's 35 most frequent lane opponents at position 1, the
lane delta and the match delta correlate `+0.066`, and the lane spread is
32.6 pp against the match's 14.3.

#### Scenario: Empty draft components (model-spec §7.1)

- **WHEN** the session has no allies picked and no enemies entered
- **THEN** every suggestion entry's `matchups`, `synergy` and `lane`
  components SHALL be exactly 0 (the sums are empty). Counter-risk is NOT
  zero pre-draft — with no enemies, `open(r)=1` and `pop(c)=contest(c)`, so
  it still perturbs ordering; the §7.1 "pure meta+side" reading holds only
  up to that term.

#### Scenario: Counter-risk monotonic in bans (model-spec §7.2)

- **WHEN** the heroes that are the dominant counter-threats to a candidate
  are added to `session.bans`
- **THEN** that candidate's `counterRisk` component SHALL increase (toward
  zero) and its total score SHALL not decrease

#### Scenario: A candidate with no lane row at the role scored

- **WHEN** a candidate is scored for a role its lane data does not cover,
  its share there having been below the pull's floor
- **THEN** its `lane` component SHALL be 0 and its other components SHALL be
  unchanged — a hero nobody plays there is not thereby a bad laner

#### Scenario: One enemy covered and one not

- **WHEN** a candidate's lane row holds a value for one entered enemy and no
  key for another
- **THEN** its `lane` component SHALL be the covered enemy's value times the
  weight, and SHALL NOT be 0

#### Scenario: A bundle predating the lane matrix

- **IF** the bundle carries no `lanes`, as one cached before this change
  does
- **THEN** every `lane` component SHALL be 0 and no score SHALL be `NaN`

#### Scenario: The lane component is not weighted twice

- **WHEN** one candidate is scored against two enemies whose inferred roles
  differ
- **THEN** its `lane` component SHALL be the plain sum of the two stored
  values, unscaled by `laneWeights` and unnormalised by `L̄`
