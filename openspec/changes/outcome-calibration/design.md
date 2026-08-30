# outcome-calibration — design

## Context

`match-harvest` fills the store; nothing reads it. This change reads it once a
night and once on demand, and writes down one figure and the floor it has to
clear.

Every number below was measured on 2026-08-30 against 1 788 unique
Divine/Immortal ranked All Pick matches drawn from the European leaderboard,
of which 1 512 carried ten picks with STRATZ's own per-pick rates attached.

## Goals / Non-Goals

**Goals:** a Brier score, an accuracy, and the always-Radiant baseline for
both, recorded per run against the snapshot that produced them, repeatable
without an API request.

**Non-Goals:** as the proposal fixes them — no `beta` fit, no model change,
no suggestion scoring, no `adjustedWinRate`, no coin baseline, no Brier
decomposition, no alerting.

## Decisions

### Brier decides; accuracy is recorded beside it

The two disagree exactly where this project's known defect lives. Over the
same 1 788 matches:

```
predictor                            accuracy    Brier
always Radiant, p = 0.534              53.4%    0.2489
always Radiant, p = 0.75               53.4%    0.2957
always Radiant, p = 0.99               53.4%    0.4572
```

Accuracy cannot separate them; Brier separates them by a factor of nearly
two. The model as it stands claims 92.4% at Δ = 25 pp and 98.2% at Δ = 40,
which is the third row's failure mode, and a project measuring accuracy alone
would have shipped it reporting "53% correct" and called that the answer.

Accuracy is recorded anyway because it is the figure a person reads without
being taught one, and it costs one line. It decides nothing.

### The baseline is always-Radiant, taken from the matches scored

Radiant wins 53.36% of the sampled matches (95% CI ±2.32 pp, excluding 50%),
so the side alone is a real predictor and a coin is not the floor to beat. A
coin baseline is therefore not recorded at all: it is strictly weaker, and a
weaker floor tells nobody anything the stronger one does not.

The probability is the Radiant rate of the run's own matches rather than a
constant. A constant would leave the model compared against a floor from
another population as the meta, bracket or region drifts, and taking it from
the same matches makes it the best a constant predictor could possibly do —
the conservative direction for a floor.

### `adjustedWinRate` is not the free baseline an earlier note claimed

STRATZ attaches `baseWinRate` and `adjustedWinRate` to each pick — ten per
match, not one prediction per match. Turning them into a side's probability
needs a combining rule, and the obvious one does not work. Taking each side's
mean, differencing them and passing that through a logistic:

```
sign of the difference alone predicts       50.3%     (noise is 50%)
best beta fitted in hindsight (0.015)      0.2498 Brier
always Radiant                             0.2489 Brier
```

Fitted with full knowledge of the answers it is still worse than a baseline
that ignores the draft. One combining rule failing is not proof the numbers
carry nothing, but it is enough that this change does not rest on them, and
enough that the claim they were a ready-made baseline should not be repeated.

### One row per run, not one per match

A prediction is a pure function of a stored draft and a bundle. Storing
1 500 of them a night would be storing a derivation, and re-deriving them
costs no API request and no pacing — which is the whole reason the scorer is
separately invocable. So a run writes its counts and its four figures, and
trying a calibration variant means running the scorer again rather than
querying a table of old predictions.

### The scorer runs after the harvest, and can run alone

After, so a run's figures cover the matches that run collected. Alone,
because comparing two calibrations against the same matches is a thing
somebody does several times in an hour, and a step reachable only through the
whole nightly job would make that a day's wait each time.

A harvest that fails stops the scorer: figures over a store the run failed to
fill would be reported as though the night had gone normally.

### Radiant is the perspective, and the model is not touched

`computeModel` answers "does my team win" for a `Session` carrying
`side`, `myRole`, `teamPicks` by role and `enemyPicks` without roles. The
store holds positions for both sides, so a stored match becomes a session by
putting the Radiant picks into `teamPicks` at their stored positions and the
Dire picks into `enemyPicks`. Fixing the perspective on Radiant is what makes
one number scoreable against `didRadiantWin` without a convention that flips
halfway through the store.

The model is imported and called, never edited. `src/model.ts` may not import
from `src/app/**`; nothing forbids the job importing the model, and this
keeps the scored formula identical to the served one by construction rather
than by discipline.

## Risks / Trade-offs

- **The bundle scoring a match may post-date it.** The store keeps 50 000
  matches and the bundle is rebuilt nightly, so a match is generally scored
  by a bundle built from a window that includes it. → The figure is recorded
  against its snapshot, so the leak is visible rather than hidden; measuring
  it, and deciding whether a lag is needed, is work this change deliberately
  leaves to the first figures rather than guessing at now.
- **The sample is leaderboard members, not the ranked population.** Shared
  with `match-harvest`, which records it: the bundle is built from the same
  bracket, so the bias is shared rather than introduced.
- **Brier folds calibration and resolution into one number.** A figure that
  worsens will not say which half moved. → Named as a non-goal; the
  decomposition is worth adding the first time that question is actually
  asked.
- **A hero leaving the game silently shrinks the scorable set.** A match
  whose pick names a hero the bundle lacks cannot be scored. → It is counted
  as unscorable rather than dropped, so a shrinking scorable set is a number
  somebody can see.

## Open Questions

- Whether the figures want a floor gate in CI, the way the mutation and
  spec-coverage floors work. Premature: a floor needs a first measurement to
  sit on, and this change is that measurement.
