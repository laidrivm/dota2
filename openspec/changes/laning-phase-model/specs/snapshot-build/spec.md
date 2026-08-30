# snapshot-build delta — laning-phase-model

## MODIFIED Requirements

### Requirement: Stored pair statistics carry their symmetry

The build SHALL store matchups antisymmetrically, so that where rows exist
for both orders `advantage_adj(a, b) = −advantage_adj(b, a)` within 1e-6,
and SHALL store each synergy once, on the row whose `hero_id` is less than
its `ally_id` (data-model §4.4).

A lane matchup SHALL be stored antisymmetrically too, and per position: the
row is `(hero, position, opponent)`, because what a hero does in a lane is
not what it does at another position. The invariant holds within a lane, over
the pair as each hero was counted at its own position; nothing here asserts
anything across two different positions.

#### Scenario: A matchup pair

- **WHEN** `hero_matchups` holds rows for both `(a, b)` and `(b, a)`
- **THEN** their `advantage_adj` values SHALL sum to 0 within 1e-6

#### Scenario: A synergy pair

- **WHEN** heroes `a` and `b` have played together and `a < b`
- **THEN** `hero_synergies` SHALL hold the row `(a, b)` and SHALL NOT hold
  the row `(b, a)`

#### Scenario: A lane pair, each hero at its own position

- **WHEN** `hero_lanes` holds a row for `(a, r, b)` and one for `(b, r', a)`,
  `r` and `r'` being the positions each hero was counted at in that lane
- **THEN** their `lane_adj` values SHALL sum to 0 within 1e-6

## ADDED Requirements

### Requirement: The lane statistic is centred and its constant is derived

Two things this statistic does that the two before it do not, and both are
because it is thinner and carries more signal per game.

**It is centred where it is stored, not later.** The build SHALL subtract,
from each lane delta, the mean of that hero's lane deltas at that position
over its opponents. A stored `winrate − 50` carries the hero's own strength
into every cell of its row, and `meta` carries that strength already — which
is the defect `score-calibration` exists to repair in the two matrices that
were not centred. A lane delta carries it more heavily, because how well a
hero stands a lane is a property of the hero: Phantom Lancer at position 1 is
negative against all nine of its most frequent opponents, −4 to −15 pp.
Doing it at the source costs the same pass and spares this statistic that
change.

**Its smoothing constant is derived rather than chosen.** *Smoothing towards
neutral by sample size* fixes `k` per statistic — 300, 400, 500 — and for
this one the build SHALL compute
`k = p(1−p)·10⁴ / var_true`, where `var_true` is the variance of the stored
deltas less the binomial sampling variance at their own sample sizes. That is
the shrinkage that is optimal rather than cautious, and it is what makes a
thin statistic usable: a lane pair reaches 244 games at the median cell over
twelve weeks, which `k = 400` would shrink to 38% of its size.

Derived on three cells over twelve weeks it came out 61 at the median cell,
17 at the busiest and 35 at a third — tens rather than hundreds, because a
lane delta carries more real signal than a match one. Three cells do not fix
a constant, so the build SHALL derive it over every cell it holds and record
both the value and the spread of the per-cell figures, never the mean alone.

#### Scenario: The mean opponent gives no lane advantage

- **WHEN** the stored lane deltas are read for one hero at one position
- **THEN** their mean over that hero's opponents SHALL be 0, so that a value
  says how much *this* opponent troubles it rather than how well it lanes

#### Scenario: A hero with one lane opponent

- **WHEN** a hero at a position has exactly one opponent row
- **THEN** centring SHALL store it as 0, the mean being its own value — the
  pass erases a one-opponent cell rather than preserving it, and that is the
  arithmetic rather than a case to work around

#### Scenario: The constant is derived, not configured

- **WHEN** a build computes the lane statistic's `k`
- **THEN** it SHALL compute it from that run's own stored deltas and sample
  sizes, and SHALL record the value and the spread of the per-cell figures on
  the snapshot

#### Scenario: A derived constant far from what was measured

- **IF** the derived `k` falls outside `[5, 400]`
- **THEN** the build SHALL fail rather than publish — three cells measured 17
  to 61, and a figure an order of magnitude outside that says the
  decomposition read noise as signal or the reverse

#### Scenario: A spread that is entirely noise

- **IF** the observed variance of the lane deltas does not exceed the
  binomial variance at their sample sizes
- **THEN** `var_true` is not positive, no `k` follows from it, and the build
  SHALL fail rather than divide by it
