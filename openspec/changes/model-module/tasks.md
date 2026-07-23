## 1. Import the contract into the repo (camelCase)

- [x] 1.1 Add `src/types.ts` from the spec-inbox draft with all JSON keys
      renamed to camelCase (`snapshotId`, `createdAt`, `isMajor`,
      `detectedAt`, `myRole`, `teamPicks`, `enemyPicks`); keep the model
      output/`MODEL_CONSTANTS` types as-is. (Impact: proposal — camelCase
      import)
- [x] 1.2 Add `src/fixtures/snapshot.json` = the spec-inbox fixture with the
      same keys camelCased; `tsc` accepts it as a `SnapshotBundle`. (Impact:
      proposal — fixture import)
- [x] 1.3 Update `generate_fixture.py` to emit camelCase and keep it beside
      the fixture as provenance. (Impact: proposal — generator stays
      conformant)

## 2. Implement computeModel (model-spec §1–§4)

- [x] 2.1 `computeModel(bundle, session): ModelOutput` skeleton reading all
      constants from `MODEL_CONSTANTS`; pure, no mutation of inputs. (Req:
      Pure deterministic computation)
- [x] 2.2 Pick-phase derivation from team-pick count. (Req: Pick phase
      derivation)
- [x] 2.3 Enemy-role inference: enumerate injective assignments, ε-floored
      product weight, normalize, marginals + `open(r)`. (Req: Enemy role
      inference)
- [x] 2.4 Suggestion scoring: candidate filter, six weighted components
      incl. lane-weighted matchups (`L`, `L̄`) and counter-risk, top-N per
      open role, my-role block first, per-component breakdown. (Req:
      Suggestion scoring)
- [x] 2.5 Win probability at full 5v5: advantage Δ (§4) and logistic;
      `null` otherwise. (Req: Win probability at full draft)
- [x] 2.6 Insufficient-data handling threaded through 2.3–2.5: zero deltas,
      uniform share, excluded from candidates, neutral if picked. (Req:
      Insufficient-data handling)

## 3. Acceptance & ZOMBIES tests (`src/model.test.ts`, bun:test)

- [x] 3.1 §7.1 empty-draft: matchup & synergy components are exactly 0.
      (Req: Suggestion scoring / Empty draft components)
- [x] 3.2 §7.2 counter-risk monotonic in bans. (Req: Suggestion scoring /
      Counter-risk monotonic in bans)
- [x] 3.3 §7.3 antisymmetry: mirror draft (side off) → 1−winProb to ~1 dp.
      (Req: Win probability / Antisymmetry)
- [x] 3.4 §7.4 enemy-marginal redistribution when a second enemy is added.
      (Req: Enemy role inference / Marginal redistribution)
- [x] 3.5 §7.5 insufficient hero: absent from blocks/counter-risk, neutral
      if picked. (Req: Insufficient-data handling)
- [x] 3.6 §7.6 add-then-remove determinism: byte-identical output. (Req:
      Pure deterministic computation / Editing invariant)
- [x] 3.7 Zero/One/Boundary edges from /zombies: empty session output shape;
      phase transitions k=1→p1,2→p2,3→p2,4→last; full-draft trigger fires
      only at 5+5 (5+4 and 4+5 → null); ε floor gives nonzero marginal to a
      0-share role; block truncates to exactly 5. (Reqs: Pick phase
      derivation; Enemy role inference; Win probability; Suggestion scoring)
- [x] 3.8 Interface/Exception edges from /zombies: `winEstimate` key present
      and `null` when incomplete; `components` sum equals `score`; all five
      `probs` keys present; unknown HeroId and `E=∅` never leak NaN
      (incl. `L̄` 0/0 guard); `myRole` null → no block flagged `isMyRole`.
      (Reqs: Suggestion scoring; Win probability; Enemy role inference)

## 4. Gates

- [x] 4.1 `bun test` green; `tsc --noEmit` clean; `biome check` clean.
- [x] 4.2 `/zombies` in diff mode over the branch; `/triage` suggested to
      the user before the PR is opened.
