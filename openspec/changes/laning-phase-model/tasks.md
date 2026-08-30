# laning-phase-model — tasks

Ten steps, ten pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a *step* close no criterion only
when it carries infrastructure, and every step here closes at least one.

Several individual tasks close none, and each says so where it stands rather
than here — 1.5 guards an assumption about the endpoint, 2.3, 5.4, 10.4 and
10.5 record a measurement in the pull request, 3.3 and 7.3 refuse a shape,
and 10.3 re-runs a floor another capability owns. Updating `PLAN.md` and
running the review sequence are the last two, and they ride with the step
that merges last.

**`candidacy-gate` must be applied and synced first.** The `draft-model`
delta replaces the requirement that change also replaces and is copied from
the version it leaves behind; out of order the sync keeps one edit and drops
the other with nothing saying which.

The one `MODIFIED` delta carries two criteria this change does not close —
both scenarios `draft-model` §*Suggestion scoring* already had:
  `draft-model/empty-draft-components-model-spec-7-1`,
  `draft-model/counter-risk-monotonic-in-bans-model-spec-7-2`.
They are copied whole because a `MODIFIED` delta replaces a requirement
rather than patching it, and tests on `main` close them. One changes meaning
rather than staying still: *Empty draft components* now names `lane` among
the components that are 0 with no enemies entered, so step 9 re-verifies it
rather than assuming it.

`snapshot-build` §*Stored pair statistics carry their symmetry* was modified
by an earlier draft of this change and is not any more; that delta's own
preamble says why.

## 1. The pull, one request per cell

Closes `snapshot-ingest/one-request-per-cell-not-per-hero`,
`snapshot-ingest/a-position-below-the-share-floor`,
`snapshot-ingest/a-window-longer-than-the-hourly-ceiling-admits`.

- [ ] 1.1 Write the failing cases first (ZOMBIES 1, 4, 6, 11): a hero whose
      every share is below 5% issues no request; a hero above the floor at
      two positions issues two requests a week and never one naming both; a
      share of exactly 5% is pulled and 4.99% is not; each request carries
      exactly one position.
- [ ] 1.2 Build the request beside `pairs.ts`'s rather than inside it. The
      two share a week axis and nothing else: this one takes a position, asks
      only `isWith: false`, and answers rows of a different shape.
- [ ] 1.3 Anchor the week the way `pairs.ts:82-91` already does — a Unix
      timestamp in **seconds**, from the **middle** of the bucket (ZOMBIES 9,
      10). Both halves are load-bearing and both were measured: a bucket id
      returns nothing where a timestamp inside the week returns rows —
      `week: 2956` gave zero rows against 126 — and the buckets turn on an
      hour nobody here knows.
- [ ] 1.4 Pace through the existing quota reader, adding nothing to it
      (ZOMBIES 13, 14). The hourly window turning mid-pull is a wait and not
      a failure, and the daily one is the only failure — both already
      specified, so this step proves the new pull routes through them rather
      than restating them.
- [ ] 1.5 Refuse a response whose rows name a position other than the one
      requested (ZOMBIES 12), closing no criterion: it guards against the
      endpoint's filter meaning something other than what 1.1 pins, which is
      an assumption rather than a behaviour this change owns.

## 2. The window, and what bounds it

Closes `snapshot-ingest/a-major-patch-younger-than-the-window`,
`snapshot-ingest/a-letter-patch-inside-the-window`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 2, 7, 8): a major patch live
      for six complete weeks requests six and none preceding it; live for
      twelve or more requests twelve; a letter patch inside the window does
      not truncate it.
- [ ] 2.2 Take the major patch's release rather than the current patch's.
      `pairs.ts:pairWeeks` bounds on `patch.detectedAt`, and this needs the
      major one — which `letter-patch-detection` is what makes distinguishable
      at all. Until that change lands every recorded patch is a major, so this
      reads the same value and starts differing the day it does not.
- [ ] 2.3 Record the drift measurement in the pull request rather than only
      here: `corr +0.801` over 69 pairs, mean absolute difference 3.4 pp,
      across a window containing 7.41e. It is the whole argument for twelve
      weeks and the reviewer should not have to find it in `design.md`.

## 3. Storing a lane pair, both directions

Closes `snapshot-build/the-two-directions-of-a-lane-pair-are-independent`,
`snapshot-build/a-stomp-is-a-win-and-a-draw-is-half-of-one`.

- [ ] 3.1 Write the failing cases first: both directions of a lane pair are
      stored, neither derived from the other, and nothing asserts they sum to
      0 — measured, they sum to −0.72 to +1.50 pp; a row of 10
      wins, 4 stomp wins, 2 draws, 20 losses and 4 stomp losses over 40 games
      folds to 0.375.
