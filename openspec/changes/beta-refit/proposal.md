# beta-refit

## Why

`beta = 0.1` was a heuristic, and `spec-inbox/model-spec.md:132` says so in
the line that sets it: "честная калибровка β — v2". This is v2. Measured over
1 446 Divine and Immortal ranked All Pick matches scored through
`computeModel` against the live bundle on 2026-08-30, the heuristic is not
merely unfitted — it is **worse than predicting nothing**:

```text
predictor                        Brier    accuracy
base rate, ignores the draft    0.2497      51.80%
the model as it stands          0.4158      52.42%
```

A Brier of 0.4158 against a 0.2497 floor is what a confident wrong answer
costs. The cause is scale: the model's `Δ` over those matches has a standard
deviation of 66 pp and a range of −210 to +195, so `σ(0.1 · Δ)` is saturated
at 0 or 1 for most drafts. The model is right 52% of the time and certain
every time.

Fitting the slope alone removes almost all of it. Fitting a slope **and an
intercept** removes the rest — and the intercept is not an optional
refinement, because the model has none at all. At `Δ = 0` it must answer 50%
where the truth is the side's own advantage: 51.80% in this sample, 53.36%
in the 1 788-match sample `outcome-calibration` measured. Every figure below
is held out, five-fold, so no match is scored by parameters fitted on it:

```text
                                 Brier    accuracy
base rate, ignores the draft    0.2497      51.80%
the model as it stands          0.4158      52.42%
slope fitted, no intercept      0.2493      52.42%
slope and intercept fitted      0.2490      52.77%
```

## What Changes

- The logistic gains a second fitted parameter. What the pair is fitted
  against, what a run refuses to publish, and how the intercept is signed
  are `beta-refit`'s to state.
- The bundle carries the pair, so a refit reaches the client without a
  deploy. Its shape and its absence are `snapshot-export`'s and
  `snapshot-delivery`'s.
- The win estimate reads the pair the bundle carries. What it does when the
  bundle carries none is `draft-model`'s.

## Capabilities

### New Capabilities

- `outcome-calibration`: the fitting run — what it fits over, what it refuses
  to publish, and how often. **This delta is written against the version
  `outcome-calibration` leaves behind, not against anything on `main`
  today**: that change creates the capability, and this one cannot be synced
  before it is.

### Modified Capabilities

- `draft-model`: *Win probability at full draft* fixes the logistic as
  `1/(1+e^(−β·Δ))` with `β = MODEL_CONSTANTS.beta`, which is the whole of
  what this change replaces. Its *Antisymmetry* scenario is why the
  intercept is signed by side rather than added flat.
- `snapshot-export`: *The exported bundle is what the client accepts*
  asserts every declared key at every depth, so a new bundle field is that
  requirement's.

`snapshot-delivery` is **not** modified, though it looks as though it should
be: the client caches the last good bundle in `localStorage`, so a bundle
predating this change is one the client will hold and hand to the model. But
its *Malformed payload* scenario checks four fields and the calibration is
none of them, so nothing it states changes. What a bundle without the pair
does is behaviour of the model, and `draft-model` carries it.

## Non-goals

- **Fitting the component weights.** `meta`, `side`, `phase`, `matchups` and
  `synergy` weigh 1.0 and `counterRisk` 0.5, none of them fitted. They are a
  six-parameter problem where this is a two-parameter one, and a slope
  fitted over a wrong-weighted `Δ` is still the best slope for the `Δ` the
  model produces. Weights are `suggestion-calibration`'s.
- **Making the model good.** The gain over a predictor that ignores the
  draft entirely is 2.6 pp of accuracy and 0.0026 of Brier, held out and
  after `score-calibration`. That is a real gain and a small one, and this
  change does not claim otherwise; what it removes is a loss.
- **Refitting on every run's matches alone.** The five folds disagree by
  ±25% on `β` at 1 446 matches. The fit is over the store, not over a night.
- **Recalibrating the suggestion scores.** `β` reaches only `winEstimate`;
  the suggestion blocks rank by raw score and no logistic touches them.
- **The confidence the UI shows.** Nothing about the rendered string
  changes. `draft-board` pins it as `Draft advantage: +3.2 pp → ~58% win`,
  and both halves keep their meanings — the second simply stops being a
  number no evidence supports.

## Impact

- `src/model.ts` — the two lines that compute `winProbability`.
- `src/types.ts` — `SnapshotBundle` gains a field, and
  `MODEL_CONSTANTS.beta` becomes a fallback rather than the value.
- `src/job/export/render.ts` — the field is rendered where the bundle is
  assembled.
- `src/fixtures/snapshot.json` — regenerated, and the model's own suite reads
  it.
- `openspec/specs/mutation-floor/` — Stryker is scoped to `src/model.ts`, and
  this changes lines in it. The floor applies unchanged.
- No new dependency, no schema change beyond the calibration run's own row,
  no request to the statistics API.

## Ordering

This change SHOULD NOT be applied before `outcome-calibration`,
`score-calibration` and `side-and-phase-deltas` are. The first supplies the
scorer that produces the pairs to fit over. The other two move `Δ` itself,
and by enough to change the answer — the same 1 446 matches, held out, with
`score-calibration`'s centring applied to the matrices first:

```text
                              uncentred   centred
fitted β                         0.0019    0.0153
Brier, slope and intercept       0.2490    0.2471
accuracy                         52.77%    54.43%
```

A `β` fitted before the centring is a `β` fitted to a scale the next change
removes, and it is eight times too small for the scale that replaces it.
