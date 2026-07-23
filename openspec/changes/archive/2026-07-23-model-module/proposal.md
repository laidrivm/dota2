# Model module — proposal

## Why

The pick assistant's entire value is a single client-side computation:
given a published snapshot bundle and the current draft session, produce
enemy-role probabilities, per-role suggestion scores, and (at full draft) a
win probability. Nothing downstream — the board UI, the pipeline contract —
can be built or trusted until this model exists as a pure, deterministic,
tested module. It is the first piece of product code in the repo.

## What Changes

- Import the shared type contract (`types.ts`) into the repo as source,
  with **all JSON keys renamed to camelCase** per the accepted decision
  (`snapshotId`, `createdAt`, `isMajor`, `myRole`, `teamPicks`,
  `enemyPicks`, …). **BREAKING** vs. the spec-inbox draft, but that draft
  never shipped.
- Import `fixture-snapshot.json` into the repo (camelCased) as the test
  fixture the model runs against; update `generate_fixture.py` to emit
  camelCase so a regenerated fixture stays conformant.
- Add the pure model module: one function `computeModel(bundle, session)
  → ModelOutput` implementing model-spec §1–§4 (enemy-role inference,
  pick-phase derivation, suggestion scores with lane-weighted matchups and
  counter-risk, full-draft win probability), reading every constant from
  `MODEL_CONSTANTS`.
- Add the six model-spec §7 acceptance tests against the fixture.

## Capabilities

### New Capabilities

- `draft-model`: the pure function mapping a snapshot bundle plus a draft
  session to the model output (enemy roles, suggestions, win estimate),
  and the determinism/insufficient-data invariants it must hold.

### Modified Capabilities
<!-- none: no existing specs -->

## Non-goals

- No UI, no rendering, no localStorage/session persistence — those are
  Phase 2. This module is a pure function of its two inputs.
- No STRATZ/pipeline work: the snapshot bundle is consumed as given; how
  it is built is Phase 4.
- No weight/β calibration — v1 uses the fixed constants in `MODEL_CONSTANTS`
  (calibration is v2, US-37/US-38).
- No caching or incrementality — full synchronous recompute per call, as
  model-spec §6 mandates.

## Impact

- New source under `src/`: the first product code (`src/types.ts`,
  `src/model.ts`) plus its test and fixture. No runtime dependencies added.
- Unblocks Task 9 (unit-test setup lands with these tests) and Phase 2
  (the board UI consumes `ModelOutput`).
- `spec-inbox/` drafts (`types.ts`, `fixture-snapshot.json`,
  `generate_fixture.py`) are superseded by their camelCased in-repo copies.
