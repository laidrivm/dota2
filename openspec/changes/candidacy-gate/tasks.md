# candidacy-gate — tasks

Three steps, three pull requests, in this order — `change-slicing` ships one
per task group and the last group is a group. Each names the criteria it
closes; the last closes none and says so.

The `draft-model` delta carries two criteria this change does not close —
`empty-draft-components-model-spec-7-1` and
`counter-risk-monotonic-in-bans-model-spec-7-2`. They are the requirement's
existing scenarios, copied whole because a `MODIFIED` delta replaces a
requirement rather than patching it, and tests on `main` already close them.

## 1. The gate

Closes `draft-model/a-role-the-hero-is-barely-played-in`,
`draft-model/a-role-at-exactly-the-threshold`.

- [ ] 1.1 Settle where the test data lives. The fixture's lowest share among
      `sufficient` positions is 3%, so no case below can be written against
      it as it stands: it needs positions either side of 0.005 and one
      exactly on it. Either extend `src/fixtures/snapshot.json` or build the
      bundle in `src/model.fixture.ts` — the fixture is also what the client
      is served, so extending it changes what a developer sees in the app.
- [ ] 1.2 Write the failing cases first (ZOMBIES 1, 2, 3, 4, 5): a role whose
      every candidate is below the threshold yields an empty entries array
      rather than a missing block; a position at 0.0035 is absent from that
      role while the same hero stays present at the role holding 99% of its
      games; exactly 0.005 is scored and 0.0049 is not; a share of exactly 0
      is still not scored, which the old `> 0` gave for free.
- [ ] 1.3 Add `minShare: 0.005` to `MODEL_CONSTANTS` and compare against it
      at `src/model.ts:249`. Read it from the constant rather than inlining
      the literal (ZOMBIES 6) — Stryker mutates this file alone, and an
      inlined number is mutated where a named constant is not.
- [ ] 1.4 Move the mutation floor. `openspec/specs/mutation-floor/` scopes
      Stryker to `src/model.ts`, so a new branch there changes the surviving
      count; the move belongs in this change rather than in whichever one
      next runs the tool.

## 2. Where the gate does not reach

Closes `draft-model/the-threshold-does-not-reach-enemy-role-inference`,
`draft-model/the-threshold-does-not-reach-counter-risk`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 7, 9): an enemy pick whose
      share at a role is below `minShare` keeps the marginal
      `inferEnemyRoles` gives that role; `candPop` sums a hero's popularity
      over every role its share covers, the threshold removing none.
- [ ] 2.2 Pin the interaction between the two thresholds (ZOMBIES 8).
      `inferEnemyRoles` floors a share at `C.epsilon = 0.01`, which is
      larger than `minShare = 0.005`, so a share between them is floored in
      the inference and refused in the candidate filter. `model.test.ts:88`
      covers a share of exactly 0 and not one between the two constants,
      which is where a reader would assume the wrong thing.
- [ ] 2.3 Widen `model-scoring.test.ts:107` (ZOMBIES 10). It asserts an
      insufficient hero never becomes a candidate, and that holds only
      because `h.sufficient` is evaluated before the share test: `share()`
      synthesises `1 / keys.length` for an insufficient hero, so a
      two-position one yields 0.5 and would pass `>= 0.005` outright. Assert
      that the sufficiency test still gates first, which a reordered
      conjunction would break and the current case would not report.
- [ ] 2.4 Re-run the two criteria this requirement already carried, neither
      of which is this change's to close.

## 3. Closing the change

Closes no acceptance criterion.

- [ ] 3.1 Reproduce the report (ZOMBIES 11): Clockwerk at 4, Lich at 5,
      Treant and Bane opposite, and check Phantom Lancer is gone from the
      offlane block. Record the block before and after in the pull request —
      it is the one observation a reader can check against the complaint.
- [ ] 3.2 Update `PLAN.md`'s queue in the pull request that merges the last
      step, not afterwards.
- [ ] 3.3 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
