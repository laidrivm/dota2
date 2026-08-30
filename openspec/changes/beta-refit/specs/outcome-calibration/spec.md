# outcome-calibration delta — beta-refit

Written against the version `outcome-calibration` leaves behind. That change
creates the capability; this one cannot be synced before it is applied.

## ADDED Requirements

### Requirement: The logistic's two parameters are fitted over the store

A calibration run SHALL fit `α` and `β` of
`P(Radiant wins) = 1/(1+e^(−(α + β·Δ)))` by maximum likelihood over the
`(Δ, didRadiantWin)` pairs of every match the run could score, and SHALL
record the pair on the run's row beside the figures it already records.

Both parameters SHALL be fitted, never one. The model has no intercept, so
at `Δ = 0` it answers 50% where the truth is the side's own advantage — 51.80%
over the 1 446 matches this change measured, 53.36% over the 1 788
`outcome-calibration` measured. Fitting the slope against data whose base
rate is not 50% pushes that offset into the slope, where it is a claim about
the draft rather than about the side.

The fit SHALL run over every scorable match the store holds, not over the
matches the run's own night added. Bootstrapped over 1 446 scored matches,
the 5th-to-95th-percentile band on `β` narrows with the sample and does so
slowly:

```text
n        β median   β 5–95%           spread
200      0.0168     0.0022–0.0329     ±92%
400      0.0154     0.0075–0.0274     ±65%
800      0.0154     0.0108–0.0241     ±43%
1 446    0.0161     0.0120–0.0215     ±30%
```

`α` is the steady one, sitting between 0.090 and 0.100 at every size. `β` is
what the sample buys, and a night's matches do not buy it.

Scoring SHALL use the perspective *A stored draft is scored as a
Radiant-perspective session* fixes, so `Δ` and `didRadiantWin` are read from
one side throughout and the fitted `α` is the Radiant advantage rather than a
quantity that changes meaning halfway through the store.

#### Scenario: A fit over the whole store

- **WHEN** a run scores the matches its own night added and the store holds
  older scorable ones
- **THEN** the fit SHALL be taken over all of them, and the count it was
  taken over SHALL be recorded on the run's row

#### Scenario: Both parameters, never one

- **WHEN** a fit is taken over ten matches at `Δ = −1` of which five are
  Radiant wins and ten at `Δ = +1` of which eight are
- **THEN** the recorded pair SHALL be `α = 0.6931`, `β = 0.6931` to four
  decimals, whose log-likelihood is `−11.9355` against the `−12.9489` of the
  best fit holding `α` at 0

#### Scenario: A sample the slope alone already fits

- **WHEN** a fit is taken over five matches at `Δ = −1` of which one is a
  Radiant win and ten at `Δ = +1` of which eight are
- **THEN** the recorded `α` SHALL be 0 and the pair SHALL be published, a
  maximum-likelihood `α` of 0 being a fitted value rather than an unfitted one

The recorded pair SHALL be the maximum-likelihood pair over the sample, and
its log-likelihood SHALL therefore never be less than that of any fit holding
`α` at 0. It is *not* required to be strictly greater, and neither is `α`
required to be non-zero, because the second scenario is a case where the two
coincide exactly: the group rates 1/5 and 8/10 are reproduced by `α = 0`,
`β = ln 4` alone.

Two things this requirement does **not** assert, each because a correct fit
can violate it:

- `1/(1+e^(−α))` is not the sample's Radiant win rate. `α` is the conditional
  log-odds at `Δ = 0`, the win rate is marginal, and they part company
  whenever `Δ` is not centred on 0 — over equal samples at `Δ = −1` winning
  40% and `Δ = +1` winning 80%, the fit gives `α = 0.4904`,
  `1/(1+e^(−α)) = 62.02%` against a marginal 60.00%.
- A marginal rate away from 50% does not force `α` away from 0, which the
  second scenario above is exactly.

### Requirement: A fit that cannot be trusted is refused, not published

A run SHALL publish a fitted pair only when all three hold, and SHALL leave
the previously published pair in place otherwise, recording that the fit was
refused and which condition failed.

1. **The sample reaches 2 000 scorable matches.** Below that the fit is not
   wrong so much as unknown: at 200 matches the band above spans a factor of
   fifteen, and at 800 it is still ±43%. The floor is where the band is
   narrow enough that a night's refit does not move the client's answers by
   more than the data moved.
2. **The fit converged.** Maximum likelihood on this shape diverges when the
   sample is separable, and it diverges loudly: an unguarded
   Newton–Raphson over these same 1 446 matches returned `β = 3543.7` and
   `α = −1961.0`, which is every estimate at 0% or 100%. A run SHALL treat
   non-convergence, a non-finite parameter, or a `β` outside `[0, 1]` as a
   failed fit.
3. **The pair beats the base rate held out.** The pair SHALL be scored by
   cross-validation, no match scored by parameters fitted on it, and its
   Brier SHALL be strictly below that of a predictor answering the sample's
   Radiant win rate for every match. This is the condition `β = 0.1` fails
   today — 0.4158 against a floor of 0.2497 — so it is the one that would
   have caught the defect this change exists to remove.

   The cross-validation SHALL be deterministic, because this is a publish
   gate: an unspecified partition means one store publishes or refuses
   depending on a choice nothing records, and a gate whose outcome is not
   reproducible is not a gate. Five folds, a match assigned to fold
   `match_id mod 5`, and one Brier over every held-out prediction pooled —
   never a mean of five per-fold Briers, which weights a short fold equally
   with a long one. The baseline SHALL be computed over the same pooled set,
   so the two numbers compared are taken over one population.

A refused fit SHALL NOT fall back to `MODEL_CONSTANTS`. The previously
published pair is a fit that passed these conditions; the constants are the
value that failed the third one.

#### Scenario: A sample below the floor

- **IF** a run can score fewer than 2 000 matches
- **THEN** no pair SHALL be published, the previously published pair SHALL
  stand, and the run's row SHALL name the sample floor as the reason

#### Scenario: A fit that diverges

- **IF** the fit returns a non-finite parameter, or a `β` outside `[0, 1]`
- **THEN** no pair SHALL be published and the run SHALL record the fit as
  failed rather than storing the number it arrived at

#### Scenario: A fit no better than the base rate

- **IF** the fitted pair's Brier over the pooled held-out predictions of the
  five folds is at or above that of a predictor answering the sample's
  Radiant win rate for every match in the same pooled set
- **THEN** no pair SHALL be published, which is what `β = 0.1` would meet
  today at 0.4158 against 0.2497

#### Scenario: The same store decides the same way twice

- **WHEN** the gate runs twice over an unchanged store
- **THEN** it SHALL reach the same publish-or-refuse decision and the same
  held-out Brier, the folds being fixed by `match_id mod 5` rather than
  drawn

#### Scenario: The first run, with nothing published before

- **WHEN** a run's fit is refused and no pair has ever been published
- **THEN** the export SHALL omit `calibration` and the model SHALL fall back
  to `MODEL_CONSTANTS`, which is the only case in which those constants are
  what a client uses

#### Scenario: A refusal does not undo a published pair

- **WHEN** a run's fit is refused and an earlier run published a pair
- **THEN** the published pair SHALL stand unchanged, and SHALL NOT be
  replaced by `MODEL_CONSTANTS`
