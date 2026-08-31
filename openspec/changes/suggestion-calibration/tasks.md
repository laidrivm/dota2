# suggestion-calibration — tasks

Six steps, six pull requests, in this order. A step's `Closes` line cites the
criteria that step's tasks fulfil, and every criterion this change closes
appears in exactly one of them. A task inside a step that fulfils none says so
where it stands.

**`beta-refit`, `side-and-phase-deltas`, `laning-phase-model` and
`lane-synergy-model` must be applied and synced first.** The first creates the
fit this widens and the machinery it keeps; the second is what gives `side` a
column with variance, without which one weight cannot be fitted at all; the
last two each add a component this change fits and each replace the
`draft-model` requirement this one replaces after them.

The two `MODIFIED` deltas carry ten criteria this change does not close —
every scenario its predecessors leave behind whose assertion it does not
touch:
  `draft-model/empty-draft-components-model-spec-7-1`,
  `draft-model/counter-risk-monotonic-in-bans-model-spec-7-2`,
  `draft-model/a-candidate-with-no-lane-row-at-the-role-scored`,
  `draft-model/one-enemy-covered-and-one-not`,
  `draft-model/a-bundle-predating-the-lane-matrix`,
  `draft-model/the-lane-component-is-not-weighted-twice`,
  `draft-model/the-two-lane-components-read-opposite-halves-of-the-board`,
  `draft-model/allies-picked-but-none-in-the-row`,
  `draft-model/a-bundle-predating-the-ally-matrix`,
  `outcome-calibration/a-fit-over-the-whole-store`.
They are copied whole because a `MODIFIED` delta replaces a requirement rather
than patching it, and their predecessors' tests close them.

Two of `beta-refit`'s scenarios are **not** carried and are closed in step 2
instead: *Both parameters, never one* and *A sample the slope alone already
fits* keep their arithmetic and change what they assert it about — a
one-element vector where they said `β` — so the cases that assert `β` have to
be re-pointed, which is work rather than inheritance.

## 1. Each component as its own column

Closes `outcome-calibration/each-component-measured-none-derived`,
`outcome-calibration/a-component-with-no-variance`,
`draft-model/an-unfitted-weight-is-still-a-weight`.

The three are one story: the run computes a column, finds it has no variance,
records it unfitted with its hand-set weight — and the model then uses that
weight like any other, the distinction living on the row rather than in the
scoring.

- [ ] 1.1 Write the failing cases first (ZOMBIES 4, 6): a build deriving one
      column as `Δ` less the others produces a different coefficient for it
      than one computing it from its own definition — the case that separates
      the two implementations; `side` at 0 of 127 heroes is recorded unfitted
      where a store with one non-zero side delta fits it, the boundary being
      any variance rather than a threshold.
- [ ] 1.2 Emit the four columns from the model's own accessors rather than
      from `winEstimate`'s total. The enemy contribution is role-inferred
      inside `computeModel`, so a residual carries that inference into
      whichever column is computed last — which is how the proposal's own
      measurement had to read `matchups`, and why the requirement forbids it.
- [ ] 1.3 Distinguish a fitted zero from an unfittable column (ZOMBIES 8, 9).
      A coefficient the fit drove to 0 publishes as 0 and is recorded fitted;
      a column with no variance publishes its hand-set weight and is recorded
      unfitted. The two look identical in the published set and must not in
      the run's row.
- [ ] 1.4 Assert that the model reads an unfitted component's weight like any
      other (ZOMBIES 10). Nothing branches on it: a published set carries
      eight numbers and the model cannot tell which were fitted, which is the
      point — a scoring rule that behaved differently for an unfitted weight
      would need the run's row at scoring time.
- [ ] 1.5 Cover the two degenerate stores, closing no criterion beyond those
      above (ZOMBIES 1, 2): a store with no scorable match derives nothing and
      publishes, which `beta-refit`'s own empty case already fixes and this
      inherits rather than restates; every fittable column constant at once —
      a store of identical drafts — leaves the whole set unfitted rather than
      reaching the singular matrix 3.4 refuses, since a constant column is
      caught before the solver sees it.
- [ ] 1.6 Pin the fixture against the measured shape (ZOMBIES 13) by a
      conditioning measure, not by pairwise correlation: no column's variance
      inflation factor above 5, against the 1.125 the worst of them shows on
      1 469 real drafts. Pairwise `|r|` cannot see a column that is nearly the
      sum of two others while correlating weakly with each, and a fixture that
      drifts there makes the separability this change rests on untestable
      while every pairwise figure still looks fine.
