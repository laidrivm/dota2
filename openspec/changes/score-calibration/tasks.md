# score-calibration — tasks

Two steps, two pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a step close no criterion only
when it carries infrastructure, and confirming the defect is gone, recording
the estimate's movement and updating `PLAN.md` are none of that — so they
ride with the step that merges last.

**This change SHOULD NOT be applied before `outcome-calibration` is.** The
proposal's *Ordering* section says why: it moves the win estimate by tens of
points and reorders every block, and without a figure scoring the model that
trade is unmeasurable.

The `snapshot-export` delta carries two criteria this change does not close —
`a-synergy-stored-once` and `a-matchup-s-mirror`. They are the requirement's
existing scenarios, copied whole because a `MODIFIED` delta replaces a
requirement rather than patching it. Both keep passing and both now assert
against centred values, which step 1 re-verifies.

## 1. The two centrings

Closes `snapshot-export/antisymmetry-survives-centring`,
`snapshot-export/symmetry-survives-centring`,
`snapshot-export/a-hero-s-strength-leaves-its-row`.

- [ ] 1.1 Write the failing cases first (ZOMBIES 3, 4, 7, 8, 9, 10, 13, 14,
      15): a two-hero matrix of each kind centres to values checkable by
      hand; three heroes give a synergy matrix whose row means are all one
      constant; an all-equal matrix centres to zeros; a hero paired with one
      other has that cell as its mean; a uniformly `+5` row carries the 5
      nowhere; antisymmetry and symmetry both survive; and **subtracting only
      the row mean from `matchups` fails a test of its own** — it is the
      tidier-looking form and the one a later reader will reach for.
- [ ] 1.2 Take synergy row means **after** mirroring (ZOMBIES 5, 6).
      `render.ts:124` builds synergies as `mirrored(matrix(...))` because the
      database stores each pair once; a mean over the unmirrored matrix
      averages about half a row and is wrong for every hero. The grand mean
      is over every cell of the mirrored matrix, not over the row means,
      which differ whenever rows do.
- [ ] 1.3 Centre `matchups` as `adv[a][b] − r_a + r_b` and `synergies` as
      `syn[a][b] − r_a − r_b + g`, in `render.ts` where both matrices are
      already assembled whole.
- [ ] 1.4 Re-verify `snapshot-export/a-synergy-stored-once` and
      `snapshot-export/a-matchup-s-mirror` against centred values (ZOMBIES
      18). `render-matrix.test.ts:56` asserts antisymmetry on values as
      stored; after centring it holds through different arithmetic, so it
      needs a case whose row means differ or it passes for the wrong reason.

## 2. What the export refuses, and what it leaves alone

Closes `snapshot-export/the-database-is-not-rewritten`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 1, 2, 11, 12, 16): an empty
      matrix centres to an empty matrix rather than dividing by zero; a hero
      with no row is refused rather than yielding `NaN`; every centred value
      is finite so `contract.ts`'s assertion publishes; the centred matrices
      carry exactly the keys they carried; and `hero_matchups` and
      `hero_synergies` hold the build's values after two exports.
- [ ] 2.2 Let the existing runtime assertion do the finiteness work. It
      already refuses `NaN`, `Infinity` and a wrong type; this step asserts
      centring never reaches it, rather than adding a second check.

- [ ] 2.3 Regenerate `src/fixtures/snapshot.json`. It is what the client is
      served until a run publishes, and `model.fixture.ts` exports it as
      `bundle` for all three model suites.
- [ ] 2.4 Re-read every model case written against a specific score or
      ordering (ZOMBIES 20). Which of them move is not knowable before the
      fixture is rebuilt, so this is a reading, not a list — and a case that
      moves is re-fitted with its new value, never deleted.
- [ ] 2.5 Confirm the reported defect is gone (ZOMBIES 19): the draft with
      Clockwerk at 4, Lich at 5, Treant and Bane opposite offers neither
      Phantom Lancer nor Bounty Hunter in the offlane block. Record the block
      before and after in the pull request.
- [ ] 2.6 Record the win estimate's movement on one full draft — measured at
      Δ −14.79 pp to +6.21, 18.6% to 65.0% — as a number in the pull request
      rather than a claim about it. Nothing here says which is right, and
      that is `outcome-calibration`'s.
- [ ] 2.7 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 2.8 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
