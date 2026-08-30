# candidacy-gate — design

## Context

`src/model.ts:249` filters candidates with
`h.sufficient && !taken.has(h.id) && share(h, r) > 0`. `share` returns 0 for
an insufficient position and the stored share otherwise, so the effective
test is "has this hero ever been played here". `positionSufficient` is
`nEff >= 500` (`src/job/build/positions.ts:38`), an absolute-sample test.

No endpoint is affected. Nothing here reaches the bundle, the schema or the
job.

## Goals / Non-Goals

**Goals:** one threshold on share, at the candidate filter, chosen against
what it removes rather than how much.

**Non-Goals:** as the proposal fixes them — no change to `sufficient`, no
synergy fix, no hiding a hero from the picker, no exception list.

## Decisions

### The threshold is 0.5%, chosen by what it costs

Counting how many positions a threshold removes says nothing about whether
removing them is right. The figure that decides is how many positions the
model currently rates *well* are lost. Measured over the live bundle's 507
sufficient hero-positions:

```text
threshold   removes   of those, meta > 0   best position removed
     0.5%        26                    0   Phantom Lancer p3, 0.35%, meta −0.54
     1.0%        78                    1   Spectre p3, 0.81%, meta +2.51
     1.5%       108                    3
     2.0%       135                    7
     3.0%       160                   12   Winter Wyvern p2, 2.25%, meta +4.62
     5.0%       207                   22   Enigma p2, 3.38%, meta +4.94
```

0.5% is the largest threshold that removes no position the model rates above
neutral, and the best thing it removes is the reported defect itself. At 1%
Spectre's offlane goes at +2.51 — a real off-role pick, and the kind of
suggestion this product exists to make.

An earlier note in this session proposed 5% on the pair-count reduction
alone. That reading also claimed the threshold would halve a future
`laneOutcome` pull; at 0.5% it removes 26 of 507, so it saves nothing, and
that claim does not survive either.

No hero is left with no eligible role at any threshold up to 15%, so the
failure mode of a hero disappearing from every block does not arise and needs
no special case.

### It applies to the candidate set and to nothing else

`share` is read at three places in `src/model.ts`:

```text
line 123   inferEnemyRoles     weight of an assignment of an enemy to a role
line 190   candPop             popularity of a hero the enemy might still pick
line 249   candidate filter    what may be suggested            ← the gate
```

Only the third is a recommendation. Line 123 reasons about a hero somebody
has *already* picked: an enemy Phantom Lancer sitting on offlane is evidence,
however rare, and refusing to consider it would make the inference worse.
Line 190 asks who the enemy might pick next; a hero picked off-role is a risk
whether or not this model would ever suggest it.

Gating all three would have been the smaller diff and the wrong one.

### Nothing else moves

The fixture holds 63 sufficient positions and none below 0.5%, so no existing
case changes its answer and the fixture is not regenerated. `sufficient`
keeps its meaning. The constant joins `MODEL_CONSTANTS`, which
`src/types.ts` already calls the single source of truth for the client.

## Risks / Trade-offs

- **The threshold is fitted to one bundle on one patch.** The table above is
  a single reading of a single day. → It is a constant in one place with the
  measurement recorded here, so re-reading it later is re-running one script;
  and it was chosen at the edge of a flat region rather than at a cliff, so a
  drifting meta moves it slowly.
- **A genuinely new off-role pick is invisible until it passes 0.5%.** A hero
  the meta has just started flexing is suppressed for as long as the share
  takes to arrive. → Accepted: the alternative is suggesting every role
  anybody has ever tried, which is the defect being fixed. The picker still
  lists every hero, so nothing is unreachable.
- **Stryker's floor moves.** `mutation-floor` scopes it to `src/model.ts`
  alone, so a new branch in that file changes the surviving-mutant count. →
  The floor moves in this change rather than being left to the next one to
  discover.

## Open Questions

- Whether the threshold should be per-role rather than global — a 0.5% share
  at position 5 is a different population from 0.5% at position 1. Nothing in
  the measurement suggests it yet, and one constant is the thing to try
  first.