- [ ] 1.7 Assert the dependency on `side-and-phase-deltas`, closing no
      criterion: until it lands `side` exercises only the unfitted path, so
      the fitted path for that column has no case until then and this step
      says which of its assertions are dark.

## 2. The likelihood, widened

Closes `outcome-calibration/both-parameters-never-one`,
`outcome-calibration/a-sample-the-slope-alone-already-fits`.

Both are `beta-refit`'s arithmetic restated over a one-element vector. The
numbers are unchanged and the symbol is not, so the cases asserting `β` are
re-pointed rather than rewritten from scratch.

- [ ] 2.1 Re-point both cases at `w` (ZOMBIES 3), taking each sample from the
      requirement rather than from memory: ten matches at `Δ = ∓1` with five
      and eight wins return `α = 0.6931` and a one-element `w` of `0.6931`;
      **ten** at `Δ = −1` with three wins beside **twenty** at `+1` with
      fourteen return `α = 0` and `w` of `0.8473`, the two log-likelihoods
      equal at `−18.3259`. The five-and-ten sample that reads `w = ln 4` is
      the one `beta-refit` replaced, for putting a coefficient outside the
      bound its own refusal fixes.
- [ ] 2.2 Fit `α` and the vector in one likelihood, never in two passes
      (ZOMBIES 5). Fitting `α` first puts whatever the intercept should carry
      into whichever coefficient is fitted next; a case where adding one match
      moves every coefficient rather than only the one whose column moved is
      what shows the fit is joint.
- [ ] 2.3 Publish no `beta` column and no alias for it. The row carries `α`
      and the vector; where one component is fitted the vector has one
      element, and a schema keeping `beta` beside it would be two names for
      one number and a question about which the model reads.
- [ ] 2.4 Reuse `beta-refit`'s solver rather than writing a second: the step
      control, the convergence definition and the `[5, 400]`-style bounds are
      all its, and a second implementation is a second thing to keep true.
      Closes no criterion — it is a constraint on how 2.1 and 2.2 are met.

## 3. Refusing a set

Closes
`outcome-calibration/better-than-the-base-rate-and-worse-than-what-ships`,
`outcome-calibration/an-unfitted-component-in-a-published-set`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 25, 26, 27, 28, 29): a set
      whose held-out Brier equals the hand-set weights' refuses, the condition
      saying *beat*; a set beating the base rate and losing to the hand-set
      weights refuses, which the base-rate floor alone would have published; a
      refusal leaves the previous set standing and substitutes nothing; a
      refusal with none published leaves the bundle omitting the set; the row
      names which condition refused.
- [ ] 3.2 Score the hand-set weights on the same partition and from the same
      replay as the fitted set (ZOMBIES 30). Two figures from two samples is
      not a comparison, and this is the condition the whole gate turns on.
- [ ] 3.3 Bound every coefficient to `[0, 5]` and write the boundary cases
      (ZOMBIES 7): exactly 0 and exactly 5 publish, 5.01 refuses. A negative
      coefficient refuses too, and the design says why — a component the model
      sums is one it believes helps, so a fitted negative is a finding about
      the component rather than a weight to ship.
- [ ] 3.4 Refuse an **ill-conditioned** design, not merely a singular one
      (ZOMBIES 11): any column's VIF at or above 5 refuses, where exact
      singularity is the limiting case the solver would have caught anyway.
      Measured on real drafts the worst VIF is 1.125 and `κ` is 2.00, so the
      threshold sits far above what the data does and fires on a store that
      has genuinely lost a dimension. Refuse naming the weight fit rather
      than "the calibration" (ZOMBIES 12) — two fits now run and a row saying
      neither is a row nobody can act on.

## 4. Replaying a draft pick by pick

Closes `outcome-calibration/a-component-with-open-slots-to-be-defined-over`,
`outcome-calibration/the-replay-uses-the-current-bundle`,
`outcome-calibration/one-outcome-ten-picks`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 14, 15, 16, 18, 19, 21, 22):
      a match with no recorded pick order is unscorable for the replay and
      still scorable for the full-draft fit; the first pick of a side gives no
      ally of that side and five open enemy slots; ten picks yield ten rows
      carrying one outcome; `counterRisk` is non-zero at the third pick and 0
      at the tenth; `phase` matches `pickPhase` of the count at that moment
      rather than of the finished draft; a hero the current bundle lacks makes
      the match unscorable rather than replayed short.
