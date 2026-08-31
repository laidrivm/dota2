# suggestion-calibration — design

## Context

`beta-refit` fits `σ(α + β·Δ)` and records the pair on the calibration run's
row. `Δ` is `src/model.ts`'s weighted sum, and the weights in
`MODEL_CONSTANTS.weights` were set by hand: 1.0 for seven components, 0.5 for
`counterRisk`. Fitting `β` asks how much the sum is worth; nothing has asked
how much each part is.

`/snapshot.json` gains one root beside `calibration`:

```text
weights: Record<component, number>    all eight, or the key is absent
```

## Goals / Non-Goals

**Goals:** the four components that reach `Δ` fitted against outcomes; the
four that reach only a suggestion fitted over a replayed draft; a published
set the model reads the way it reads the calibration pair.

**Non-Goals:** as the proposal fixes them — no component's definition moves,
none is added or removed, and `β` is not preserved.

## Decisions

### Four are fittable from a stored draft and four are not

```text
enter Δ            meta   side   synergy   matchups
suggestion only    phase  counterRisk   lane   laneSynergy
```

`counterRisk` is 0 once every enemy slot is filled, `phase` is a fact about
when a hero was picked, and the two lane components sum over a board still
being built. A finished 5v5 carries no evidence about any of them, which is
why half this change is a replay rather than a wider regression.

### `α` is fitted with the coefficients, and `β` does not survive

One likelihood, all parameters. Fitting `α` separately puts whatever the
intercept should carry into whichever coefficient goes first, and `β` is the
one slope over the sum this change opens into its parts — so `β·Δ` becomes
`Σ wᵢ·cᵢ` with no scalar beside it. The row carries `α` and the vector.

What `beta-refit` leaves and this keeps is the machinery: the likelihood with
step control, the refusal conditions, the `match_id mod 5` partition, the
derived-not-configured discipline. Not the two numbers.

### `side` cannot be fitted today, and that is a fact rather than a risk

0 of 127 heroes carry a non-zero side delta, so the side term of every draft
is 0 and its coefficient multiplies a column with no variance. Unidentifiable
rather than thin: no sample size fixes it, only `side-and-phase-deltas`.

The run records it unfitted and keeps its hand-set weight rather than
failing. Failing would hold the other three hostage to a defect another
change owns, and a component nothing can measure is exactly the state the
"unfitted" record exists for.

### The columns are separable, measured rather than assumed

Over 1 469 Divine and Immortal drafts against a centred bundle:

```text
                       meta    side   synergy   matchups
meta                      —       —     0.233     −0.018
synergy               0.233       —         —      0.234
matchups             −0.018       —     0.234          —
```

Pairwise |r| at most 0.234. A fit separates them; the question is well posed
rather than merely well intentioned. `side`'s row is empty because its column
is constant, which is the paragraph above.

Worth naming what this measurement is not: it was taken with `matchups`
carrying the enemy-meta residual, because the model infers enemy roles inside
`computeModel` and the residual was the only way to read it from outside. The
requirement forbids the implementation from doing the same — each column
computed from its own definition — so the shipped fit will have a cleaner
`matchups` column than the one measured here, not a dirtier one.

### The replay's rows inherit their match's fold

Ten picks, one outcome. Split row by row, a match's picks land on both sides
of the held-out partition and the fit is scored on an outcome it trained on
ten times. `match_id mod 5` is already match-level; the rows take their
match's value rather than one of their own.

### The bootstrap table is a floor, not a forecast

`beta-refit` measured its band fitting one coefficient. Splitting one sample
across more parameters widens every band, so ±30% at 1 446 matches is the
best a many-coefficient fit could inherit. Nothing has measured what it will
actually show, and the sample size the run records is what makes that
readable afterwards.

## Risks / Trade-offs

- **One outcome answers for ten picks.** The replay's signal is weak by
  construction. → The requirement says so rather than implying otherwise, and
  records how many picks each outcome was attributed to. What it can
  establish is whether a component's score at pick time carries information;
  what it cannot is how much of the result that pick caused.
- **A fitted weight near zero retires a component without a decision.** →
  That is the honest reading and the proposal names it a non-goal to act on:
  the number is recorded, the component stays, and removing it is a change of
  its own with a criterion to delete.
- **Eight coefficients over a store that grows nightly.** Each night moves
  every weight a little, and the client's suggestions move with them. → The
  refusal gate is what bounds it: a set must beat the hand-set weights
  held-out, so a night that fits worse changes nothing.
- **`src/model.ts` reads the weights, and Stryker's floor is scoped to it.**
  → `laning-phase-model` splits that file; this adds to whatever it became
  and the floor applies unchanged.

## Open Questions

- Whether the replay should score every pick or only the picks of the side
  whose outcome is known to be independent of the model — there is no such
  side, so it scores every pick, and the question is really whether the two
  sides' rows should carry opposite responses or the same one attributed
  differently. The requirement takes the second; nothing measured says the
  first is better.
- Whether a component fitted to a negative weight should publish. The bound
  is `[0, 5]`, which refuses it, on the reasoning that a component the model
  sums is one it believes helps. A fitted negative is evidence the component
  is defined backwards, which is a finding rather than a weight.
