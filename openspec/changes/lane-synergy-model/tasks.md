# lane-synergy-model — tasks

Four steps, four pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a *step* close no criterion only
when it carries infrastructure, and every step here closes at least one.
Individual tasks that close none say so where they stand; updating `PLAN.md`
and running the review sequence are the last two, riding with the step that
merges last.

**`laning-phase-model` must be applied and synced first**, and therefore
`candidacy-gate` before it. Every delta here replaces a requirement that
change writes; there is no version of any of them on `main`, and the
`draft-model` one is a third replacement of a requirement `candidacy-gate`
and `laning-phase-model` replace in turn.

The four `MODIFIED` deltas carry **twenty-one** criteria this change does not
close — every scenario `laning-phase-model` leaves behind, some generalised
from one lane statistic to either:
  `draft-model/empty-draft-components-model-spec-7-1`,
  `draft-model/counter-risk-monotonic-in-bans-model-spec-7-2`,
  `draft-model/a-candidate-with-no-lane-row-at-the-role-scored`,
  `draft-model/one-enemy-covered-and-one-not`,
  `draft-model/a-bundle-predating-the-lane-matrix`,
  `draft-model/the-lane-component-is-not-weighted-twice`,
  `snapshot-build/the-two-directions-of-a-lane-pair-are-independent`,
  `snapshot-build/a-stomp-is-a-win-and-a-draw-is-half-of-one`,
  `snapshot-build/the-mean-other-hero-gives-no-lane-advantage`,
  `snapshot-build/a-hero-with-one-row-in-a-statistic`,
  `snapshot-build/a-constant-does-not-depend-on-the-last-run-s`,
  `snapshot-build/a-derived-constant-far-from-what-was-measured`,
  `snapshot-build/a-spread-that-is-entirely-noise`,
  `snapshot-export/a-lane-pair-each-direction-from-its-own-row`,
  `snapshot-export/a-hero-at-a-position-the-pull-did-not-cover`,
  `snapshot-export/a-bundle-carrying-no-lane-data-at-all`,
  `snapshot-export/a-lane-value-that-is-not-finite`,
  `snapshot-ingest/a-position-below-the-share-floor`,
  `snapshot-ingest/a-window-longer-than-the-hourly-ceiling-admits`,
  `snapshot-ingest/a-major-patch-younger-than-the-window`,
  `snapshot-ingest/a-letter-patch-inside-the-window`.
They are copied whole because a `MODIFIED` delta replaces a requirement
rather than patching it, and `laning-phase-model`'s tests close them. Five of
them were dropped from an earlier draft of these deltas and restored — four
guarding the opponent component and one guarding the constant against a
circular estimator — which is what a MODIFIED delta does to anything it
does not carry.

Four more of that change's scenarios are **renamed** rather than carried,
each widening from one lane statistic to either. Their new identifiers are
among the nine closed below, and the two deltas that rename them carry the
before-and-after so no citation of the old slug goes quietly unresolved.

Two carried scenarios change meaning rather than staying still: the share
floor now gates both sides of the pull together, and *Empty draft components*
now names `laneSynergy` among the components that are 0 on an empty board.
Steps 1 and 4 re-verify those rather than assuming them.

## 1. The second side of the pull

Closes `snapshot-ingest/one-request-per-cell-and-side`,
`snapshot-ingest/a-run-that-runs-out-of-quota-part-way`.

- [ ] 1.1 Write the failing cases first (ZOMBIES 1, 2, 4, 5): an opponent
      pull that returned nothing still issues the ally pull; one cell issues
      two requests a week carrying `isWith: false` and `isWith: true`; a hero
      above the floor at two positions issues four; a cell below the floor
      issues neither side, not one.
- [ ] 1.2 Issue the ally pull **after** every opponent request has returned,
      never interleaved (ZOMBIES 3). Sequenced, a run cut short by the daily
      window leaves the opponent statistic whole; interleaved it leaves both
      half covered, and *An unmeasured component is zero for every hero*
      fails the build on the partial half rather than publishing the whole
      one.
- [ ] 1.3 Write the truncation cases both ways (ZOMBIES 6, 7): the window
      emptying between the pulls leaves one statistic whole; emptying inside
      the opponent pull leaves neither, and the run records which pull it was
      in — "the run ran out" says nothing about what published.
- [ ] 1.4 Re-verify the share floor rather than assuming it, closing no
      criterion beyond the one above: it now gates both sides together, which
      is a sentence `laning-phase-model` did not have to write.
- [ ] 1.5 **Measure the median ally cell's depth before accepting the twelve
      week window**, and record it in the pull request. The window is twelve
      because the opponent half needs it; the ally half reached 3 239 games a
      pair on the busiest cell, where four weeks would cost 1 200 requests
      rather than 3 600 and take an hour off the run. Nothing has measured
      the median ally cell. If four weeks suffices there, this step says so
      and the window becomes a question for its own change rather than a
      number carried by inertia.