- [ ] 4.2 Build each session as it stood **before** the pick, never after.
      A component defined over open slots needs open slots, and a session
      built after the pick has one fewer of them — which is the difference
      between measuring the advice and measuring the board it produced.
- [ ] 4.3 Score against the bundle the run holds, never the one in force when
      the match was played (ZOMBIES 23). The second is a different question —
      how good the advice was at the time — and no stored bundle answers it.
- [ ] 4.4 Record how many picks each outcome was attributed to, so a
      coefficient's precision is readable rather than implied.
- [ ] 4.5 Reproduce `counterRisk` falling monotonically as enemy slots fill
      (ZOMBIES 24), which `draft-model` already fixes and the replay must not
      break by rebuilding the session differently from the model.

## 5. The partition the replay is scored on

Closes `outcome-calibration/one-match-s-picks-share-a-fold`.

Its own step because it is the difference between a Brier that means
something and one that flatters: ten rows from one match, split row by row,
put the same outcome on both sides of the held-out set and the fit is scored
on what it trained on ten times.

- [ ] 5.1 Write the failing case first (ZOMBIES 17, 20): a match's ten picks
      all fall in one fold, and no coefficient was fitted on a row whose match
      also appears held out; the picks of one side are attributed to that
      side's outcome and the other's to its complement.
- [ ] 5.2 Take the fold from `match_id mod 5`, which `beta-refit` already
      fixes and which is already match-level — the row inherits its match's
      value rather than computing one of its own.
- [ ] 5.3 Assert the leak fails the case, not merely that the fix passes it:
      a partition drawn per row must make 5.1 fail, or the case is checking
      nothing.

## 6. The set in the bundle and the model

Closes `draft-model/the-bundle-s-weights-are-the-ones-used`,
`draft-model/a-bundle-carrying-no-weights`,
`draft-model/a-bundle-carrying-some-weights`.

- [ ] 6.1 Write the failing cases first (ZOMBIES 31, 32, 33, 34, 35, 36, 37):
      a bundle with no `weights` scores from `MODEL_CONSTANTS.weights` and
      yields no `NaN`; a published set reaches `bundle.weights` with all eight
      keys; seven of eight is refused as malformed rather than completed; a
      ninth key the model does not know is refused; `checkBundle` accepts a
      bundle with the key and one without; a `NaN` or `Infinity` weight fails
      the export; two bundles alike but for `weights.meta` order one block
      differently.
- [ ] 6.2 Read every component's weight from the resolved set, `laneSynergy`
      included. The requirement `lane-synergy-model` leaves behind names
      `MODEL_CONSTANTS.weights.laneSynergy` directly, two paragraphs from the
      sentence saying the bundle overrides — a published bundle would have
      been ignored for exactly that one component.
- [ ] 6.3 Register `weights` in **`BUNDLE`, in `CHECKED_ABOVE`, and as
      optional** — three edits, not one (ZOMBIES 35). `contract.ts:104-132`
      sends every root outside `CHECKED_ABOVE` through the hero-keyed
      validator, so `weights` holding `meta` and `counterRisk` would be
      refused for keys that are not decimal integer strings, and a valid
      bundle would fail to publish. The optional-key concept is `beta-refit`'s
      and is reused rather than rebuilt; the two list entries are what
      `calibration` needed too and what an "add an optional key" reading
      misses.
- [ ] 6.4 Assert the eight leaves are finite and that there are exactly eight
      (ZOMBIES 36), which the matrix validator would have done for a matrix
      and does not do for a flat record.
- [ ] 6.5 Re-verify the nine carried `draft-model` scenarios rather than
      assuming them — *Empty draft components* now runs with weights that may
      not be 1.0, so a case asserting a component is exactly 0 has to be 0
      because the sum is empty rather than because the weight was one.
- [ ] 6.6 Re-run Stryker (ZOMBIES 38). Its floor is scoped to `src/model.ts`,
      which `laning-phase-model` splits; this adds to whatever that left.
- [ ] 6.7 Record the suggestion block before and after on one real draft, and
      the fitted set beside the hand-set one. Closes no criterion.
- [ ] 6.8 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards. Closes no criterion.
- [ ] 6.9 Run the pre-PR sequence per `docs/review-toolkit.md` on every step,
      and `bun test` and `bun run test:db` besides. Closes no criterion.
      Steps 1 to 5 touch the database, and CI runs only `bun test`
      (`.github/workflows/test.yml:110`).
