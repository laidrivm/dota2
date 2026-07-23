# Model module — design

## Context

First product code in the repo. The model is fully specified in
`spec-inbox/model-spec.md` (§1–§7) against the type contract in
`spec-inbox/types.ts` and the sample data in
`spec-inbox/fixture-snapshot.json`. This change imports those three drafts
into `src/` (camelCased) and implements the one function the whole app is
built on. No endpoints exist yet, so the api-design response-shape rule does
not apply here — the module's contract is the `ModelOutput` TypeScript type,
not an HTTP response.

## Goals / Non-Goals

**Goals:**
- One pure function `computeModel(bundle, session): ModelOutput` faithful to
  model-spec §1–§4, all constants read from `MODEL_CONSTANTS`.
- The six §7 acceptance tests, green against the in-repo fixture.
- camelCase across the imported types, fixture, and generator.

**Non-Goals:**
- UI, persistence, pipeline, weight calibration, caching (see proposal
  Non-goals).

## Decisions

**camelCase on import, not a runtime mapper.** The spec-inbox drafts mix
snake_case (`snapshot_id`, `my_role`) with camelCase (already in the model
outputs). Rather than carry a translation layer, the imported `src/types.ts`
and `src/fixtures/snapshot.json` are edited to camelCase once, and
`generate_fixture.py` is updated to emit camelCase so regeneration stays
conformant. Alternative — a normalizer at load time — rejected: it is code
that exists only to paper over a naming choice we control on both ends.

**Single file, plain functions.** `src/model.ts` exports `computeModel` plus
small internal helpers (assignment enumeration, one component per §3 term).
No classes, no per-hero objects, no strategy interfaces — the model is one
deterministic pass. Enumeration of ≤120 role assignments and ~130 candidates
is "low millions of ops" (§6): computed inline, no memoization.

**Fixture as the test oracle.** The §7 tests derive expected orderings and
invariants from the fixture programmatically (e.g. §7.1 sorts by
`meta+side+phase` and asserts the model matches), not from hand-copied
magic numbers — so the tests survive fixture regeneration. Determinism
(§7.6) and antisymmetry (§7.3) are structural checks, not fixed values.

**Bun's test runner.** Tests are `bun test` (`src/model.test.ts`); this is
also Task 9's unit-test setup — no framework added, `bun:test` is native.

## Risks / Trade-offs

- **Floating-point equality in §7.6 determinism** → the invariant is
  "same input → same output", so exact `===` on serialized output is valid
  (same code path, same order of operations); no tolerance needed there.
  §7.3 antisymmetry crosses two different computations *and* the model's
  known-vs-inferred role asymmetry, so it holds only to ~1 decimal place
  (the authoritative threshold, `toBeCloseTo(…, 1)`), not floating-point
  error.
- **§7.2 fixture may not contain a clean troll/Razor case** → if the
  shipped fixture lacks heroes with the needed advantage structure, the
  test constructs the minimal draft that exercises counter-risk
  monotonicity rather than relying on named heroes; the assertion is on the
  monotonic direction, not a specific hero.
- **Spec ambiguity in `L̄(r)` normalization and the empty-`E` matchup term**
  → both are pinned in model-spec §3.1 (matchup component is 0 when
  `E = ∅`); implemented exactly as written, no interpretation.

## Migration Plan

Additive — no existing code. spec-inbox drafts remain (gitignored) as the
provenance record; the in-repo camelCase copies become the source of truth.

## Open Questions

- Pick-phase granularity vs. STRATZ (`phase` deltas) is a Phase 4 data
  question, not blocking: the current phase (`ModelOutput.phase`) is derived
  from my team's filled-pick count (§2); the bundle only supplies the
  per-phase `phase` deltas, consumed as given.
