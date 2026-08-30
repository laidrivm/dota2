# beta-refit — design

## Context

`src/model.ts:291` computes `1 / (1 + Math.exp(-C.beta * delta))` with
`C.beta = 0.1` from `src/types.ts:202`, whose doc comment reads "Logistic
slope per pp of advantage (§4)". `spec-inbox/model-spec.md:132` sets it and
calls it a heuristic in the same line, deferring the fit to v2.

Nothing between then and now could have fitted it: fitting needs finished
drafts with results, which `match-harvest` stores, and a scorer, which
`outcome-calibration` writes. Both are proposed and neither is applied, so
this change is last in that chain rather than first.

No endpoint changes shape. `/snapshot.json` gains one optional object:

```text
calibration?: { alpha: number; beta: number }    both finite, log-odds
```

## Goals / Non-Goals

**Goals:** a slope and an intercept fitted against outcomes, reaching the
client through the bundle, with a run refusing to publish a pair it cannot
stand behind.

**Non-Goals:** as the proposal fixes them — no weight fit, no suggestion
calibration, no change to what the UI renders.

## Decisions

### The intercept is signed by the side, not added flat

The quantity being fitted is the Radiant advantage, and the model is written
from *my team*'s perspective. A flat `α` would raise both teams' estimates,
which is the one thing an advantage of one side cannot mean.

```text
s = +1  session.side = "radiant"
s = −1  session.side = "dire"
s =  0  session.side = null

P(my team wins) = σ(α·s + β·Δ)
```

Three things fall out, and the third is why this form rather than a flat one:

- At `Δ = 0` with no side entered the answer is 50%, which is correct rather
  than a fallback: without a side there is no side advantage to apply.
- `sideDelta` already returns 0 when `session.side` is `null`
  (`src/model.ts:45-47`), so the intercept and the per-hero side term appear
  and vanish together rather than under two rules.
- `draft-model`'s *Antisymmetry* criterion survives. Swapping the teams swaps
  the side, so `α·s` changes sign alongside `β·Δ` and
  `σ(−α − βΔ) = 1 − σ(α + βΔ)` exactly. A flat `α` would break a criterion
  that has held since the model module was written, and would break it by
  `2·(σ(α) − 0.5)` — 4.55 pp at the fitted `α` of 0.0910, against a tolerance
  the criterion states as "~1 decimal place", which on a probability in
  `[0, 1]` is 5 pp — and `toBeCloseTo(…, 1)` at
  `model-estimate.test.ts:75` is exactly that bound. A flat intercept would
  therefore break an invariant the model rests on and pass the case that
  guards it, by 0.45 pp.

### The pair lives in the bundle, not in `MODEL_CONSTANTS`

The fitted value changes whenever the data does, and the data changes
nightly. A constant in `src/types.ts` is stale by construction: it would be
correct on the day it was committed and drift from then on, with nothing
saying when.

```text
MODEL_CONSTANTS.beta    a deploy per refit, and a number nobody re-measures
bundle.calibration      the export already runs nightly and already carries
                        per-snapshot figures; one more is free
```

The constants stay as the fallback, because the client caches the last good
bundle in `localStorage` (`src/app/snapshot.ts:87`) and a bundle cached
before this change carries no pair. `MODEL_CONSTANTS.beta` is therefore
updated to a fitted value in this change rather than left at 0.1 — a fallback
that is measurably worse than answering the base rate is not a fallback.

`MODEL_CONSTANTS.alpha` is added at the same time. Zero would be the
conservative default and is the wrong one: the model's `α = 0` is the defect,
and a fallback that reproduces it is a fallback to the bug.

### The field is optional, and the export omits it rather than filling it

*The exported bundle is what the client accepts* requires every declared key
present at every depth. `calibration` is the exception, and it is deliberate:
the model's fallback is triggered by the field's absence, so a bundle that
renders the constants under a fitted name is indistinguishable downstream
from one that was fitted. Omission is the signal.

That costs more in `src/job/export/contract.ts` than "one optional key"
suggests, and the checker is built so that getting it wrong fails loudly
rather than quietly:

- `named("", bundle, BUNDLE)` walks the bundle's **own** keys and refuses any
  it does not declare, so `calibration` must be in `BUNDLE`.
- The final loop treats every root outside `CHECKED_ABOVE` as a matrix keyed
  by hero id, so `calibration` must be in `CHECKED_ABOVE` too — otherwise
  `ids()` refuses `alpha` as "not a decimal integer string".
  `contract.ts:118-121` names this exact failure as the reason the list is
  written as an exemption.
- `named()` then refuses every declared key that is **missing**
  (`contract.ts:152`), which is the one thing an optional key must survive.

So the checker gains an optional-key concept it does not have today —
`calibration` is the first and only key in the contract with one — plus an
entry in each of the two lists. Three edits, not one, and the first two are
forced by machinery that already refuses the alternatives.

### The fit is over the store, and it is guarded three ways

Bootstrapped over the 1 446 matches this change scored, the 5th-to-95th
percentile band on `β`:

```text
n        β median   β 5–95%           spread    α median
200      0.0168     0.0022–0.0329     ±92%      0.0902
400      0.0154     0.0075–0.0274     ±65%      0.1003
800      0.0154     0.0108–0.0241     ±43%      0.1003
1 446    0.0161     0.0120–0.0215     ±30%      0.0972
```

