# draft-model delta — lane-synergy-model

**Written against the version `laning-phase-model` leaves behind**, which is
itself written against `candidacy-gate`'s. Three changes replace this one
requirement and the order is fixed: `candidacy-gate`, then
`laning-phase-model`, then this.

## MODIFIED Requirements

### Requirement: Suggestion scoring

For each still-open role of my team the system SHALL score every candidate
`h ∉ teamPicks ∪ enemyPicks ∪ bans` that `candidacy-gate`'s conditions admit,
using the weighted sum of meta, side, phase, synergy, lane-weighted matchups,
lane, **lane synergy**, and counter-risk components from model-spec §3 with
the weights in `MODEL_CONSTANTS.weights`, and SHALL return the top
`MODEL_CONSTANTS.suggestionsPerRole` candidates per role, descending by
score, with my own role's block first. Each entry SHALL carry the
per-component breakdown (weights already applied).

The `laneSynergy` component SHALL be `Σ_a laneAllies[h][r][a]` over the
**allies already picked**, weighted by
`MODEL_CONSTANTS.weights.laneSynergy`, where each absent leaf reads as 0
rather than removing the term. It is 0 when the row is absent, or when no
picked ally appears in it.

Over allies and not over enemies, which is what distinguishes it from `lane`:
one answers who I stand beside and the other who I stand against, and the
draft supplies each from a different half of the board. Like `lane`, it SHALL
NOT be weighted through `laneWeights` — the statistic was counted from who
actually stood together, so weighting it by a guess at the same thing applies
the correction twice.

It is summed beside `synergy` rather than folded into it because the two
answer different questions: over Phantom Lancer's 84 most frequent lane
allies at position 1, the lane delta and the stored synergy correlate
`+0.182`, and the lane spread is 44.4 pp against the match's 23.0.

#### Scenario: Empty draft components (model-spec §7.1)

- **WHEN** the session has no allies picked and no enemies entered
- **THEN** every suggestion entry's `matchups`, `synergy`, `lane` and
  `laneSynergy` components SHALL be exactly 0 (the sums are empty).
  Counter-risk is NOT zero pre-draft — with no enemies, `open(r)=1` and
  `pop(c)=contest(c)`, so it still perturbs ordering; the §7.1 "pure
  meta+side" reading holds only up to that term.

#### Scenario: Counter-risk monotonic in bans (model-spec §7.2)

- **WHEN** the heroes that are the dominant counter-threats to a candidate
  are added to `session.bans`
- **THEN** that candidate's `counterRisk` component SHALL increase (toward
  zero) and its total score SHALL not decrease

#### Scenario: The two lane components read opposite halves of the board

- **WHEN** a draft carries two picked allies and two entered enemies, and the
  candidate has rows in both statistics for all four
- **THEN** its `lane` component SHALL sum the two enemies' values only and
  its `laneSynergy` the two allies' only, neither reading the other's heroes

#### Scenario: Allies picked but none in the row

- **WHEN** allies are picked and the candidate's `laneAllies` row covers none
  of them
- **THEN** its `laneSynergy` SHALL be 0 and its other components unchanged

#### Scenario: A bundle predating the ally matrix

- **IF** the bundle carries `lanes` and no `laneAllies`, as one published
  between the two changes does
- **THEN** every `laneSynergy` component SHALL be exactly 0, `lane` SHALL be
  unaffected, and no score SHALL be `NaN`
