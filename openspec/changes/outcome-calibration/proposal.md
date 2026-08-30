# outcome-calibration

## Why

`match-harvest` stores finished drafts and their results and computes nothing
from them. This change computes the one figure the whole pipeline has never
had: how well the model predicts.

The figure has a floor it must clear, and the floor is not a coin. Measured
over 1 788 Divine/Immortal ranked All Pick matches on 2026-08-30, **Radiant
wins 53.36%** (95% CI ±2.32 pp, which excludes 50%). A predictor that ignores
the draft entirely and always names Radiant therefore scores 53.4% accuracy
and 0.2489 Brier. A model that cannot beat that is a model whose draft
reasoning is worth nothing, and until now nothing in this repository could
have said so.

There is already a reason to expect it does not. `beta` is `0.1`, marked
provisional in the model spec and never fitted, and it turns the draft
advantages the model actually produces into claims no evidence supports:

```text
Δ = 10 pp → 73.1%     Δ = 25 pp → 92.4%     Δ = 40 pp → 98.2%
```

## What Changes

- The stored drafts gain a reader. What it turns each one into and what it
  refuses is `outcome-calibration`'s to state.
- The pipeline gains a figure about itself, and the floor that figure is
  compared against. Which figures, and what the floor is taken from, are that
  capability's too.
- The nightly job gains a fifth step and a second step invocable on its own.
  Where it sits and what its failure costs are `snapshot-ingest`'s.

## Capabilities

### New Capabilities

- `outcome-calibration`: how a stored draft becomes a session the model can
  score, what each run records, what the model is measured against, and what
  a draft the bundle cannot score does.

### Modified Capabilities

- `snapshot-ingest`: its *The job carries a run to one outcome* requirement
  gains a fifth step. **This delta is written against the version
  `match-harvest` leaves behind, not against the one on `main` today** — that
  change adds the fourth step, and this one cannot be synced before it is.

## Non-goals

- **Fitting `beta`.** This change measures; `beta-refit` changes the number.
  Measuring first is the point: a `beta` fitted before there is a figure to
  fit it against is the same guess with more arithmetic.
- **Changing the model.** `computeModel` is called, never edited. What the
  figure says about the formula is `score-calibration`'s to act on.
- **Scoring suggestions.** The model returns a `winEstimate` only at a full
  ten-pick draft, and that is all this scores. Replaying a draft pick by pick
  to score the suggestions is `suggestion-calibration`.
- **`adjustedWinRate` as a baseline.** STRATZ returns it per pick, ten to a
  match, not as a prediction. Combined the obvious way — the difference of
  each side's mean, through a logistic — it scores 50.3% on 1 512 full
  drafts, and even with the best `beta` fitted in hindsight reaches 0.2498
  Brier, which is worse than the always-Radiant baseline's 0.2489. One
  combining rule is not proof the numbers are useless, but it is enough that
  this change does not build on them.
- **A coin-flip baseline.** Always-Radiant is strictly harder to beat, so the
  weaker floor tells nobody anything the stronger one does not.
- **Decomposing Brier** into calibration and resolution. Worth having when a
  figure moves and nobody can say which half moved; not worth having before
  there is a first figure at all.
- **Alerting on a bad figure.** Recording it is this change's; noticing is
  `PLAN.md`'s open error-tracking task.

## Impact

- `src/job/` — a new module that builds a session from a stored draft and
  scores it, beside the harvest it reads.
- `src/job/schema.sql` — one table of per-run figures, and its reclaim in
  `src/job/db.fixture.ts`.
- `src/job/run.ts` — a fifth step, a fifth failure to report, and a second
  standalone mode.
- `src/model.ts`, `src/types.ts` — unchanged. The model is imported and
  called; the job may import it, the reverse being what the boundary rule
  forbids.
- `openspec/specs/snapshot-ingest/spec.md` — one requirement modified, on top
  of `match-harvest`'s modification of the same one.
- No new dependency, and no request to the statistics API: everything this
  step reads is already in the database.
