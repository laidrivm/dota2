# lane-synergy-model — design

## Context

`laning-phase-model` opens the endpoint, the table shape, the centring, the
derived constant, the third-level contract check and the seventh component.
This change flips one flag and reuses every one of them. What is worth
designing is only where the second statistic is not the first.

`/snapshot.json` gains a second root of the shape the first established:

```text
laneAllies: Record<heroId, Record<position, Record<heroId, number>>>
```

## Goals / Non-Goals

**Goals:** the ally statistic pulled, stored and centred under the rules
already written, exported as a fourth matrix, and summed as an eighth
component over the allies already picked.

**Non-Goals:** as the proposal fixes them — no merge with the opponent
statistic, no replacement of `synergies`, no weight fit, no second derivation
rule.

## Decisions

### The two directions agree closely, and are still stored separately

Measured over three ally pairs at 4 800 games or more a side:

```text
ally @ its position    syn(a,b)   syn(b,a)     diff
Lion at 5                −10.08      −9.73    −0.35
Lich at 5                 +0.74      +0.79    −0.05
Undying at 5             +16.84     +16.62    +0.22
```

Five times closer than an opponent pair, whose two readings sum to between
0.72 and 1.50 rather than to 0. The reason is what the statistic is: two
allies see the **same** event — their lane won or it did not — where two
opponents see complementary ones, so an ally pair's disagreement is only
which games each pull's position filter admitted.

Close is not an invariant. 0.35 pp is a real disagreement, and asserting
equality would fail on it exactly as the opponent half's antisymmetry
criterion would have. Both directions are stored, and the model reads a
candidate's own row anyway.

### A constant per statistic, derived over its own rows

The rule is `laning-phase-model`'s, unchanged. What this change adds is that
there are now two, and that neither may be derived over the other's rows.

```text
opponents   11 to 37 across three cells
allies      29 on the cell measured
```

They land close, and that is a fact about this patch rather than a licence to
share one. The two statistics have different sample depths — 3 239 games a
pair against 244 at the median opponent cell — so their noise terms differ
even where their signals do not, and a shared constant would shrink one of
them wrongly the first time a patch moved them apart.

Draws are 28.9% of ally lane games, close to the opponents' 24–26%, so the
correction `laning-phase-model` had to make applies here at the same
magnitude: the Bernoulli variance reads this constant as 44 where it is 29.

### The ally pull runs second, and a short run leaves one statistic whole

Together the two pulls are 7 200 requests against a run's existing ~516 —
about six hours, where the opponent half alone was three. The daily ceiling
of 15 000 still holds it, but the margin for a run that starts part-used is
thinner, so what a truncated run leaves behind is now a decision rather than
an accident.

Issued in sequence, a run cut short leaves the opponent statistic complete
and the ally one as staging had it. Interleaved, it would leave both half
covered, and *An unmeasured component is zero for every hero* would fail the
build on the half that is partial rather than publishing the half that is
whole.

The export follows: `laneAllies` empty beside a populated `lanes` publishes.
A bundle serving one lane statistic is better than yesterday's bundle serving
neither.

### The two components read opposite halves of the board

`lane` sums over the entered enemies and `laneSynergy` over the allies
already picked. They cannot double-count: `taken` excludes a hero that is
already on the board from being both, so the two sums are over disjoint sets
by construction rather than by a guard.

Neither is weighted through `laneWeights`, for the reason
`laning-phase-model` records: the statistic was counted from who actually
stood together, so weighting it by a hand-set guess at the same thing applies
the correction twice.

## Risks / Trade-offs

- **Six hours of pacing on a nightly job.** → The schedule's lock already
  refuses an overlap, and the export runs last so a slow ingest delays the
  bundle rather than unpublishing one. What it does remove is the room to add
  a third pull without revisiting the whole shape.
- **`+0.417` against the same pair's match outcome.** The opponent half's
  case rested on `+0.066`; this is a weaker claim of independence. → The
  proposal says so rather than burying it, and `suggestion-calibration` is
  what answers it. A fitted weight near zero is an outcome this change has to
  be willing to reach.
- **Eight components, none of them fitted.** → Each one added before the fit
  makes the fit harder to attribute; this is the last one proposed, and the
  proposal's *Ordering* keeps it out of the window between
  `outcome-calibration` and `suggestion-calibration`.
- **The ally measurement is one cell.** 84 pairs at position 1 of the busiest
  carry. → Which is why the window stays at twelve weeks rather than being
  cut to four on this evidence, and why the first step re-measures before
  anything is decided on it.

## Open Questions

- Whether the ally window can be four weeks rather than twelve. At 3 239
  games a pair on the cell measured it plainly could; at the median ally cell
  nothing has measured it, and four weeks would cost 1 200 requests rather
  than 3 600 — an hour off the run. Step 1 measures the median cell before
  the window is decided, and the twelve weeks stands until it does.
