# score-calibration

## Why

The suggestion list is close to a ranking of heroes by their own strength,
counted twice.

Reported from use: Phantom Lancer offered third for offlane behind two heroes
it has no business being near. Reading the components said why. Every hero's
row in the synergy matrix carries a constant offset that is the hero's own
strength, and `meta` already carries that strength once:

```text
corr(a hero's mean synergy, its own weighted meta)   0.968
corr(a hero's mean matchup, its own weighted meta)   0.970
corr(mean synergy, mean matchup)                     0.996
```

93.6% of the variance in a hero's synergy row is explained by how good the
hero is. Measured on 2026-08-29 and again on 2026-08-30, agreeing to three
decimals.

The cause is the baseline. `blend.ts:120` fixes `NEUTRAL = 50`, so a pair's
stored value is that pair's winrate less 50 — not less what the two heroes
would have managed apart. A hero who wins 55% of everything reads as +5
synergy with everybody. `meta` then adds the same 5 again, once per ally.

What the draft board showed follows directly. The offlane block's top five
were, in near-exact order, the five offlane-eligible heroes with the highest
synergy offset — Bounty Hunter among them at a meta of −3.95 for that role.

## What Changes

- The exported matrices carry the interaction between two heroes rather than
  the interaction plus both heroes' strength.
- Nothing else. The model is untouched, the database keeps what it stored,
  and the operation is the export's.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `snapshot-export`: its *Pair statistics are expanded into full matrices*
  requirement fixes what the bundle's matrices hold, which is where the
  offset survives into the client.

## Non-goals

- **Averaging synergy over allies instead of summing it.** This was the
  second half of the plan and the measurement removed it. Summing makes a
  candidate's score grow through the draft — 13.44 at an empty board against
  35.95 with four allies — but centring alone takes that growth from 22.52 pp
  to 4.18, and what remains is interaction genuinely accumulating as allies
  are picked rather than an artefact. Averaging would flatten real signal. It
  also changes no ranking: every candidate in a block shares the same allies,
  so a sum and a mean differ by a constant and order identically.
- **Refitting the component weights.** They were set at 1.0 with
  `counterRisk` at 0.5 and never fitted. Centring changes the scales they
  weigh, so they want revisiting — with a figure to fit against, which is
  `outcome-calibration`'s.
- **`beta` and the win estimate.** Centring moves the estimate a long way: on
  one full draft, Δ from −14.79 pp to +6.21, so 18.6% becomes 65.0%. Which is
  closer to the truth is not knowable from inside the model, and `beta-refit`
  is where that is settled.
- **Recomputing what the database stores.** `hero_matchups` and
  `hero_synergies` keep their measured values. Centring is applied where the
  matrix is assembled, so a change of mind costs an export rather than a
  re-ingest.

## Impact

- `src/job/export/render.ts` — the two matrices gain one operation each,
  where they are already assembled whole from their rows.
- `src/types.ts` — the doc comments on `MatchupMatrix` and `SynergyMatrix`
  say what the numbers are, and that changes.
- `src/fixtures/snapshot.json` — regenerated, since the client is served it
  until a run publishes and the model's own suite reads it.
- `openspec/specs/mutation-floor/` — untouched: Stryker is scoped to
  `src/model.ts`, and no line of it changes.
- No new dependency, no schema change, no change to what the ingest pulls.

## Ordering

This change SHOULD NOT be applied before `outcome-calibration` is. It moves
the win estimate by tens of points and reorders every suggestion block;
applying it while nothing scores the model means trading one unmeasured
ranking for another and calling the second an improvement because its top
five look more sensible.
