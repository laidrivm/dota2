# suggestion-calibration

## Why

Four merged proposals name this change as the owner of the component weights,
and it does not exist. `beta-refit` sends them here, `outcome-calibration`
sends the scoring of suggestions rather than of the win estimate,
`laning-phase-model` and `lane-synergy-model` each add a weight and say this
is what fits it. Seven references from four artefacts, all into nothing.

What they point at is real. The score a suggestion carries is
`Σ wᵢ · componentᵢ`, and every `wᵢ` was set by hand and has never been
fitted:

```text
meta  side  phase  synergy  matchups   1.0 each
counterRisk                            0.5
lane  laneSynergy                      1.0 each, as their changes add them
```

`beta-refit` fits the logistic that turns `Δ` into a probability. It does not
touch what `Δ` is made of, and says so — a slope fitted over a wrong-weighted
`Δ` is still the best slope for the `Δ` the model produces. The weights are
the layer under it, and nothing has ever measured one.

## What Changes

- The weights that reach the win estimate are fitted against outcomes, by the
  machinery `beta-refit` builds for two parameters, generalised to several.
- The weights that reach only a suggestion get a ground truth of their own,
  which needs a stored draft replayed pick by pick rather than scored whole.
- Each run records what it fitted and what it refused, on the row
  `outcome-calibration` already writes.

## Capabilities

### Modified Capabilities

- `outcome-calibration`: its fitting requirement gains coefficients. **This
  delta is written against the version `beta-refit` leaves behind** — that
  change creates the fit this one widens, and there is no version of it
  without.
- `draft-model`: *Suggestion scoring* fixes the weights as
  `MODEL_CONSTANTS.weights`; a fitted set reaches the model the way a fitted
  logistic does, through the bundle. **Written against the version
  `lane-synergy-model` leaves behind**, which is the last of the four changes
  that replace this requirement.

## Non-goals

- **Changing what a component measures.** Every one of the eight is defined
  by a requirement of its own and none of them moves. This change multiplies
  them by better numbers.
- **Adding or removing a component.** A weight fitted to zero is the honest
  way to retire one, and it is a reading rather than an edit.
- **Leaving `α` and `β` alone.** Neither survives this change untouched, and
  saying otherwise would be the contradiction rather than the courtesy. `α`
  is fitted here, in the same likelihood, because it and the coefficients are
  one estimate: fitting them separately puts whatever the intercept should
  carry into whichever coefficient is fitted first. And `β` **ceases to
  exist**: it is the one slope over `Δ`, and `Δ` is what this change opens
  into its parts, so `β·Δ` becomes `Σ wᵢ·cᵢ` with no scalar left over. A run's
  row carries `α` and the vector `w`, and no `beta` column survives beside
  them — not even as an alias for the one-component case, where `w` simply
  has one element. What `beta-refit` establishes and this keeps is the
  machinery — the likelihood, the refusals, the held-out partition — not the
  two numbers.

## What is measurable today, and what is not

The eight split cleanly, and not in the way the component list suggests.
`src/model.ts:270-286` sums the win estimate from **four** of them:

```text
enter Δ            meta   side   synergy   matchups
suggestion only    phase  counterRisk   lane   laneSynergy
```

The first four are fitted the way `beta-refit` fits its slope, because they
are already predictors of a stored outcome. Measured over 1 469 Divine and
Immortal drafts scored against a centred bundle, they are near enough
orthogonal for a fit to separate them:

```text
                       meta    side   synergy   matchups
meta                      —       —     0.233     −0.018
synergy               0.233       —         —      0.234
matchups             −0.018       —     0.234          —
```

**Except `side`, whose column is identically zero.** 0 of 127 heroes carry a
non-zero side delta — the defect `side-and-phase-deltas` exists to fix — so
the side term of every draft is 0, and a weight multiplying a predictor with
no variance is unidentifiable rather than merely thin. Three of the four are
fittable today; the fourth becomes fittable when that change lands, which is
why the *Ordering* below requires it.

The other four are the hard half. They reach a candidate's score and never
`Δ`, so no stored full draft carries evidence about them: `counterRisk` is
zero once every enemy slot is filled, `phase` is a fact about when a hero was
picked, and the two lane components are summed over a board that is still
being built. Their ground truth has to come from replaying a draft pick by
pick — which is what `outcome-calibration` deferred here, and what this
change has to establish before it can claim to have fitted anything.

## Impact

- `src/types.ts` — `MODEL_CONSTANTS.weights` becomes a fallback, and
  `SnapshotBundle` carries the fitted set beside the calibration pair.
- `src/model.ts` — where the weights are read, on the split
  `laning-phase-model` leaves that file in.
- `src/job/` — the fitting run gains coefficients and a replay.
- `src/fixtures/snapshot.json` — regenerated.
- No new dependency and no new endpoint: every input is already stored.

## How this proposal ships

`design.md` and `tasks.md` follow on `spec/suggestion-calibration-plan`,
which opens from `main` once this branch has merged. The four artefacts
together are over the diff budget's failing threshold, and
`docs/git-and-prs.md` fixes what happens then. The change directory is
incomplete on purpose until the second branch lands; the `/zombies` pass has
already run, and its 38 ideas are what that `tasks.md` derives its test tasks
from.

## Ordering

Last of the calibration chain, after `beta-refit`, and after
`side-and-phase-deltas` for a reason the measurement above fixes rather than
convention: until that change lands, one of the four weights multiplies a
column of zeros and cannot be fitted at all.

After `laning-phase-model` and `lane-synergy-model` too — a set fitted over
six components and applied to eight is a fit for a model that no longer
exists, which is the sentence both of those changes already carry about this
one.
