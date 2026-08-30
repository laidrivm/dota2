# draft-model delta — candidacy-gate

## MODIFIED Requirements

### Requirement: Suggestion scoring

For each still-open role of my team the system SHALL score every candidate
`h ∉ teamPicks ∪ enemyPicks ∪ bans` with `sufficient = true` and
`share(h, r) >= MODEL_CONSTANTS.minShare`, using the weighted sum of meta,
side, phase, synergy, lane-weighted matchups, and counter-risk components
from model-spec §3 with the weights in `MODEL_CONSTANTS.weights`, and SHALL
return the top `MODEL_CONSTANTS.suggestionsPerRole` candidates per role,
descending by score, with my own role's block first. Each entry SHALL carry
the per-component breakdown (weights already applied).

`minShare` SHALL be `0.005`. It answers a question `sufficient` does not:
`sufficient` fires at `n_eff >= 500` and says a winrate is worth believing,
while `minShare` says the role is one the hero is actually played in. A
popular hero clears 500 games at a role holding 0.35% of its picks, so the
first test passes on a role the second refuses, which is the defect.

The threshold SHALL apply to the candidate set alone. It SHALL NOT reach the
enemy role inference of §1, where a share is evidence about a hero somebody
has already picked rather than a recommendation, nor the counter-risk
candidate pool of §3.2, where an enemy who might pick a hero off-role is a
risk whether or not this model would suggest it.

#### Scenario: A role the hero is barely played in

- **WHEN** a hero's position carries `sufficient = true` and a share below
  `minShare`, as Phantom Lancer's position 3 does at 0.0035
- **THEN** it SHALL NOT appear among that role's suggestions

#### Scenario: A role at exactly the threshold

- **WHEN** a hero's position carries `sufficient = true` and a share of
  exactly `minShare`
- **THEN** it SHALL be scored, the bound being inclusive

#### Scenario: The threshold does not reach enemy role inference

- **WHEN** an enemy pick is a hero whose share at some role is below
  `minShare`
- **THEN** that role SHALL keep the marginal probability §1 gives it, the
  enemy having already picked the hero

#### Scenario: The threshold does not reach counter-risk

- **WHEN** the counter-risk pool of §3.2 is built
- **THEN** a hero's popularity SHALL be summed over every role its share
  covers, the threshold removing none of them

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