- [ ] 3.2 Fold the five verdicts and read `matchWinCount` not at all. The
      five are mutually exclusive and exhaustive — verified over all 104 rows
      of one pull — and `matchWinCount` counts the match over the same games,
      which is what `matchups` already carries. Taking it here would restate
      that component under a new name, and every figure in this change was
      measured under the fold rather than under it.
- [ ] 3.3 Add `hero_lanes` to `src/job/schema.sql` keyed
      `(hero_id, position, opponent_id)`, and to the sentinel reclaim in
      `src/job/db.fixture.ts` — the reclaim before the write, on the terms
      that file's own comment fixes.
- [ ] 3.4 Write the pair case across two **different** positions (ZOMBIES
      31). `(a, 1, b)` beside `(b, 4, a)` is the real shape — the carry and
      the offlaner stand in one lane at different positions — and a case
      written at one position describes something that does not happen.

## 4. Centring against the hero's own laning strength

Closes `snapshot-build/the-mean-opponent-gives-no-lane-advantage`,
`snapshot-build/a-hero-with-one-lane-opponent`,
`snapshot-build/centring-keeps-the-mirror`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 16, 17): three opponents
      centre to a mean of exactly 0; a cell with one opponent centres it to
      0, the mean being its own value.
- [ ] 4.2 Centre by the row mean alone. The antisymmetric form
      `− r(a,p) + r(b,q)` that `score-calibration` uses for `matchups` is
      **not** wanted: it preserves an invariant a lane pair does not have,
      its two directions being independent pulls that disagree by about a
      point. This change specified that form first and was wrong to.
- [ ] 4.4 Pin the order against smoothing with a case (ZOMBIES 19): centring
      runs on the raw delta, before smoothing, and a cell mixing `n_eff` far
      above and far below `k` stores different numbers under the other order.

## 5. The constant, derived from before the smoothing

Closes `snapshot-build/the-constant-is-derived-not-configured`,
`snapshot-build/the-constant-does-not-depend-on-the-last-run-s`.

- [ ] 5.1 Write the failing cases first (ZOMBIES 23, 24): the pooled `k` and
      the per-cell spread are both recorded on the snapshot, and a build
      recording only the mean of the per-cell figures fails; two builds over
      identical staging rows derive the same `k` whichever constant the
      snapshot they started from recorded.
- [ ] 5.2 Take `var_true` over the **centred, unsmoothed** deltas. Taking it
      over the stored ones would define `k` in terms of what `k` produced,
      and 5.1's second case is what fails when it does.
- [ ] 5.3 Pool every covered cell rather than averaging per-cell figures.
      Each cell is centred on 0 already, so pooling is one decomposition over
      one population; a mean would weigh a three-opponent cell like a
      sixty-opponent one.
- [ ] 5.4 Record the per-cell spread beside the pooled value, and compare it
      in the pull request against the 17 to 61 three real cells measured
      (ZOMBIES 24). A fixture whose spread sits far outside that is a fixture
      that no longer resembles production.

## 6. What refuses a constant

Closes `snapshot-build/a-derived-constant-far-from-what-was-measured`,
`snapshot-build/a-spread-that-is-entirely-noise`.

- [ ] 6.1 Write the failing cases first (ZOMBIES 15, 18, 20, 21, 22): no lane
      rows at all derives no `k` and publishes; a derived `k` of exactly 5 and
      exactly 400 publish while 4.99 and 400.01 fail; `var_true` of exactly 0
      fails rather than dividing; a negative `var_true` fails the same way; a
      cell whose opponents all carry one delta centres to zeros without making
      the pooled `var_true` zero.
- [ ] 6.2 Reach the negative-`var_true` case with data rather than a stub
      (ZOMBIES 21). Observed variance below the binomial floor is what a
      genuinely noise-only statistic produces, and a stubbed number proves the
      branch runs without proving the branch is reachable.

## 7. The matrix in the bundle

Closes `snapshot-export/a-lane-pair-each-direction-from-its-own-row`,
`snapshot-export/a-hero-at-a-position-the-pull-did-not-cover`.

- [ ] 7.1 Write the failing cases first (ZOMBIES 26, 28, 29): a stored row
      reaches `lanes[a]["1"][b]`, and the opposite direction is rendered from
      `b`'s own row rather than from this one's negation; a position
      below the floor carries no key at all, and specifically not one holding
      `{}` or zeros; a position key outside `"1"`–`"5"` is refused.
