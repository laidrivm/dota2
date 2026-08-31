# lane-synergy-model

## Why

`laning-phase-model` brings in who a candidate stands **against**. This
brings in who it stands **beside**, which is a different statistic reached by
one flag — `isWith: true` on the same endpoint — and a different question
from the one `synergies` answers.

Measured on Phantom Lancer at position 1 over twelve weeks, 84 lane allies
carrying 60 games or more:

```text
spread            lane 44.4 pp        match 23.0 pp
corr(lane pp, the synergy stored today)        +0.182
corr(lane pp, the match pp of the same pair)   +0.417
games per pair                                  3 239
```

A correlation of 0.182 with what the bundle already carries is the case for
the change: the stored synergy is a whole-match figure over every hero that
was on the team, and this is the two heroes who actually stood in one lane
for ten minutes. The spread is again about twice as wide.

The samples are deep, and for a structural reason the opponent pull cannot
share: a carry has one support beside it in nearly every game, where its
opponents split across the pool. 3 239 games a pair against the 244 a median
opponent cell reaches.

The two directions of an ally pair agree far more closely than an opponent
pair's do, and the reason is what the statistic is:

```text
                     two independent pulls of one pair
allies     mean |difference|  0.21 pp    max 0.35
opponents  mean |sum|         1.04 pp    max 1.50
```

Two allies see the **same** event — their lane won or it did not — where two
opponents see complementary ones. It is still not an invariant to assert:
0.35 pp is a disagreement, and the two pulls admit different games by their
position filters. Both directions are stored, as they are for opponents.

## What Changes

- The lane pull gains its ally half — the same endpoint, the same window, the
  flag flipped. What it asks for and what it costs is `snapshot-ingest`'s.
- The build stores and centres it exactly as `laning-phase-model` established
  for the opponent half — both directions from their own pulls, centred by the
  row mean, its constant derived. The one difference is what the two
  directions mean, and it is smaller than it looks.
- The bundle carries a fourth matrix and the suggestion score an **eighth**
  component — the seven before it being `meta`, `side`, `phase`, `synergy`,
  `matchups`, `counterRisk` and `laning-phase-model`'s `lane`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

Every one of these is a requirement `laning-phase-model` writes, and this
change amends its own predecessor rather than anything on `main`. **All four
deltas are written against the version that change leaves behind, and it must
be applied and synced first** — there is no version of these requirements
without it.

- `snapshot-ingest`: *Lane outcomes are pulled per hero and position* fixes
  one pull; this makes it two.
- `snapshot-build`: *The lane statistic is centred and its constant is
  derived* covers a second statistic under the same rules. *Stored pair
  statistics carry their symmetry* is **not** touched, for the reason
  `laning-phase-model` records: a lane pair's two directions are independent
  measurements, and this half is no different.
- `snapshot-export`: *The lane matrix is expanded per position* gains a
  sibling for allies.
- `draft-model`: *Suggestion scoring* gains an eighth component.

## Non-goals

- **Merging the two lane statistics into one.** They answer different
  questions and correlate differently with what the bundle already carries —
  `+0.204` against the stored matchup, `+0.182` against the stored synergy —
  so they are summed as separate components with separate weights.
- **Replacing `synergies`.** The match synergy answers who wins games
  together and this answers who wins a lane together; `+0.417` against the
  same pair's match outcome says they overlap more than the opponent pair
  does, not that either is redundant.
- **Fitting the weight.** It enters at 1.0 like the seven before it.
  `suggestion-calibration` fits all of them.
- **Deriving a second smoothing constant.** The rule `laning-phase-model`
  establishes — `k = (mean per-game variance) / var_true`, computed per run
  over a statistic's own centred unsmoothed deltas — applies unchanged. On
  this data it comes out **29**, inside the 11-to-37 the opponent half
  measured. Draws are 28.9% of ally lane games, so the Bernoulli variance
  that change had to correct would have read 44 here.

## Impact

- `src/job/ingest/` — the pull built for opponents runs a second time.
- `src/job/schema.sql` — a table beside `hero_lanes`, keyed the same way.
- `src/job/build/`, `src/job/export/render.ts`, `src/model.ts`,
  `src/types.ts` — a fourth matrix and an eighth component, on the paths the
  opponent half opened.
- `src/fixtures/snapshot.json` — regenerated.
- No new dependency and no new endpoint. **3 600 requests, doubling
  `laning-phase-model`'s pull**: the run reaches about 7 700 against a daily
  ceiling of 15 000, paced across roughly six hours. That is the cost this
  change is chiefly about, and the reason it is separate rather than shipped
  alongside — a six-hour ingest is a decision, not a detail.

## Open Questions

- **Whether the ally sample supports a shorter window.** The opponent pull
  needs twelve weeks to reach 244 games a pair; the ally pull is at 3 239 on
  the cell measured, so four weeks may already be deep enough and would cost
  1 200 requests rather than 3 600. What is not measured is the median ally
  cell — Phantom Lancer at position 1 is the busiest — so the window is
  written as twelve and the first step re-measures before committing to it.
- **Whether `+0.417` is too much overlap to be worth a component.** The
  opponent half's case rested on `+0.066`. This is a weaker claim of
  independence, and nothing here scores whether the component helps.
  `suggestion-calibration` is what answers it, and a fitted weight near zero
  is the honest outcome this change has to be willing to reach.

## How this proposal ships

`design.md` and `tasks.md` are **not** absent — they follow on
`spec/lane-synergy-model-plan`, which opens from `main` once this branch has
merged. The four artefacts together are over the diff budget's failing
threshold, and `docs/git-and-prs.md` fixes what happens then: the proposal
and the delta specs on `spec/<slug>`, the design and the tasks on
`spec/<slug>-plan`. The change directory is therefore incomplete on purpose
until the second branch lands. The `/zombies` pass has already run over this
change, and its 32 ideas are what that `tasks.md` derives its test tasks
from.

## Ordering

After `laning-phase-model`, which every delta here is written against, and
therefore after `candidacy-gate` too. Like it, this SHOULD NOT land between
`outcome-calibration` and `suggestion-calibration`.
