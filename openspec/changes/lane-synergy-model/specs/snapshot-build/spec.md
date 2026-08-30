# snapshot-build delta — lane-synergy-model

**Written against the version `laning-phase-model` leaves behind.** That
change creates the requirement below.

`Stored pair statistics carry their symmetry` is **not** modified, for the
reason that change records and this half confirms: a lane pair's two
directions are independent pulls, not one value mirrored. Measured over three
ally pairs at 4 800 games or more a side, the two readings differ by 0.35,
0.05 and 0.22 pp — closer than the opponent half's 0.72 to 1.50, because two
allies see the same event where two opponents see complementary ones, but not
an invariant either.

## MODIFIED Requirements

### Requirement: The lane statistic is centred and its constant is derived

Both lane statistics — the opponent one and the ally one — are stored under
these rules, each with its own constant.

A row answers with five mutually exclusive verdicts and a sixth figure that
is not one of them: `winCount`, `lossCount`, `drawCount`, `stompWinCount`,
`stompLossCount` — summing to `matchCount` — beside `matchWinCount`, which
counts the *match* over the same games.

The build SHALL fold them as
`(winCount + stompWinCount + 0.5·drawCount) / matchCount`, and SHALL read
`matchWinCount` not at all. A stomp is a win of the lane and belongs with the
wins; a draw is half of one; and `matchWinCount` is the quantity `matchups`
and `synergies` already carry, so taking it here would restate a component
under a new name.

**Each statistic is centred where it is stored, not later.** Writing
`r(a, p)` for the mean of hero `a`'s deltas at position `p` over the other
heroes in that statistic, the build SHALL store
`adj(a, p, b) = raw(a, p, b) − r(a, p)`.

The row mean alone, and not the antisymmetric form `score-calibration` uses
for `matchups`: that form preserves an invariant, and a lane pair has none to
preserve. Each row is centred against its own hero's laning strength, which
is the whole of what centring is for here — and it is what a lane statistic
carries most heavily, because how well a hero lanes is a property of the
hero.

**Each constant is derived rather than chosen**, over that statistic's own
rows and never the other's. Over the pooled rows of every covered cell,
writing `d_i` for a row's centred delta and `n_i` for its `matchCount`:

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
two, so the Bernoulli variance is the wrong one and wrong by a wide margin:
draws are 28.9% of ally lane games, and assuming Bernoulli would read this
statistic's constant as 44 where it is 29.

The two constants SHALL be derived and recorded separately. On the data
measured they are close — 29 for allies against 11 to 37 for opponents — and
that is a fact about this patch rather than a licence to share one.

#### Scenario: The two directions of a lane pair are independent

- **WHEN** either statistic holds `(a, p, b)` and `(b, q, a)`, each written
  from its own hero's pull
- **THEN** the build SHALL store both and SHALL NOT derive either from the
  other, nor assert that they are equal or that they sum to 0 — measured, an
  ally pair's readings differ by up to 0.35 pp and an opponent pair's sum to
  as much as 1.50

#### Scenario: A stomp is a win and a draw is half of one

- **WHEN** a row carries 10 wins, 4 stomp wins, 2 draws, 20 losses and 4
  stomp losses over 40 games
- **THEN** its folded winrate SHALL be `(10 + 4 + 1) / 40 = 0.375`, and
  `matchWinCount` SHALL not enter it

#### Scenario: The mean other hero gives no lane advantage

- **WHEN** either statistic's stored deltas are read for one hero at one
  position
- **THEN** their mean over that hero's opponents, or over its allies, SHALL
  be 0

#### Scenario: A hero with one row in a statistic

- **WHEN** a hero at a position has exactly one opponent, or exactly one
  ally, in that statistic
- **THEN** centring SHALL store it as 0, the mean being its own value

#### Scenario: A constant is derived per statistic

- **WHEN** a build derives the constants
- **THEN** it SHALL derive one over the opponent rows and one over the ally
  rows, from each statistic's own centred unsmoothed deltas, and SHALL record
  both with their per-cell ranges

#### Scenario: One statistic's rows do not move the other's constant

- **WHEN** a build runs over a store whose ally rows have doubled and whose
  opponent rows are unchanged
- **THEN** the opponent constant SHALL be what the previous run derived, to
  the precision the unchanged rows allow

#### Scenario: A derived constant far from what was measured

- **IF** either derived constant falls outside `[5, 400]`
- **THEN** the build SHALL fail rather than publish

#### Scenario: A spread that is entirely noise

- **IF** the observed variance of either statistic's deltas does not exceed
  the sampling variance at its rows' own sample sizes
- **THEN** `var_true` is not positive, no constant follows from it, and the
  build SHALL fail rather than divide by it
