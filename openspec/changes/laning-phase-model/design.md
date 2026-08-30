# laning-phase-model — design

## Context

`src/model.ts:207-222` weights every enemy through `C.laneWeights[r][rp]`, a
hand-set 5×5 of 1.0, 1.5 and 1.75. What it weights is `adv(bundle, h, enemy)`
— a match statistic. The model therefore has a lane concept with no lane
data behind it.

`heroStats.laneOutcome` publishes the missing half.
`docs/research/stratz-graphql-2026-08-29.md` §2 establishes that it pairs by
shared lane rather than by team: a carry's opponents are 71.6% the offlane
duo and 3.4% other carries, where team membership would put a mid at a
quarter of the list and it is 2.7%.

`/snapshot.json` gains one root:

```text
lanes: Record<heroId, Record<position, Record<heroId, number>>>
```

The snapshot row — the database's, not the bundle's — gains three columns
beside those it already carries for a build's own parameters: the pooled `k`,
and the smallest and largest of the same decomposition run per cell. A range
rather than a variance, because what it answers is "did the cells disagree
more than the 11-to-37 three real ones did", and that is a comparison of
bounds. None of the three reaches the client.

## Goals / Non-Goals

**Goals:** the lane-opponent statistic pulled, stored antisymmetrically and
centred, exported as a third matrix, and summed as a seventh component.

**Non-Goals:** as the proposal fixes them — no allies, no `laneWeights` fit,
no win estimate, no weight fit.

## Decisions

### One request per cell, and only the cells anybody plays

`positionIds` filters the hero's own position, and passing several does not
aggregate: a request naming all five answers with the hero's dominant
position alone — measured, 125 rows all `POSITION_1`. So a cell is a request
and the pull multiplies where the pair pull does not.

```text
share ≥  2%   374 cells    share ≥ 10%   266 cells
share ≥  5%   300 cells    share ≥ 20%   197 cells
```

5% is the floor because below it the rows are noise rather than thin
evidence: Phantom Lancer at position 3 — a 0.4% cell — answers 55 rows
totalling 124 games, two a pair.

A row carries `heroId1`, `heroId2`, `position`, five verdict counts summing
to `matchCount`, and `matchWinCount` counted over the same games. The build
folds the verdicts and ignores the last; *The lane statistic is centred and
its constant is derived* fixes both, because how a lane win is counted is a
decision an implementer would otherwise have to invent.

### Twelve weeks, bounded by the major patch

The pair pull caps at four weeks for a stated reason: the endpoint's only
time dimension is a week, so a longer window is linear in requests. The same
arithmetic applies here and the answer differs, because the quantity differs.

```text
Nyx Assassin at 3, weeks 7–12 against weeks 1–6
  69 pairs with 60 games in each half
  corr  +0.801        mean |difference|  3.4 pp
```

A lane delta does not drift over twelve weeks, and that window contains the
7.41e release — so it does not drift across a letter patch either. Which is
why the window is bounded by the **major** patch rather than the current one,
the opposite of what the pair pull does. Nothing here measures a major patch,
and the proposal's Open Questions says so.

Depth is what the weeks buy, and it accrues slowly:

```text
weeks    1     2     4     6     8    10    12
n/pair  23    46    85   121   160   201   244
```

### The centring is by the row mean, because there is no mirror to keep

A lane pair's two directions come from two independent pulls — `a` at its
position listing `b`, and `b` at its own listing `a` — over game sets that
overlap without coinciding. They are not one value stored once. Measured over
four pairs at 5 000 games or more a side:

```text
opponent            lane(a,b)   lane(b,a)     sum
Pudge at 4              −3.49       +2.77   −0.72
Rubick at 4             −2.38       +3.25   +0.87
Dawnbreaker at 3        −3.18       +4.24   +1.06
Axe at 3                −6.16       +7.66   +1.50
```

So the antisymmetric form `− r(a,p) + r(b,q)` that `score-calibration` uses
for `matchups` is not wanted here: it exists to preserve an invariant, and
there is none. This change first specified it anyway, and the criterion it
carried would have failed every build — an assertion at 1e-6 over quantities
that disagree by about a point.

Plain row centring is what the statistic needs and all it needs. The model
reads a candidate's own row and never the mirror, so nothing downstream wants
the two directions tied together either.

### `k` is derived, from before the smoothing it feeds

`k = p(1−p)·10⁴ / var_true` is the shrinkage that is optimal rather than
cautious. Two things about the input that the first draft got wrong:

