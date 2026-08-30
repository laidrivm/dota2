# beta-refit — tasks

Six steps, six pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a step close no criterion only when
it carries infrastructure, and updating `PLAN.md` and running the review
sequence are none of that — so 6.6 and 6.7 cite no criterion and ride with the
step that merges last.

**`outcome-calibration`, `score-calibration` and `side-and-phase-deltas` must
be applied first.** The first supplies the scorer and the per-run row this
change writes two columns to. The other two move `Δ`, and by enough to change
the fitted `β` eightfold — the proposal's *Ordering* carries the measurement.

The two `MODIFIED` deltas carry seven criteria this change does not close —
every scenario the two requirements already had:
  `draft-model/incomplete-draft`,
  `draft-model/antisymmetry-model-spec-7-3`,
  `snapshot-export/the-client-s-own-check`,
  `snapshot-export/a-hero-entry-missing-a-field-the-client-never-checks`,
  `snapshot-export/a-component-rendered-as-zeros-throughout`,
  `snapshot-export/a-field-of-the-wrong-type`,
  `snapshot-export/a-number-that-is-not-finite`.
They are copied whole because a `MODIFIED` delta replaces a requirement rather
than patching it, and tests on `main` close them. One of them stops being
guarded by a case that could fail on it and is rewritten in step 1:
`antisymmetry-model-spec-7-3` is asserted with the side **off**, where the
intercept vanishes, so it is blind to the flat-versus-signed error the
requirement now turns on.

## 1. The logistic gains an intercept, signed by the side

Closes `draft-model/the-side-carries-the-intercept-s-sign`,
`draft-model/no-side-entered`,
`draft-model/a-bundle-carrying-no-calibration`.

- [ ] 1.1 Write the failing cases first (ZOMBIES 1, 4, 5, 6, 12): `side: null`
      at `Δ = 0` gives exactly 0.5; the same full draft reads higher on
      `"radiant"` than on `"dire"`; a `Δ` of ±200 — the range the live bundle
      produces — stays strictly inside `(0, 1)` where `β = 0.1` saturates to
      the endpoints in double precision; `β = 0` leaves `σ(α·s)` alone; a
      bundle with no `calibration` scores from `MODEL_CONSTANTS` and returns
      neither `null` nor `NaN`.
- [ ] 1.2 Rewrite `model-estimate.test.ts:45`, do not extend it (ZOMBIES 3).
      It recomputes its own expectation as `1/(1+exp(-0.1 * advantage))`, so
      it would keep passing against a bundle-supplied slope by rederiving the
      constant it is meant to be checking.
- [ ] 1.3 Rewrite `model-estimate.test.ts:55`, the antisymmetry case, to
      assert the mirror with the side **on** as well as off (ZOMBIES 14). Its
      comment disables the side deliberately, and at `s = 0` the intercept
      vanishes — so the case passes whether `α` is signed or flat, which is
      the one error the signing exists to prevent. Keep the side-off
      assertion: it still isolates the role-inference residual.
- [ ] 1.4 Add `calibration?: { alpha: number; beta: number }` to
      `SnapshotBundle` in `src/types.ts`, and `alpha` to `MODEL_CONSTANTS`.
      Nothing renders the field yet; step 2 does. It is declared here because
      the model reads it here, and a type the reader cannot name is a cast.
- [ ] 1.5 Change `MODEL_CONSTANTS.beta` from `0.1` to the fitted value and set
      `alpha` beside it — `0.0153` and `0.0910`, the maximum-likelihood pair
      over 1 446 matches scored against a centred bundle. Both from that one
      fit: the `α` of about 0.097 elsewhere in these artefacts is the
      bootstrap **median**, a different estimator, and taking one constant
      from each would pair two numbers no single fit produced. Not a
      cosmetic accompaniment to the mechanism: until step 2 lands the
      constants are the *only* values in use, so a step
      that leaves `beta` at `0.1` ships the mechanism and none of the fix.
      Zero is the wrong `alpha` for the same reason — the model's `α = 0` is
      the defect, and a fallback reproducing it is a fallback to the bug.
