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

- **WHEN** a hero wins more than average with every ally, so every cell of
  its raw synergy row carries the same surplus
- **THEN** its centred row SHALL carry that surplus in no cell, the mean of
  the centred row being zero up to the grand mean

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
- **THEN** the bundle SHALL carry `synergies[a][b] = 1.4` and
  `synergies[b][a] = 1.4`

#### Scenario: A matchup's mirror

- **WHEN** the bundle carries `matchups[a][b] = -2.1`
- **THEN** it SHALL carry `matchups[b][a] = 2.1`