- [ ] 7.2 Give `src/job/export/contract.ts` a third level for this root
      (ZOMBIES 27). Its walk is two deep — `contract.ts:122-131` wants a
      root's values to be objects and theirs to be numbers — so
      `lanes[44]["1"]` holding `{"6": -3.2}` is refused today.
- [ ] 7.3 Plant the malformed value under more than one hero and more than
      one position, never only under the first of each. A third level checked
      at `lanes[44]["1"]` and nowhere else passes a case written against that
      one leaf while leaving every other unscanned — which is the failure the
      two levels below it were written to avoid, arriving one level deeper.
- [ ] 7.4 Do **not** flatten to a composite key such as `lanes["44:1"]`. It
      would pass the existing rule while reading as an id to a scan that never
      learned otherwise, which `contract.ts:118-121` names as the exact
      failure its exemption list is written to make loud.

## 8. What the export refuses

Closes `snapshot-export/a-bundle-carrying-no-lane-data-at-all`,
`snapshot-export/a-lane-value-that-is-not-finite`.

- [ ] 8.1 Write the failing cases first (ZOMBIES 25, 30): no stored lane rows
      emits `lanes` as `{}` and publishes; a `NaN`, `Infinity` or `-Infinity`
      leaf anywhere in `lanes` fails the export.
- [ ] 8.2 Regenerate `src/fixtures/snapshot.json` and say in the pull request
      which branch it carries — populated `lanes` exercises the presence path
      in every suite that reads it, empty exercises the fallback, and 8.1
      covers both whichever is chosen.

## 9. The component, and the file it lands in

Closes `draft-model/a-candidate-with-no-lane-row-at-the-role-scored`,
`draft-model/one-enemy-covered-and-one-not`.

- [ ] 9.1 **Split `src/model.ts` before adding anything to it.** It is at
      exactly its 300-line cap, and `change-slicing` requires a split to the
      cap that will apply rather than the one that does — so the split counts
      this change's added lines and `beta-refit`'s, that change's step 1
      editing the same file. Re-measure the diff budget afterwards: a split
      counts its moved lines twice.
- [ ] 9.2 Write the failing cases first (ZOMBIES 33, 34, 35, 38): an empty
      draft gives `lane` exactly 0; one entered enemy with a stored row gives
      that value times `MODEL_CONSTANTS.weights.lane` — the component's own
      weight, never `laneWeights`, which step 10 pins; a role the candidate's
      lane data does not cover gives 0 with the other components unchanged;
      an enemy absent from
      a covered row contributes 0 rather than `NaN`.
- [ ] 9.3 Make the one-covered-one-not case fail against the wrong reading
      (ZOMBIES 34). "0 where the bundle carries no row, or none for an enemy
      within it" was written first and means a single uncovered enemy erases
      every covered one's contribution; the case is what separates the two.
- [ ] 9.4 Re-verify the carried *Empty draft components* scenario rather than
      assuming it. It now names `lane` among the components that are 0 with
      no enemies entered, so it states something new about a component that
      did not exist when it was written.

## 10. What the component is not weighted by

Closes `draft-model/a-bundle-predating-the-lane-matrix`,
`draft-model/the-lane-component-is-not-weighted-twice`.

- [ ] 10.1 Write the failing cases first (ZOMBIES 32, 37): a bundle with no
      `lanes` gives every candidate a `lane` of exactly 0 and no `NaN`; two
      enemies at different inferred roles contribute their plain stored
      values, unscaled by `laneWeights` and unnormalised by `L̄`.
- [ ] 10.2 Add a case for two bundles alike but for one `lanes` value scoring
      one draft differently (ZOMBIES 39), so the statistic is shown to reach
      the score at all rather than being computed and discarded.
- [ ] 10.3 Re-run Stryker (ZOMBIES 40). `openspec/specs/mutation-floor/`
      scopes it to `src/model.ts`, 9.1 splits that file, and the floor applies
      to whatever it becomes. Whether one configuration per file still scales
      is `PLAN.md`'s open entry and not this change's to settle — but leaving
      the floor unmet is not an option it has either.
- [ ] 10.4 Record the suggestion block before and after on one real draft, so
      the change's effect on ordering is written down while the weight is
      still 1.0 and nothing has fitted it.
- [ ] 10.5 Say in the pull request what the run now costs: 3 600 requests
      added to ~516, and about three hours against the under-one-hour the run
      takes today.
- [ ] 10.6 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 10.7 Run the pre-PR sequence per `docs/review-toolkit.md` on every step,
      and `bun test` and `bun run test:db` besides. Steps 1 to 8 touch the
      database, and CI runs only the first
      (`.github/workflows/test.yml:110`).
