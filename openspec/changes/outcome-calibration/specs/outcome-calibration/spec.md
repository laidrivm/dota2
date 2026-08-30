# outcome-calibration Specification

## ADDED Requirements

### Requirement: A stored draft is scored as a Radiant-perspective session

The scorer SHALL turn each stored match into a `Session` and pass it to
`computeModel` with the current bundle, taking the `winEstimate` as the
model's probability that **Radiant** wins.

Radiant is the perspective because it is the only one that makes the figure
comparable with the baseline: the model's estimate answers "does my team
win", the store records which side won, and fixing the perspective on one
side is what lets a single number be scored against `didRadiantWin` without
a convention that flips halfway through the store.

The session SHALL carry the Radiant picks in their stored positions as
`teamPicks`, the Dire picks as `enemyPicks`, `side: "radiant"`, and the
stored bans as `bans`. The bans SHALL be passed whole and without a side,
which is what the store holds and what `Session.bans` declares.

#### Scenario: A full draft becomes a session

- **WHEN** a stored match with ten picks is scored
- **THEN** its five Radiant picks SHALL fill `teamPicks` at their stored
  positions, its five Dire picks SHALL be `enemyPicks`, `side` SHALL be
  `"radiant"`, and `bans` SHALL hold every stored ban

#### Scenario: A draft naming a hero the bundle does not carry

- **IF** a stored pick names a hero absent from the current bundle, as a
  match played before a hero was added or after one was removed does
- **THEN** the match SHALL NOT be scored, and SHALL be counted as unscorable
  rather than scored against a draft short of ten heroes

#### Scenario: A match the model returns no estimate for

- **IF** `computeModel` returns `winEstimate: null` for a session built from
  a stored match
- **THEN** the match SHALL be counted as unscorable, and no probability SHALL
  be invented for it

### Requirement: A run records the model's score and the baseline it must beat

Each scoring run SHALL record exactly one row, against the snapshot whose
bundle produced the estimates: how many matches it scored, how many it could
not, the model's Brier score, the model's accuracy, and the Brier score and
accuracy of the always-Radiant baseline over the same matches. It SHALL NOT
store a per-match prediction — a prediction is a pure function of a stored
draft and a bundle, so a table of them would hold a derivation of two things
the database already has.

Brier SHALL be the mean of `(p − outcome)²` over the scored matches, where
`outcome` is 1 when Radiant won and 0 otherwise. Accuracy SHALL be the share
of scored matches where `p > 0.5` and Radiant won, or `p ≤ 0.5` and Radiant
lost: a probability of exactly `0.5` counts as predicting Dire. The tie has
to fall somewhere and nothing distinguishes the two directions, so it is
fixed here rather than left to whichever comparison an implementation
reaches for.

Brier SHALL be the deciding figure and accuracy SHALL be recorded beside it.
Accuracy cannot see the failure this project already has: over 1 788 measured
matches, always-Radiant at `p = 0.534`, at `p = 0.75` and at `p = 0.99` all
score 53.4% accuracy and 0.2489, 0.2957 and 0.4572 Brier. A model claiming
99% where it should claim 53% is invisible to one and glaring to the other.

The baseline's probability SHALL be the Radiant win rate of the matches
scored in that run, not a constant written into the code. A rate that drifts
with the meta, the bracket or the region would otherwise leave the model
compared against a floor from another population; taking it from the same
matches also makes the floor the best a constant predictor could do, which is
the conservative direction.

#### Scenario: A probability of exactly one half

- **WHEN** the model returns `winProbability` of exactly `0.5` for a match
- **THEN** accuracy SHALL count it correct only where Radiant lost

#### Scenario: One row per run and no per-match row

- **WHEN** a run scores a thousand matches
- **THEN** it SHALL write one row of figures and no row per match

#### Scenario: The baseline comes from the matches scored

- **WHEN** a run scores a set of matches of which some fraction were Radiant
  wins
- **THEN** the baseline probability SHALL be that fraction, and its Brier and
  accuracy SHALL be computed over the same matches the model was scored on

#### Scenario: A run that could score nothing

- **IF** no stored match could be scored
- **THEN** the run SHALL record that it scored none rather than record a
  Brier score over an empty set

#### Scenario: The figures name the snapshot that produced them

- **WHEN** a run's figures are recorded
- **THEN** they SHALL carry the snapshot whose bundle scored the matches, so
  that two runs over the same matches under different bundles are two rows
  and not one overwritten

### Requirement: Scoring is repeatable without the statistics API

The scorer SHALL be invocable on its own, scoring the stored matches against
the newest published snapshot without running the ingest, the build, the
export or the harvest, and SHALL issue no request to the statistics API in
any mode. Everything it reads is already in the database, so repeating it
costs nothing that would have to be paced or budgeted — which is what makes
trying a calibration variant against the same matches practical rather than a
day's wait.

#### Scenario: The scorer invoked on its own

- **WHEN** the scorer is invoked without the other steps
- **THEN** it SHALL score the stored matches and exit zero, no request to the
  statistics API having been made