- [ ] 1.6 Record the estimate on one full draft before and after (ZOMBIES 7):
      `winEstimate.advantage` is unchanged, `winProbability` moves. `Δ` stays
      raw percentage points, so `draft-board`'s `Draft advantage: +3.2 pp →
      ~58% win` keeps its first half exactly and needs no delta spec.
- [ ] 1.7 Re-run Stryker. `openspec/specs/mutation-floor/` scopes it to
      `src/model.ts` alone and this step edits lines in it; the floor applies
      unchanged rather than being renegotiated here.

## 2. The bundle carries the pair, and the contract admits one optional key

Closes `snapshot-export/a-calibration-pair-exists`,
`snapshot-export/no-calibration-run-has-published-a-pair`,
`draft-model/the-bundle-s-slope-is-the-one-used`.

No run publishes a pair until step 4, so what ships here is the omission path
working in production and the presence path proved against a fixture row.
That is the useful half: it is the path every bundle takes until then.

- [ ] 2.1 Write the failing cases first (ZOMBIES 13, 15, 16, 17, 20, 21, 22):
      two bundles alike but for `calibration.beta` score one draft
      differently; no published pair omits the key and publishes; a published
      pair renders both fields; `checkBundle` accepts a bundle with the key
      and one without; the regenerated fixture passes whichever branch it
      takes; a `beta` of `Infinity` fails the export; a `calibration` of `{}`
      fails rather than publishing half a pair.
- [ ] 2.2 Give `src/job/export/contract.ts` an optional-key concept — the
      first and only key in the contract with one — and read `contract.ts:152`
      before writing it: `named()` refuses every declared key that is
      **missing**, which is the single thing an optional key must survive.
- [ ] 2.3 Add `calibration` to **both** `BUNDLE` and `CHECKED_ABOVE`
      (ZOMBIES 18, 19). Neither is optional: `named("", bundle, BUNDLE)` walks
      the bundle's own keys and refuses one it does not declare, and the final
      loop treats every root outside `CHECKED_ABOVE` as a matrix keyed by hero
      id, so the object reaches `ids()` and is refused for holding `alpha`
      rather than a decimal integer string. `contract.ts:118-121` names that
      exact failure as why the list is written as an exemption — this is the
      change that exercises it.
- [ ] 2.4 Render the field in `src/job/export/render.ts` from the newest run
      that published a pair, and **omit the key entirely** when none has.
      Rendering `MODEL_CONSTANTS` under the name would make a bundle that was
      never fitted indistinguishable downstream from one that was, and the
      model's fallback is triggered by the absence rather than by a sentinel.
- [ ] 2.5 Regenerate `src/fixtures/snapshot.json`. Choose which branch it
      carries and say so in the pull request: a fixture with the key exercises
      the presence path in every suite that reads it, and a fixture without it
      exercises the fallback. Whichever is chosen, the other needs a case, so
      2.1 covers both.

## 3. Both parameters, fitted over the store

Closes `outcome-calibration/a-fit-over-the-whole-store`,
`outcome-calibration/both-parameters-never-one`,
`outcome-calibration/a-sample-the-slope-alone-already-fits`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 24, 25, 26): ten matches at
      `Δ = −1` with five Radiant wins beside ten at `Δ = +1` with eight
      recover `α = 0.6931`, `β = 0.6931`, against `−12.9489` for the best fit
      holding `α` at 0; ten at `Δ = −1` with three wins beside twenty at
      `Δ = +1` with fourteen recover `α = 0` and `β = 0.8473`; a store
      holding 2 000 old
      scorable matches and 50 the run added fits over 2 050, never over 50;
      the count is recorded on the run's row.
- [ ] 3.2 Assert the pair is the maximum-likelihood one, never that `α` is
      non-zero. Both samples in 3.1 are correct fits and the second has
      `α = 0` exactly — its group rates 3/10 and 14/20 are symmetric about
      one half, so the slope alone reproduces them — and a criterion
      demanding a non-zero `α`, or a strictly better likelihood, rejects a
      valid fit. The first sample is the one that could produce the opposite
      outcome, which is why both are here.
- [ ] 3.3 Assert what the fit returns, never what the run publishes. Neither
      sample in 3.1 reaches the 2 000-match floor, so a case asserting that
      either is published contradicts *A fit that cannot be trusted is
      refused, not published* — the two requirements answer different
      questions and a case must not straddle them.
- [ ] 3.4 Add `alpha`, `beta` and the count to the per-run table
      `outcome-calibration` creates in `src/job/schema.sql`, and to its
      reclaim in `src/job/db.fixture.ts`. Read the table as that change left
      it rather than as this file describes it.
- [ ] 3.5 Fit by maximum likelihood with step control, never a bare
      Newton–Raphson. The unguarded version returned `β = 3543.7` and
      `α = −1961.0` on the very matches this change measured, and it
      terminated rather than erroring — step 4 is what refuses that output,
      but a solver that produces it routinely will refuse routinely.
- [ ] 3.6 Take the perspective from *A stored draft is scored as a
      Radiant-perspective session* rather than restating it. `Δ` and
      `didRadiantWin` come from one side throughout, which is what makes the
      fitted `α` the Radiant advantage rather than a quantity that changes
      meaning halfway through the store.
- [ ] 3.7 Assert the dependency on `score-calibration`, closing no criterion:
      the fit runs against a centred bundle, and `β` differs eightfold
      otherwise (0.0153 against 0.0019). The assertion is the seam between the
      two changes rather than a check this one applies.

## 4. Two refusals the fit itself declares

Closes `outcome-calibration/a-sample-below-the-floor`,
`outcome-calibration/a-fit-that-diverges`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 23, 27, 28, 29, 30, 31): a
      run that scores nothing refuses and names the floor; 1 999 refuses and
      2 000 clears the floor; `β` of exactly 0 and exactly 1 both clear the
      convergence condition, the interval being closed; a separable sample is
      recorded as a failed fit rather than publishing the number the solver
      reached; a non-finite `α` publishes nothing; `β = −0.01` publishes
      nothing.
- [ ] 4.2 Assert each condition's own verdict, never publication, wherever
      the other two are not also satisfied. A `β` of exactly 0 clears this
      step's interval and then fails the held-out gate — it predicts the base
      rate for every draft, so its Brier equals the floor rather than falling
      strictly below it. A case asserting that `β = 0` *publishes* would be
      asserting the opposite of step 5's criterion.
- [ ] 4.3 Record which condition failed, not merely that one did (ZOMBIES
      37). A row saying "refused" cannot tell a thin store on a quiet night
      from a solver that came apart.

## 5. The held-out gate, and the partition it is decided on

Closes `outcome-calibration/a-fit-no-better-than-the-base-rate`,
`outcome-calibration/the-same-store-decides-the-same-way-twice`.

Its own step rather than a third bullet in step 4: the other two conditions
read a number the fit already produced, and this one builds the
cross-validation that produces a second number. It is also the condition
`β = 0.1` fails, so it is the one carrying the change's argument.

- [ ] 5.1 Write the failing cases first (ZOMBIES 32, 33, 36): a held-out
      Brier *equal* to the base rate's refuses, the criterion saying below
      rather than at most; `β = 0.1` on the live bundle's `Δ` distribution
      fails at 0.4158 against 0.2497, so the guard is exercised against the
      defect the change exists to remove rather than a case invented for it;
      a fold's test rows are absent from its train rows.
- [ ] 5.2 Partition on `match_id mod 5` and pool the held-out predictions
      into one Brier, never a mean of five per-fold Briers — an uneven last
      fold would otherwise weigh as much as a full one. Compute the baseline
      over the same pooled set, so the two compared numbers come from one
      population.
- [ ] 5.3 Assert determinism directly: the gate run twice over an unchanged
      store reaches the same decision and the same Brier. This is a publish
      gate, so a partition that varies means one store publishes or refuses
      by a choice nothing records.

## 6. What a refusal leaves standing

Closes `outcome-calibration/the-first-run-with-nothing-published-before`,
`outcome-calibration/a-refusal-does-not-undo-a-published-pair`.

- [ ] 6.1 Write the failing cases first (ZOMBIES 34, 35): a refusal after an
      earlier success leaves the published pair unchanged and does not
      substitute `MODEL_CONSTANTS`; a refusal with nothing ever published
      leaves the export omitting `calibration`, which is the only case in
      which those constants are what a client uses.
- [ ] 6.2 Keep the two refusal outcomes distinct in the reading, not only in
      the writing: "no pair has ever been published" and "this run's fit was
      refused" are different states, and a query that answers the second when
      asked the first would silently unpublish a good pair on one bad night.
- [ ] 6.3 Widen the model's own coverage for the bundle-carrying-calibration
      case (ZOMBIES 9, 10, 11): `calibration` present with `alpha` missing
      falls back whole rather than applying a fitted `β` beside an `undefined`
      that arithmetic turns into `NaN`; a `beta` of `NaN` leaks none into
      `winProbability`; `model-estimate.test.ts:126`'s no-NaN guard predates
      the field and is extended to a bundle that carries it.
- [ ] 6.4 Add a case for `calibration.alpha = 0` reproducing the pre-change
      estimate at the same `β` (ZOMBIES 2), so the intercept's absence is a
      value the model handles rather than a code path it skips.
- [ ] 6.5 Record the held-out figures the first real run produces against the
      ones this change measured — 0.2471 Brier and 54.43% accuracy on 1 446
      matches — and say plainly in the pull request if they disagree. The
      measurement was one bracket, one region and one fortnight; the store is
      the same population but larger, and a first run that lands far from
      these is evidence about the sample rather than about the code.
- [ ] 6.6 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 6.7 Run the pre-PR sequence per `docs/review-toolkit.md` on every step,
      and `bun test` and `bun run test:db` besides. Steps 3 to 6 touch the
      database, and CI runs only the first
      (`.github/workflows/test.yml:110`).
