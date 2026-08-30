# score-calibration — design

## Context

`src/job/export/render.ts:116-127` assembles `matchups` and `synergies` from
`hero_matchups` and `hero_synergies` rows. Each stored value is a pair's
blended winrate less `NEUTRAL = 50` (`blend.ts:120`), which is why a hero's
own strength sits in every cell of its row.

`/snapshot.json` is an endpoint this project serves, so its shape is fixed
here. It does not change:

```text
matchups:  Record<heroId, Record<heroId, number>>   full, both orders
synergies: Record<heroId, Record<heroId, number>>   full, both orders
```

Both stay full matrices keyed by hero id as a string, every hero that has a
pair carrying a row and every pair carrying both orders, each cell a finite
number in percentage points. No key is added, removed or renamed, and no
type moves. What changes is what the number in a cell means: the interaction
between two heroes rather than that interaction plus both heroes'
strength.

## Goals / Non-Goals

**Goals:** a matrix cell that holds the interaction between two heroes, with
each matrix's invariant intact.

**Non-Goals:** as the proposal fixes them — no averaging over allies, no
weight refit, no `beta`, no rewrite of stored values.

## Decisions

### Centring goes in the export, not the build or the model

The build writes pairs one row at a time and never holds the whole matrix; a
row mean needs all of it. The model would have to recompute 127 row means on
every keystroke to get the same answer. The export already materialises both
matrices whole, once per snapshot, which is the one place the operation is
free.

It also leaves `hero_matchups` and `hero_synergies` holding what was
measured. Changing the centring later is then an export, not a re-ingest of
508 requests.

### Each matrix is centred by its own formula

Naive row-centring is wrong for `matchups` and the failure is not subtle.
Measured over the live bundle:

```text
                                     max |adv[a][b] + adv[b][a]|
raw                                        0.00e+00
subtract row mean                          8.156          ← antisymmetry gone
subtract row a, add row b                  8.88e-16
```

`draft-model`'s *Win probability at full draft* rests on antisymmetry, so a
form that breaks it by 8 pp is not a candidate however tidy it looks.

```text
matchups   antisymmetric   adv'[a][b] = adv[a][b] − r_a + r_b
synergies  symmetric       syn'[a][b] = syn[a][b] − r_a − r_b + g
```

Both follow from the same reading: a stored value is roughly one hero's
strength, plus or minus the other's, plus the interaction. Removing the
strengths in the way each matrix's symmetry allows leaves the interaction.

Neither is exact, and how inexact depends on size. Centring cancels perfectly
only where every row holds the same keys; these are hollow — no hero pairs
with itself — so a row's mean is taken over one fewer hero than the grand
mean. The residual is of order `1/n`: at three heroes the centred row means
run −0.42 to +0.33 on values of order 1, and at the live bundle's 127 they
run −0.040 to +0.038 against a raw spread of −5.13 to +4.74. The criterion's
0.1 pp bound is a bound at production size and would be wrong at three.

### What it does to the reported defect

The draft that produced the report — Clockwerk at 4, Lich at 5, Treant and
Bane opposite, offlane open:

```text
before                                    after
Enigma          25.30  meta  7.63         Enigma         8.90  meta  7.63
Visage          22.93  meta  5.87         Meepo          8.88  meta  0.72
Meepo           21.26  meta  0.72         Visage         6.78  meta  5.87
Phantom Lancer  12.19  meta -0.70         Winter Wyvern  6.29  meta  6.38
Bounty Hunter   11.86  meta -3.95         Brewmaster     4.34  meta  2.84
```

Both heroes with a negative meta for the role leave the block, and every
hero in the new top five is one the model rates above average there. The
scale collapses from 25.30 to 8.90, which is the doubled strength coming
out.

This is not proof the new order is better — nothing here scores a
suggestion. It is evidence that the specific defect reported is the one being
removed.

### Why averaging over allies is not part of this

The plan carried a second fix: divide the synergy sum by the ally count so a
score means the same thing at every stage. Measuring it against the centring
removed it.

```text
allies          score / synergy      score / synergy
                   uncentred             centred
  0              13.44 /  0.00         7.17 /  0.00
  1              20.18 /  6.74         8.24 /  1.20
  2              24.08 / 10.65         9.37 /  2.34
  3              29.27 / 15.83        10.23 /  3.19
  4              35.95 / 22.52        11.22 /  4.18
```

Centring takes the growth from 22.52 pp to 4.18 — 81% of it was the strength
offset arriving once per ally. What is left is interaction genuinely
accumulating, and averaging would divide it away. It would also change no
ranking: every candidate in a block has the same allies, so a sum and a mean
differ by a constant factor.

## Risks / Trade-offs

- **The win estimate moves a long way and nothing says which way is right.**
  On one full draft, Δ goes from −14.79 pp to +6.21 and the estimate from
  18.6% to 65.0%. → The proposal's *Ordering* section refuses to apply this
  before `outcome-calibration`, which is what makes the question answerable
  rather than a matter of taste.
- **`counterRisk` reads `max(0, adv(c, h))`.** Centring shifts which pairs
  are positive, so the term changes without being edited. → Its own change,
  `ban-sharpening`, already measured it as contributing 0.05 pp on a 25 pp
  score; this makes it neither better nor worse in a way anything can
  currently see.
- **The fixture is regenerated, and the model's suite reads it.** Cases
  written against the old numbers may move. → They are read and re-fitted in
  the step that regenerates, rather than the regeneration being a separate
  surprise.
- **A hero with no pairs at all.** A row that is empty has no mean. → Only
  reachable if the build wrote no pair for a hero; the export already
  assembles a full matrix from what the build guaranteed, so the case is
  refused rather than divided by zero.

## Open Questions

- Whether the weights should be refitted in the same change once the scales
  move. They should not: fitting needs the figure `outcome-calibration`
  produces, and doing both at once means neither can be attributed.