## 2. A constant for each statistic

Closes `snapshot-build/a-constant-is-derived-per-statistic`,
`snapshot-build/one-statistic-s-rows-do-not-move-the-other-s-constant`.

- [ ] 2.1 Write the failing cases first (ZOMBIES 8, 10, 11, 14): ally rows
      with no opponent rows derive only the ally constant and publish; a
      store whose ally rows have doubled leaves the opponent constant where
      the previous run put it; identical ally rows beside wildly different
      opponent rows derive two different constants; a statistic whose
      variance is all noise fails the build **naming which statistic**, not
      "the lane constant".
- [ ] 2.2 Derive each over its own rows and never the other's. The two land
      close on this patch — 29 for allies against 11 to 37 for opponents —
      and 2.1's third case is what fails if that closeness is turned into a
      shared constant.
- [ ] 2.3 Add a case carrying draws and one carrying none (ZOMBIES 12): with
      no draws the folded and the Bernoulli variance agree, so a case built
      only from decisive lanes cannot tell the corrected model from the wrong
      one. Draws are 28.9% of ally lane games, and the Bernoulli form reads
      this constant as 44 where it is 29.
- [ ] 2.4 Record both constants with their per-cell ranges, and compare the
      ally one in the pull request against the 29 measured (ZOMBIES 15, 13).

## 3. The ally root in the bundle

Closes `snapshot-export/an-ally-pair-rendered-into-its-own-root`,
`snapshot-export/one-statistic-covered-and-the-other-not`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 16, 17, 18, 21, 22): both
      statistics empty emits two empty roots and publishes; an ally row
      reaches `laneAllies` and does not appear in `lanes`; a hero covered in
      one root carries no key in the other; `laneAllies` empty beside a
      populated `lanes` publishes; a `NaN` leaf in `laneAllies` fails.
- [ ] 3.2 Extend the contract's third level to **both** roots (ZOMBIES 19,
      20). A depth added for `lanes` and not for `laneAllies` leaves the
      second unscanned, which is the failure `laning-phase-model` fixed one
      level down arriving one root across. Plant the malformed leaf under
      several heroes and positions in each root, never under the first of
      each.
- [ ] 3.3 Regenerate `src/fixtures/snapshot.json` and say in the pull request
      which branch each root carries.

## 4. The eighth component

Closes `draft-model/the-two-lane-components-read-opposite-halves-of-the-board`,
`draft-model/allies-picked-but-none-in-the-row`,
`draft-model/a-bundle-predating-the-ally-matrix`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 23, 24, 25, 26, 27): an
      empty draft gives `laneSynergy` exactly 0; a bundle with `lanes` and no
      `laneAllies` gives 0, leaves `lane` unaffected and yields no `NaN`; one
      picked ally with a row gives its value times the weight; two allies and
      two enemies have each component reading only its own half; allies
      picked but none in the row gives 0 with the rest unchanged.
- [ ] 4.2 Sum over the allies already picked, never the entered enemies, and
      write the disjointness as an assertion about the two sums rather than
      as a guard (ZOMBIES 28). `taken` already excludes a hero on the board
      from being both, so a double count is impossible by construction — a
      case asserting the sums read disjoint sets says that, where a guard
      would imply it needs preventing.
- [ ] 4.3 Do not weight through `laneWeights` (ZOMBIES 30), for the reason
      `laning-phase-model` records, and add the case that would fail if it
      were: two allies at different roles contribute their plain stored
      values, unnormalised by `L̄`.
- [ ] 4.4 Re-verify the carried *Empty draft components* scenario rather than
      assuming it: it now names `laneSynergy` among the components that are 0
      with an empty board, which is something new about a component that did
      not exist when it was written.
- [ ] 4.5 Add a case for two bundles alike but for one `laneAllies` value
      scoring one draft differently (ZOMBIES 31), so the statistic is shown
      to reach the score rather than being computed and discarded.
- [ ] 4.6 Re-run Stryker (ZOMBIES 32). Its floor is scoped to `src/model.ts`,
      which `laning-phase-model`'s step 9 splits; this adds to whatever that
      left, and re-measures the file cap besides.
- [ ] 4.7 Record the suggestion block before and after on one real draft, and
      say what the run now costs: 7 200 requests against ~516, six hours
      against the under-one-hour it took before either lane change.
- [ ] 4.8 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 4.9 Run the pre-PR sequence per `docs/review-toolkit.md` on every step,
      and `bun test` and `bun run test:db` besides. Steps 1 to 3 touch the
      database, and CI runs only the first
      (`.github/workflows/test.yml:110`).
