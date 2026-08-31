# draft-model delta — suggestion-calibration

**Written against the version `lane-synergy-model` leaves behind** — the
fourth change to replace this one requirement, after `candidacy-gate`,
`laning-phase-model` and that one. The order is fixed and this is last.

## MODIFIED Requirements

### Requirement: Suggestion scoring

For each still-open role of my team the system SHALL score every candidate
`h ∉ teamPicks ∪ enemyPicks ∪ bans` that `candidacy-gate`'s conditions admit,
using the weighted sum of meta, side, phase, synergy, lane-weighted matchups,
lane, lane synergy, and counter-risk components from model-spec §3 with the
weights **`bundle.weights` carries when it does, and `MODEL_CONSTANTS.weights`
when it does not**, and SHALL return the top
`MODEL_CONSTANTS.suggestionsPerRole` candidates per role, descending by
score, with my own role's block first. Each entry SHALL carry the
per-component breakdown (weights already applied).

The `laneSynergy` component SHALL be `Σ_a laneAllies[h][r][a]` over the
**allies already picked**, weighted by the resolved set's `laneSynergy` —
the bundle's where it carries one and `MODEL_CONSTANTS.weights.laneSynergy`
only where it does not — with each absent leaf reading as 0 rather than
removing the term. It is 0 when the row is absent, or when no
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

The weights SHALL be read from the bundle where it carries them and from
`MODEL_CONSTANTS.weights` where it does not, exactly as `beta-refit` has the
model read `α` and `β`. A fitted set changes whenever the data does, and the
data changes nightly, so a constant in `src/types.ts` is stale by
construction; a bundle cached before the set existed is one the client holds,
so the constants stay as the fallback rather than being deleted.

A bundle carrying a partial set SHALL be refused rather than mixed: a set is
eight weights or it is none, and filling the gaps from `MODEL_CONSTANTS`
would produce a scoring rule that is half one fit and half another, which
nothing measured and nothing can attribute.

#### Scenario: The bundle's weights are the ones used

- **WHEN** one draft is scored against two bundles alike in every field but
  `weights.meta`
- **THEN** the two orderings SHALL differ where the component separates two
  candidates, so that a refit reaches the client without a deploy

#### Scenario: A bundle carrying no weights

- **IF** the bundle has no `weights`, as one cached before this change does
- **THEN** every component SHALL be weighted by `MODEL_CONSTANTS.weights`,
  and no score SHALL be `NaN`

#### Scenario: A bundle carrying some weights

- **IF** the bundle's `weights` names fewer than the eight components
- **THEN** the client SHALL treat the payload as malformed rather than
  filling the rest from `MODEL_CONSTANTS`

#### Scenario: An unfitted weight is still a weight

- **WHEN** the published set carries a component's hand-set value because the
  fit recorded it as unfitted
- **THEN** the model SHALL use it like any other, the distinction being the
  run's to record and not the model's to read

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

- **IF** the bundle carries no `lanes`, as one cached before
  `laning-phase-model` does
- **THEN** every `lane` component SHALL be 0 and no score SHALL be `NaN`

#### Scenario: The lane component is not weighted twice

- **WHEN** one candidate is scored against two enemies whose inferred roles
  differ
- **THEN** its `lane` component SHALL be the plain sum of the two stored
  values, unscaled by `laneWeights` and unnormalised by `L̄`

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