- **`var_true` comes from the centred but *unsmoothed* deltas.** Taking it
  from the stored ones defines `k` in terms of what `k` produced, so a run's
  estimate would depend on the previous run's constant.
- **It is pooled over every cell**, not averaged over per-cell figures. Each
  cell is already centred on 0, so pooling is one decomposition over one
  population; a mean would weigh a three-opponent cell like a sixty-opponent
  one. The requirement carries the three sums exactly, because "pooled" left
  a denominator to guess at.

Measured per cell over twelve weeks, to record the spread rather than to set
the constant:

```text
cell                     pairs   n/pair   sd obs   noise   sd true    k
Nyx Assassin at 3           94      323      7.5     3.3       6.7   37
Pudge at 2                 106      678     12.9     3.7      12.4   11
Juggernaut at 1            125     5264      8.7     1.8       8.5   24
```

Tens rather than the 400 a pair statistic uses, because a lane delta carries
more real signal per game — the 32.6 pp spread arriving as a constant.
Spearman–Brown on the split-half correlation corroborates: `2(0.801)/1.801 =
0.889` against the 0.87 the decomposition gives at the same depth — an
agreement the wrong noise model was hiding, since it put that figure at
0.80.

### The row mean is recomputed every run

`r(a, p)` is taken over whatever opponents the window currently holds, on
every build, rather than held from the run that first covered the cell. It is
not a choice so much as the shape of everything around it: the build reads
staging and derives, and nothing in it persists a derived quantity across
runs. Holding one would make a stored delta depend on when a cell was first
seen, which is the reproducibility `k`'s own derivation is written to avoid.

### The component is not weighted through `laneWeights`

`matchups` is, and must be: it is a match statistic that has to be told which
enemies share my lane. This statistic was counted from who actually stood
there, so weighting it by a guess at the same thing applies the correction
twice — once measured, once approximated.

It is summed beside `matchups` rather than folded into it because the two
answer different questions: over Phantom Lancer's 35 most frequent lane
opponents at position 1, `corr(lane pp, match pp) = +0.066`.

### The contract checker gains a depth

`src/job/export/contract.ts:122-131` walks exactly two levels: a root's
values must be objects, and theirs must be numbers. `lanes[44]["1"]` holds
`{"6": -3.2}` — an object where the walk wants a number — so it is refused.

The alternative was a composite key, `lanes["44:1"]`, which passes the
existing rule. It is refused deliberately: such a key reads as an id to a
scan that never learned otherwise, and `contract.ts:118-121` names that exact
failure as the reason its exemption list is written as a list of what is
*not* a matrix.

## Risks / Trade-offs

- **The run grows from about half an hour to three.** 3 600 requests join
  ~516. → Not a refusal: *A run stays inside the quota the API states* has a
  run wait for a refilling window and continue, failing only on the longest,
  and the daily ceiling is 15 000. *An invocation arriving while a run is in
  flight* already refuses an overlap. What it does cost is the bundle
  arriving later, on a job nothing else waits for.
- **The headline spread was measured on the busiest cell.** 32.6 pp came from
  Phantom Lancer at position 1 over pairs with 200 games or more. → The
  median cell is thinner and the derived `k` is what carries it; what the
  proposal claims is that the signal exists and is orthogonal, not that it is
  32 pp everywhere.
- **`k` varies 11 to 37 across three cells.** → One constant is what the
  build's shape allows, and the pooled derivation is the defensible way to
  pick it. The per-cell spread is recorded so that a run whose cells disagree
  more than these did is visible rather than averaged away.
- **`src/model.ts` is at exactly its 300-line cap.** → The step that adds the
  component splits it first, to the cap that will apply rather than the one
  that does — and `beta-refit`'s step 1 edits the same file, so whichever
  lands second inherits a split file rather than doing it twice.
- **Stryker's floor is scoped to `src/model.ts`.** → A split makes that
  scope a question `openspec/specs/mutation-floor/` answers by requiring a
  second configuration rather than a widened glob, which `PLAN.md` already
  carries as an open entry. This change does not settle it; it does have to
  leave the floor met on whatever `src/model.ts` becomes.

## Open Questions

- Whether the 5% floor should one day be a sample count rather than a share.
  The share is **decided** and the requirement fixes it: it is what the
  reference already stores, so it costs no extra pull. A count would track
  what the pull returns rather than what the reference predicts, which is
  closer to what the depth problem is about — but nothing measured says the
  two disagree on which cells they admit, and until something does, changing
  it would trade a free reading for a paid one.
