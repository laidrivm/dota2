# snapshot-build delta — laning-phase-model

`Stored pair statistics carry their symmetry` is **not** modified. A lane
matchup was going to join it as a third antisymmetric statistic, and the data
refuses: the two directions of a lane pair come from two independent pulls —
`a` at its position listing `b`, and `b` at its own listing `a` — over game
sets that overlap without coinciding. Measured over four pairs at 5 000 games
or more a side, they sum to −0.72, +0.87, +1.06 and +1.50 pp rather than to
0. An invariant asserted at 1e-6 on that is one no build could meet, and the
model reads only a candidate's own row, so nothing needs the mirror either.

## ADDED Requirements

### Requirement: The lane statistic is centred and its constant is derived

A row answers with five mutually exclusive verdicts and a sixth figure that
is not one of them: `winCount`, `lossCount`, `drawCount`, `stompWinCount`,
`stompLossCount` — summing to `matchCount`, verified over all 104 rows of one
pull — beside `matchWinCount`, which counts the *match* over the same games
and is what makes the endpoint worth reading.

The build SHALL fold them as
`(winCount + stompWinCount + 0.5·drawCount) / matchCount`, and SHALL read
`matchWinCount` not at all. A stomp is a win of the lane and belongs with the
wins; a draw is half of one; and `matchWinCount` is the quantity `matchups`
already carries, so taking it here would restate that component under a new
name. This is the definition every figure in this change was measured under.

Two things this statistic does that the two before it do not, and both are
because it is thinner and carries more signal per game.

**It is centred where it is stored, not later.** Writing `r(a, p)` for the
mean of hero `a`'s lane deltas at position `p` over its opponents, the build
SHALL store `lane_adj(a, p, b) = raw(a, p, b) − r(a, p)`.

The row mean alone, and not the antisymmetric `− r(a,p) + r(b,q)` that
`score-calibration` uses for `matchups`. That form exists to preserve an
antisymmetry, and a lane pair has none to preserve: its two directions are
two independent measurements, not one value mirrored. Each row is centred
against its own hero's laning strength, which is the whole of what centring
is for here.

Why it is centred at all: a stored `winrate − 50` carries the hero's own
strength into every cell of its row, and `meta` carries that strength already
— the defect `score-calibration` exists to repair in the two matrices that
were not centred. A lane delta carries it more heavily, because how well a
hero stands a lane is a property of the hero: Phantom Lancer at position 1 is
negative against all nine of its most frequent opponents, −4 to −15 pp.

**Its smoothing constant is derived rather than chosen.** *Smoothing towards
neutral by sample size* fixes `k` per statistic — 300, 400, 500 — and for
this one the build SHALL compute `k = p(1−p)·10⁴ / var_true`, where `p` is
the folded lane winrate above as a fraction. Over the pooled rows of every
covered cell, writing `d_i` for a row's centred delta and `n_i` for its
`matchCount`:

```text
p_i       = (win + stompWin + 0.5·draw) / n_i        the folded rate
E[X²]_i   = (win + stompWin + 0.25·draw) / n_i       X ∈ {1, 0.5, 0}
v_i       = (E[X²]_i − p_i²) · 10⁴                   one game's variance, pp²

var_obs   = Σ(d_i − d̄)² / (N − 1)     over the N pooled rows, d_i centred
var_noise = Σ (v_i / n_i) / N          the mean of each row's own
var_true  = var_obs − var_noise
k         = (Σ v_i / N) / var_true
```

`v_i` is **not** `p_i(1 − p_i)·10⁴`. A folded verdict takes three values, not
two — a draw is half a win — so the Bernoulli variance is the wrong one, and
wrong by a wide margin: draws are about a quarter of lane games (24.4%, 26.2%
and 25.7% over the three cells measured), and assuming Bernoulli overstates
the noise by 40%.

It is per row and not global because a pair at 0.2 and one at 0.5 do not
carry the same noise; the pooling is what turns those into one constant.

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

Derived on three cells over twelve weeks it came out 37 at the median cell,
11 at the busiest and 24 at a third — tens rather than hundreds, because a
lane delta carries more real signal than a match one. Three cells do not fix
a constant, so the build SHALL record beside the pooled value the spread of
the same decomposition run per cell — which is what said 11 to 37 — never the
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

#### Scenario: The two directions of a lane pair are independent

- **WHEN** `hero_lanes` holds `(a, p, b)` and `(b, q, a)`, each written from
  its own hero's pull
- **THEN** the build SHALL store both and SHALL NOT derive either from the
  other, nor assert that they sum to 0 — measured over four pairs at 5 000
  games or more a side, the raw deltas sum to −0.72, +0.87, +1.06 and
  +1.50 pp

#### Scenario: A derived constant far from what was measured

- **IF** the derived `k` falls outside `[5, 400]`
- **THEN** the build SHALL fail rather than publish — three cells measured 11
  to 37, and a figure an order of magnitude outside that says the
  decomposition read noise as signal or the reverse

#### Scenario: A stomp is a win and a draw is half of one

- **WHEN** a row carries 10 wins, 4 stomp wins, 2 draws, 20 losses and 4
  stomp losses over 40 games
- **THEN** its folded winrate SHALL be `(10 + 4 + 1) / 40 = 0.375`, and
  `matchWinCount` SHALL not enter it

#### Scenario: A spread that is entirely noise

- **IF** the observed variance of the lane deltas does not exceed the
  binomial variance at their sample sizes
- **THEN** `var_true` is not positive, no `k` follows from it, and the build
  SHALL fail rather than divide by it
