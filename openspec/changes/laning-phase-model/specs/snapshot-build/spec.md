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

**It is centred where it is stored, not later**, and by the antisymmetric
form. Writing `r(a, p)` for the mean of hero `a`'s lane deltas at position
`p` over its opponents, the build SHALL store

```text
lane_adj(a, p, b)  =  raw(a, p, b) − r(a, p) + r(b, q)
```

where `q` is the position hero `b` was counted at in that lane. Subtracting
the row mean alone would break the antisymmetry the requirement above fixes:
the two directions would then sum to `−(r(a,p) + r(b,q))` rather than to 0.
Measured on a six-hero antisymmetric block, the residual is 8.88 by that form
and 4.4e-16 by this one — which is the same arithmetic `score-calibration`
settles for `matchups`, and the same trap `side-and-phase-deltas` fell into
and had to amend.

WHERE hero `b` has no covered cell at all, `r(b, q)` SHALL be 0 rather than
omitted. Antisymmetry survives it: both directions then read the same pair of
means, so the sum is still 0, and the pair is centred on one side only —
which is stated here rather than discovered from a mirror that will not
publish.

Why it is centred at all: a stored `winrate − 50` carries the hero's own
strength into every cell of its row, and `meta` carries that strength already
— the defect `score-calibration` exists to repair in the two matrices that
were not centred. A lane delta carries it more heavily, because how well a
hero stands a lane is a property of the hero: Phantom Lancer at position 1 is
negative against all nine of its most frequent opponents, −4 to −15 pp.

**Its smoothing constant is derived rather than chosen.** *Smoothing towards
neutral by sample size* fixes `k` per statistic — 300, 400, 500 — and for
this one the build SHALL compute `k = p(1−p)·10⁴ / var_true`.

`var_true` SHALL be taken over the **centred but unsmoothed** deltas — the
`lane_adj` above, before the smoothing that `k` is for — less the binomial
sampling variance at their own sample sizes. Taking it over the smoothed
values would define `k` in terms of a quantity `k` produced, and the estimate
would depend on whatever `k` a previous run happened to use.

It SHALL be one value for the whole statistic, computed from every covered
cell's deltas pooled rather than by averaging the per-cell figures: each
cell's deltas are already centred on 0, so pooling them is a decomposition
over one population, where a mean of per-cell `k`s would weight a cell of
three opponents like one of sixty.

That is the shrinkage that is optimal rather than cautious, and it is what
makes a thin statistic usable: a lane pair reaches 244 games at the median
cell over twelve weeks, which `k = 400` would shrink to 38% of its size.

Derived on three cells over twelve weeks it came out 61 at the median cell,
17 at the busiest and 35 at a third — tens rather than hundreds, because a
lane delta carries more real signal than a match one. Three cells do not fix
a constant, so the build SHALL record beside the pooled value the spread of
the same decomposition run per cell — which is what said 17 to 61 — never the
mean of those, which nothing uses.

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
- **THEN** it SHALL compute it from that run's own centred unsmoothed deltas
  and their sample sizes, pooled over every covered cell, and SHALL record
  that value and the per-cell spread on the snapshot

#### Scenario: The constant does not depend on the last run's

- **WHEN** two builds run over identical staging rows, one starting from a
  snapshot whose recorded `k` was 17 and the other from one recording 61
- **THEN** both SHALL derive the same `k`, the variance being taken before
  smoothing

#### Scenario: Centring keeps the mirror

- **WHEN** a lane pair is centred and both heroes' cells were covered
- **THEN** `lane_adj(a, p, b)` and `lane_adj(b, q, a)` SHALL still sum to 0
  within 1e-6 — subtracting the row mean alone leaves 8.88 on a six-hero
  block where this form leaves 4.4e-16

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
