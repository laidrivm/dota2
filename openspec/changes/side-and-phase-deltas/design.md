# side-and-phase-deltas — design

## Context

`staging_hero_sides` and `staging_hero_phases` were built for components no
source could fill. `snapshot-build` blends and smooths them, `build.ts`
carries `side_measured` and `phase_measured` so a later blend can tell an
unmeasured component from a neutral one, and `src/model.ts` weighs both — and
every one of those paths has only ever seen zero.

No endpoint changes shape. `/snapshot.json` keeps
`side: Record<Side, number>` and `phase: Record<PickPhase, number>` on every
hero, both finite, both in percentage points. Two fields stop being 0.

## Goals / Non-Goals

**Goals:** both components measured from the harvested matches, against a
base that does not restate `meta`.

**Non-Goals:** as the proposal fixes them — no pull, no change to what the
other components are measured against, no weight fit, no backfill.

## Decisions

### The base is per component, not per snapshot

`adj = (wr_blend − base) · n_eff / (n_eff + k)`, and the argument for `base`
is the same one `score-calibration` makes about the pair matrices: a delta
should carry what nothing else already carries.

```text
meta                50    the hero's strength, and 50 is what strength is from
matchup, synergy    50    plus centring, which score-calibration adds
side, phase         the hero's own overall winrate over the same matches
```

`meta` is the hero's strength and belongs against 50. Side and phase answer a
different question — how much the side, or the phase it was picked in, moves
that hero's own result — and taking them from 50 makes them restate the
answer `meta` already gave:

```text
hero at 55% overall, 56% on Radiant, 55% at its role
  base 50    meta +5.0   side +6.0   →  +11.0
  base 55    meta +5.0   side +1.0   →   +6.0
```

The overall winrate is taken over the same matches the side rows were counted
from. The harvest is leaderboard-sourced and the meta pull is Divine and
Immortal, two populations; a within-hero difference taken inside one of them
cancels the difference rather than carrying it.

### The deltas are centred across heroes, or the side counts ten times

The base change alone is not enough, and the shortfall is the same shape as
the one `score-calibration` removes from the pair matrices: a quantity common
to everybody sitting inside each entity separately.

A hero's side delta against its own overall winrate contains the whole
match-level advantage of that side, because that advantage is *why* the hero
wins more than its own average there. Measured over 800 Divine and Immortal
matches, 32 heroes with at least 40 games a side:

```text
mean hero's Radiant delta          +3.72 pp
mean hero's Dire delta             −3.61 pp
the side's own advantage            +4.00 pp   (Radiant 54.00%)
```

The three are one fact. *Win probability at full draft* sums `sideDelta` over
five allies and subtracts it over five enemies, so it counts that fact ten
times:

```text
5 · (+3.72) − 5 · (−3.61) = +36.66 pp     σ(0.1 · 36.66) = 97.5%
```

The model would answer 97.5% for every Radiant draft where the truth is 54.0.
Subtracting the mean over heroes leaves each delta saying what that hero
prefers, the mean is 0, and ten of them sum to nothing for an average team.

### Both are centred, though only one changes an output today

`sideDelta` is read twice — once per candidate in a suggestion block
(`model.ts:224`) and five plus five in the win estimate (`273`, `278`).
`phaseDelta` is read once, in suggestions only (`225`), and
`const phase = pickPhase(...)` at line 174 gives every candidate in a call
the same phase. So a constant common to all heroes shifts every candidate
equally and reorders nothing: **centring phase changes no output.**

It is centred anyway. The two fields share one doc comment in
`src/types.ts:71`–`73` and one requirement here; two fields of one contract
under two definitions is what bites the first time somebody adds `phase` to
the win estimate and finds the trap reopened. The cost is the same pass.

### Phase is derived the way the model derives it

`src/model.ts:pickPhase` reads the phase off a count: one pick or fewer is
`p1`, two or three `p2`, otherwise `last`. The harvest stores `pick_order`
and `is_radiant` on every pick, so the count of a side's earlier picks gives
the same answer by the same rule.

Deriving it any other way — from Dota's actual draft phases, say — would
produce a `phase` the model reads under a different definition than the one
it computes for a live draft, and the two would disagree about the same
hero in the same match.

### The staging write reads the harvest, one night behind

`match-harvest` runs the harvest after the export, so that a failure there
can never delay or unpublish the bundle. The staging write runs during the
ingest, before the build. A night's staging therefore reads the store as
last night's harvest left it.

That is the right trade and the lag is immaterial: the store holds up to
50 000 matches and one night adds a low thousands, so the aggregate moves by
a fraction of a percent. Moving the harvest earlier to close the lag would
put the bundle behind a step that cannot endanger it today.

### A hero missing one part fails the build, and that is reachable

`An unmeasured component is zero for every hero` sends a component measured
for some heroes and not others to `status = 'failed'`, for a stated reason: a
partial zero reorders the heroes it zeroed against the ones it did not.

Filling these two components makes that case reachable for the first time.
A hero with picks on only one side, or never among a side's first two picks,
has no row where every other hero has one — and phase is the likelier of the
two, since some heroes are never first-picked.

The write is therefore all-or-nothing per component, and the two cases are
distinguished by whether the harvest holds any match for the patch at all:

```text
harvest has no match for the patch   write no row          component unmeasured
harvest has any match                write a row for every component stays
                                     hero of the reference measured for all
                                     and every part, zero
                                     matches where none
```

The requirement decides measured-ness on whether staging holds a **row**, not
on what the row leads to, so a zero-match row keeps the hero inside a
measured component and blends to 0 for it. Emitting rows only where matches
exist would fail the build on a rare hero on a night nobody changed
anything; emitting them when the harvest is empty would set `side_measured`
on a component nothing observed, which is the confusion that column exists to
prevent.

## Risks / Trade-offs

- **The two components come from a different population than `meta`.** The
  harvest is leaderboard-sourced Immortal; the meta pull is Divine and
  Immortal. → Taking the delta against the hero's own overall winrate inside
  the harvest is what cancels it. The residual is that a hero's side
  preference is measured at a slightly higher bracket than its meta, which is
  a smaller error than measuring it against 50.
- **Nothing says these components carry signal.** They have never been
  non-zero, so whether a side or phase delta predicts anything is unknown. →
  `outcome-calibration` scores two bundles over one set of matches, which is
  what answers it. Until then this change makes them measurable rather than
  useful.
- **A hero the harvest has never seen at all.** → It gets zero-match rows
  like any other, so the component stays measured for every hero and the
  hero's delta is 0. The rows are written per hero of the reference, never
  per hero the harvest saw, which is what makes that true.
- **`phase` at `p1` has few matches per hero.** A hero rarely first-picked
  has a thin sample at that phase. → `k = 500` already smooths a thin sample
  towards the base, and the base is now the hero's own rate, so a thin phase
  reads as "no different from this hero's usual" rather than as "average".
- **The centring is measured on 800 matches and 32 heroes.** A thin sample
  for a per-hero figure. → What it fixes does not rest on the sample: ten
  applications of one match-level fact is structural, and the sample only
  says how large the fact is. The pass subtracts whatever the mean turns out
  to be on the real store.
- **Both this and `score-calibration` move the score scale.** Applied
  together with nothing measuring either, the result is two unattributable
  changes. → The proposal's *Ordering* puts both after
  `outcome-calibration`.

## Open Questions

- Whether `phase` should use the harvest's real pick order or the model's
  count-derived phase where the two disagree. They cannot disagree as
  specified — the derivation is the model's own rule — but a draft where a
  player picks out of turn would show whether the rule and the reality ever
  part.
