# cm-model delta — captains-mode-assistant

## Purpose

How the Captains Mode page values a draft: what each team's heroes are worth
at the positions they are assigned to, and the lookahead search that ranks
the bans and picks for the step in progress, assuming the enemy drafts by
the same values.

## ADDED Requirements

### Requirement: A team is valued in percentage points

A team's value SHALL be, in percentage points: the sum over its picked
heroes of `ρ(p) · (meta(h, k) + comfort(p, h))`, plus each hero's side delta
for the team's side and phase delta for its CM pick phase, plus `syn[a][b]`
once per pair of its heroes, plus the All Pick model's lane-weighted matchup
component against the enemy's assigned heroes. A draft's evaluation SHALL be
the captain's team value minus the enemy's.

#### Scenario: Valuing a team

- **WHEN** no hero has been picked by either team
- **THEN** both team values and the evaluation SHALL be exactly 0
- **AND WHEN** a team's first, second, fourth and fifth picks are valued,
  their phase deltas SHALL be read from the snapshot's `p1`, `p2`, `p2` and
  `last` respectively

### Requirement: A player's signatures and rank weigh their slot

`comfort(p, h)` SHALL be 3.0 when `h` is one of player `p`'s signature heroes
and 0 otherwise. `ρ(p)` SHALL be `1 + 0.1 · (rank(p) − mean rank of p's team)`
clamped to [0.75, 1.25], the mean taken over the team's players of known rank,
and 1 for a player of unknown rank.

#### Scenario: A signature hero outranks an equal one

- **WHEN** two heroes carry identical statistics and the player at the open
  position has rank 6 in a team of mean rank 5 with the first hero as a
  signature
- **THEN** the first hero SHALL rank above the second, its score higher by
  exactly 3.3
- **AND WHEN** a player is rank 8 in a team whose known ranks average 3,
  that player's weight SHALL be 1.25

### Requirement: Heroes are assigned to the positions that maximise the team

A team's picked heroes SHALL be assigned to its positions — its players'
known positions held fixed — by the assignment of greatest team value among
all of them. A hero SHALL count as able to play a position when its snapshot
share there is at least 0.05; a hero assigned elsewhere SHALL contribute a
meta of −10 at that position.

#### Scenario: A flexible hero takes the open slot

- **WHEN** the team has picked a hero playable only at position 1 and a hero
  playable at positions 1 and 3, both stronger at position 1
- **THEN** the first SHALL be assigned position 1 and the second position 3

#### Scenario: The assignment is shown

- **WHEN** the captain's team holds picks
- **THEN** the board SHALL show each pick's assigned position and the
  nickname of the player holding it

### Requirement: The step in progress gets ranked suggestions

For each step the page SHALL list up to five heroes — the candidates the
search ranks highest for the captain's ban or pick, or on an enemy step the
heroes it expects the enemy to take — each with its score and the components
it is made of. A candidate SHALL be untaken, `sufficient`, and able to play a
position its team still has open.

#### Scenario: Components add up to the score

- **WHEN** a pick suggestion is shown
- **THEN** the components shown beside it SHALL sum to its score within 0.05

#### Scenario: An enemy step

- **WHEN** the step in progress is the enemy's pick
- **THEN** the list SHALL be headed as the enemy's expected picks and offer
  no control entering a hero for the captain's team

### Requirement: The search looks past the enemy's answer

A candidate's score SHALL be the evaluation the search reaches after it,
each later step taken by its team to maximise its own value, with the
remaining picks completed greedily past the search's depth. The search SHALL
deepen one step at a time within a 1500 ms budget and report the depth it
completed.

#### Scenario: A ban that would hand the enemy a better pick

- **WHEN** banning hero X removes more enemy value than banning hero Y, but
  after X is banned the enemy's best remaining pick gains it more than after
  Y is banned, by more than the difference
- **THEN** Y SHALL rank above X

#### Scenario: The search answers within its budget

- **WHEN** a step is entered on the full snapshot fixture
- **THEN** suggestions SHALL be shown within 1700 ms, with a reported depth of
  at least 2

### Requirement: A newer draft state replaces the search

The search SHALL run off the page's main thread. WHEN the draft changes while
a search runs, that search SHALL be abandoned and its result SHALL never be
shown; the page SHALL stay responsive to input throughout.

#### Scenario: Entering two steps quickly

- **WHEN** a step is entered and another is entered 100 ms later
- **THEN** the suggestions shown SHALL be the ones computed for the second
  state, and none computed for the first SHALL appear in between
