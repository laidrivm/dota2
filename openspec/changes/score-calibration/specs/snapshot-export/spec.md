# snapshot-export delta — score-calibration

## MODIFIED Requirements

### Requirement: Pair statistics are expanded into full matrices

The export SHALL emit `matchups` and `synergies` as full matrices keyed by
hero id, deriving the orders the database does not store from the symmetry
the build guaranteed, and SHALL centre both so that a cell holds the
interaction between two heroes and not that interaction plus either hero's
own strength.

A stored value is a pair's winrate less `NEUTRAL`, so a hero who wins more
than average with everyone carries that surplus into every cell of its row —
which `meta` already carries once. Centring subtracts it. Measured on the
live bundle, a hero's mean synergy correlates with its own weighted meta at
0.968, so 93.6% of a row's variance is the hero rather than the pair.

The two matrices SHALL be centred differently, because each has an invariant
the other does not and one operation cannot preserve both:

- `matchups` is antisymmetric. It SHALL be centred as
  `adv'[a][b] = adv[a][b] − mean(row a) + mean(row b)`, which subtracts `a`'s
  strength and restores `b`'s, leaving `adv'[b][a] = −adv'[a][b]`.
- `synergies` is symmetric. It SHALL be centred as
  `syn'[a][b] = syn[a][b] − mean(row a) − mean(row b) + mean(every cell)`,
  which subtracts both heroes' strength and leaves `syn'[a][b] = syn'[b][a]`.

Subtracting the row mean alone from `matchups` SHALL NOT be done: it breaks
antisymmetry by up to 8.16 pp on the live bundle, and *Win probability at
full draft* rests on that invariant.

Centring SHALL happen where the matrix is assembled and SHALL NOT change what
the database holds, so that reverting it costs an export rather than an
ingest.

#### Scenario: A hero's strength leaves its row

- **WHEN** the centred synergy matrix is read
- **THEN** every row's mean SHALL lie within 0.1 pp of zero, against a raw
  spread of −5.13 to +4.74 on the live bundle

The bound is not zero and the difference is not rounding. Centring subtracts
`mean(row a) + mean(row b)` and adds the grand mean, which cancels exactly
only where every row holds the same set of keys. These do not — a hero has no
cell with itself, and a pair the build never wrote is absent — so the
residual is the gap between the mean of a row's own partners and the mean of
all heroes. Measured, it is at most 0.04 pp; the bound is 0.1 to leave the
key sets room to change without the criterion moving.

#### Scenario: Antisymmetry survives centring

- **WHEN** the centred `matchups` are read for any pair
- **THEN** `matchups[b][a]` SHALL be `−matchups[a][b]`, as it was before
  centring

#### Scenario: Symmetry survives centring

- **WHEN** the centred `synergies` are read for any pair
- **THEN** `synergies[a][b]` SHALL equal `synergies[b][a]`

#### Scenario: The database is not rewritten

- **WHEN** a snapshot is exported twice
- **THEN** `hero_matchups` and `hero_synergies` SHALL hold the values the
  build wrote, uncentred, both times

#### Scenario: A synergy stored once

- **WHEN** `hero_synergies` holds one row `(a, b)` with `synergy_adj = 1.4`
- **THEN** the bundle SHALL carry a cell at `synergies[a][b]` and one at
  `synergies[b][a]`, holding the same value as each other

The value is no longer 1.4 and this scenario no longer asserts one. With a
single stored pair both row means and the grand mean are 1.4, so the centred
cell is exactly 0 — the whole of that pair's value was the two heroes'
strength, there being nothing else in the matrix to measure it against. What
survives is what the scenario was always for: a pair stored once appears
under both orders.

#### Scenario: Three heroes, centred by hand

- **WHEN** the only stored synergies are `(a, b) = 1`, `(a, c) = 2` and
  `(b, c) = 4`
- **THEN** the bundle SHALL carry `synergies[a][b] = −2/3`,
  `synergies[a][c] = −1/6` and `synergies[b][c] = 5/6`, each within 1e-9

#### Scenario: A matchup's mirror

- **WHEN** the bundle carries `matchups[a][b] = -2.1`
- **THEN** it SHALL carry `matchups[b][a] = 2.1`