`α` is steady from 200 matches up. `β` is what the sample buys, which is why
the fit runs over the store rather than the night, and why the floor is 2 000
rather than "whatever the run scored". The floor sits just past the last
measured row; the curve is still narrowing there, and a run over the store's
50 000-match cap is far past it.

Rows beyond 1 446 are not written down because a bootstrap resamples the same
1 446 matches with replacement, so it would report a precision the data does
not have. What the table supports is the shape and the floor's order of
magnitude, not a figure at 20 000.

The three refusal conditions are one measured failure each rather than
defensive habit:

- **Divergence.** The first Newton–Raphson written for this measurement, with
  no step control, returned `β = 3543.7` and `α = −1961.0` on these same
  matches — every estimate at 0% or 100%. It converged in the sense of
  terminating.
- **The floor.** A pair fitted on 200 matches spans a factor of fifteen, so
  two consecutive nights would move the client's answers by more than the
  data moved.
- **Held-out Brier below the base rate.** This is the condition `β = 0.1`
  fails today, at 0.4158 against 0.2497. A guard that would not have caught
  the defect the change exists to remove is a guard that has not been tested.

A refused fit leaves the previously published pair standing. Falling back to
the constants would replace a pair that passed all three conditions with the
value that fails the third.

### What the fit is worth, held out

Five-fold, no match scored by parameters fitted on it, 1 446 matches:

```text
                              live bundle    with score-calibration
base rate, ignores the draft      0.2497                    0.2497
the model as it stands            0.4158                    0.2963
slope fitted, no intercept        0.2493                    0.2475
slope and intercept fitted        0.2490                    0.2471
accuracy, slope and intercept     52.77%                    54.43%
```

Two readings, and the second is the uncomfortable one:

- Fitting removes the loss. 0.4158 → 0.2490 is the whole of what `β = 0.1`
  was costing, and it is most of this change's value.
- Fitting does not buy much beyond the floor. 0.2497 → 0.2471 is the model's
  entire measured contribution over ignoring the draft, and 51.80% → 54.43%
  is the accuracy version of it. The draft reasoning is worth about two and a
  half points of accuracy. That is a real number rather than a disappointing
  one — it is the first time this repository has had any — but it is not the
  number the interface's confident percentages imply.

## Risks / Trade-offs

- **The sample is one bracket and one region.** 1 446 matches from the
  European season leaderboard's top 200. → The store `match-harvest` builds
  is the same population, so the fit and the serve match. What it does not
  support is a claim about lower brackets, and nothing here makes one.
- **`α` fitted at 0.0910 here and the Radiant rate measured 51.80%, against
  53.36% over `outcome-calibration`'s 1 788 matches.** The two samples
  disagree by 1.6 pp on the quantity `α` is. → Which is why `α` is fitted per
  run rather than pinned once, and why the floor is a match count rather than
  a date range.
- **The bundle grows a field the client can be handed without.** → The
  fallback is a criterion with its own scenario, and the constants it falls
  back to are updated in this change rather than left at the value the
  measurement refuses.
- **Stryker's floor applies to `src/model.ts` and this changes lines in it.**
  → `openspec/specs/mutation-floor/` scopes the configuration to that file
  already; the floor is met or the change does not merge, which is the
  arrangement working rather than a risk to mitigate.
- **A refit changes every user's displayed percentage overnight, with no
  version bump.** → That is the point of putting it in the bundle, and the
  three guards are what keep the change bounded. What is not covered is a
  user noticing the number moved; nothing in the UI says a snapshot's
  calibration differs from yesterday's, and nothing here adds it.

### The held-out split is pinned, because it is a publish gate

Leaving the partition open would have been reasonable for a reported figure
and is not for a gate. The same store must reach the same publish-or-refuse
decision every time it is asked, so the criterion fixes five folds, a match
in fold `match_id mod 5`, and one Brier over every held-out prediction
pooled. Pooling rather than averaging five per-fold Briers matters at the
store's edges: an uneven last fold would otherwise weigh as much as a full
one.

`match_id mod 5` rather than a seeded shuffle because it needs no state — a
run reproduces the folds from the store alone, with nothing recorded and
nothing to lose.

### The case that guards antisymmetry cannot currently fail on it

`model-estimate.test.ts:55` scores the mirror with `side: null`, and its own
comment says why: side off, so the only residual is role-inference impurity.
At `s = 0` the intercept vanishes, so that case passes whether `α` is signed
by the side or added flat — it is blind to the one error the decision above
exists to prevent.

The same is true of `model-estimate.test.ts:45`, which pins `winProbability`
against a literal `0.1`: it would keep passing against a bundle-supplied
slope, because it recomputes the expectation with the constant rather than
reading what the bundle carried.

Both are rewritten rather than extended. A criterion guarded by a case that
cannot fail on it is a criterion nothing checks.

## Open Questions

- Whether `β` should be refitted nightly or on a schedule of its own. The
  bootstrap says a night's addition to a 50 000-match store moves it by far
  less than the band, so nightly is affordable rather than necessary.
