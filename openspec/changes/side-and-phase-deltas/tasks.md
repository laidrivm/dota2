# side-and-phase-deltas — tasks

Five steps, five pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers.

**`match-harvest` must be applied first** — every row this change writes is
counted from `harvest_matches` and `harvest_picks`. And like
`score-calibration`, this moves the score scale with nothing measuring the
move, so it should follow `outcome-calibration` too.

The three `MODIFIED` deltas carry twelve criteria this change does not close
— every scenario the three requirements already had:
  `snapshot-build/sample-equal-to-the-constant`,
  `snapshot-build/a-sample-far-below-the-constant`,
  `snapshot-build/neither-component-measured`,
  `snapshot-build/one-component-measured-while-the-other-is-not`,
  `snapshot-build/a-component-measured-for-some-heroes-only`,
  `snapshot-build/a-part-the-component-never-measured`,
  `snapshot-build/the-verdict-outlives-the-build-that-took-it`,
  `snapshot-build/a-measured-component-that-happens-to-be-neutral`,
  `snapshot-ingest/two-runs-over-unchanged-data`,
  `snapshot-ingest/two-runs-a-day-apart`,
  `snapshot-ingest/rows-from-an-older-patch`,
  `snapshot-ingest/a-run-that-fails-part-way`.
They are copied whole because a `MODIFIED` delta replaces a requirement
rather than patching it, and tests on `main` close them. Two stop being
hypothetical rather than changing meaning:
`a-component-measured-for-some-heroes-only` becomes reachable for the first
time, and `a-measured-component-that-happens-to-be-neutral` is what a
zero-match row produces.

## 1. Counting side and phase from the harvest

Closes `snapshot-ingest/the-two-tables-the-write-now-covers`,
`snapshot-ingest/a-harvest-that-has-collected-nothing-yet`.

- [ ] 1.1 Write the failing cases first (ZOMBIES 1, 3, 4, 5, 6, 9, 10, 11):
      an empty harvest leaves both tables empty; one match gives its five
      Radiant picks a win and its five Dire picks a loss; a Dire pick in a
      Radiant win counts as a loss, the sign inverting per side; a hero on
      both sides accumulates two rows summing to its appearances; phase
      counts a side's own earlier picks and not every earlier pick; `wins`
      never exceeds `matches`; the phase column carries `'1'`, `'2'`,
      `'last'`; both tables are replaced in the same transaction as the rest.
- [ ] 1.2 Emit the zero-match rows in this step, not the next. Step 2 closes
      the criteria for a hero missing a part, but the write that ships here
      must already cover them: a step landing rows only where matches exist
      leaves a build that fails on the first rare hero, and
      `change-slicing` requires a step to leave the application working when
      it merges. Step 2 proves the two properties this rule exists for and
      adds no production code.
- [ ] 1.3 Derive phase through `pickPhase`'s own rule — count ≤ 1 is `p1`,
      ≤ 3 is `p2`, else `last` — rather than through Dota's real draft
      phases. A different derivation gives the build a `phase` under a
      definition the model does not use, and the two would disagree about
      the same hero in the same match.
- [ ] 1.4 Mind the three spellings (ZOMBIES 10). `PickPhase` is
      `p1 | p2 | last`, the staging column checks `'1' | '2' | 'last'`, and
      the snapshot columns are `phase_adj_1 | _2 | _last`. Only the middle
      one is enforced by the database.
- [ ] 1.5 Rewrite the comment at `src/job/ingest/staging.ts:72`. It says the
      two tables "are not touched: side and phase are this change's stated
      non-goals, nothing writes those tables, and there is accordingly
      nothing in them to replace or retain" — every clause of which stops
      being true.
- [ ] 1.6 Rewrite `src/job/schema.sql:238` — "No pull fills these two: side
      and phase are this change's stated non-goals" — which stops being true
      the moment this step lands.
- [ ] 1.7 Remove the filter at `src/job/ingest/staging.test.ts:169`, not just
      its comment. The case asserts which staging tables the write covers and
      **excludes these two from the list before comparing**, so after this
      change it keeps passing while hiding the two tables the change adds.
      A stale comment is a defect no test sees; this is a test built not to
      see one.

## 2. Every hero or no hero

Closes `snapshot-ingest/a-hero-with-no-match-on-one-side`,
`snapshot-ingest/a-hero-the-harvest-has-never-seen`,
`snapshot-ingest/a-part-no-hero-has-a-match-on`.

No production code beyond what step 1 lands: the write emits zero-match rows
from the start, because a step that did not would leave a build failing on
the first rare hero. This step proves the two properties that choice was
made for.

- [ ] 2.1 Write the failing cases first (ZOMBIES 2, 12, 13, 14): a hero with
      picks on one side only still gets a zero-match row for the other; a
      hero the harvest never saw gets zero-match rows for every part; a
      patch whose picks are all on one side leaves no `dire` row for anyone,
      which publishes. **Not** a case for a match with fewer than ten picks:
      `match-harvest` rejects those rather than storing them, so the store
      cannot hold one and a filter here would guard nothing. What is worth
      asserting instead is the dependency — the phase count assumes five
      picks a side — and that is 2.4.
- [ ] 2.2 Assert the rows are written per hero of `heroes` and never per
      hero the harvest saw. *An unmeasured component is zero for every hero*
      fails a build where a component is measured for some heroes and not
      others, and this change is what makes that case reachable — phase most
      of all, since some heroes are never among a side's first two picks.
- [ ] 2.3 Keep the empty-harvest case distinct from the zero-match case. No
      match for the patch means no row at all, so the component reads as
      unmeasured; any match means a row for every hero, so it reads as
      measured for all of them. Writing zeros in the first case would set
      `side_measured` on a component nothing observed.
- [ ] 2.4 Assert the aggregation's dependency on `match-harvest`, closing no
      criterion: every stored match carries ten picks, five a side, because
      that change refuses anything else. The phase count is wrong without it,
      and the assertion is the seam between the two changes rather than a
      filter this one applies.

## 3. What a column stores when there is nothing to store

Closes `snapshot-build/a-zero-match-side-row`,
`snapshot-build/a-hero-with-side-rows-and-no-counted-matches`.

- [ ] 3.1 Write the failing cases first: a side row carrying zero matches
      writes its column as 0, the column having no omission to fall back on
      the way a row-stored statistic does; a hero with side rows but no
      counted matches to take an overall winrate from fails the build rather
      than storing a delta taken from 50.
- [ ] 3.2 Read the carried clause before implementing either. *Smoothing
      towards neutral by sample size* says an `n_eff` of 0 leaves a
      statistic out of the snapshot, and then confines that to statistics
      stored as rows — side and phase are columns on the hero row, and the
      delta spells the distinction out because this change is what makes
      zero-match rows routine.

## 4. The base a delta is taken from

Closes `snapshot-build/a-side-delta-on-a-hero-that-is-above-average`,
`snapshot-build/a-hero-with-no-side-preference`,
`snapshot-build/the-same-sample-on-a-side`.

- [ ] 4.1 Write the failing cases first (ZOMBIES 15, 16, 17, 18, 19): a hero
      at 55% overall and 56% on Radiant stores about 1.0 rather than 6.0; a
      hero whose side winrates both equal its overall stores 0 however far
      that overall sits from 50; `meta`, `matchup` and `synergy` still take
      50; the overall winrate is counted from the same matches and never
      from `hero_stats`, which `rows.ts:21` says holds none; a hero with
      side rows but no counted matches is refused rather than falling back
      to 50, which
      `snapshot-build/a-hero-with-side-rows-and-no-counted-matches` now
      fixes.
- [ ] 4.2 Give `delta()` a base per component rather than the single
      `NEUTRAL` it subtracts today, and widen `blend.test.ts` (ZOMBIES 20),
      whose cases pin the 50 path and none of which pins that the caller
      passes the right base for the right component.
- [ ] 4.3 Rewrite the doc comments at `src/types.ts:71` and `:73`. Both say
      "relative to the hero's overall winrate", which the arithmetic never
      matched and which this step makes half-true: step 5 centres the deltas
      across heroes as well, so a value is what a side or phase is worth to
      **this hero over and above what it is worth to heroes in general**.
      Landing this step with the old comment leaves it accurate for one
      release and wrong after the next, so it is written for both at once.
- [ ] 4.4 Confirm the components are non-zero for the first time (ZOMBIES
      21): a build over a fixture harvest publishes with `side_measured` and
      `phase_measured` both true and non-zero deltas on hero rows. Record
      the count of non-zero heroes against the 0 of 127 the proposal
      measured.

## 5. Centring the deltas across heroes

Closes `snapshot-build/the-mean-hero-has-no-side-preference`,
`snapshot-build/a-hero-that-genuinely-prefers-a-side`.

- [ ] 5.1 Write the failing cases first (ZOMBIES 3, 4, 5, 6, 9, 12): two
      heroes at +6 and +2 on Radiant centre to +2 and −2; the mean of each
      part over every hero is 0 afterwards; the five parts are centred
      independently, one mean across all five being a different and wrong
      number; centring `side` does not shift `phase`; `meta`, `matchup` and
      `synergy` are untouched; a component where every hero holds the same
      delta centres to all zeros.
- [ ] 5.2 Subtract the mean over heroes **after** smoothing, per part, and
      pin the order with a case (ZOMBIES 7): a hero at `n_eff = k` beside one
      at `n_eff = k/9` centres against the mean of their *smoothed* values,
      and centring before smoothing stores a different number.
- [ ] 5.3 Handle the two degenerate populations (ZOMBIES 1, 2, 8): a snapshot
      of one hero centres that hero to 0, the mean being its own value — the
      pass erases a one-hero component rather than preserving it, and that is
      the arithmetic, not a bug to work around; a component with no staging
      rows is skipped entirely, no mean being taken over an empty set; a hero
      whose zero-match row stored 0 is counted in the mean and moved off 0,
      its column being a measured 0 rather than an absent one.
- [ ] 5.4 Widen `build.fixture.ts` (ZOMBIES 13). Its existing inserts into
      `staging_hero_sides` and `staging_hero_phases` carry one or two heroes,
      which exercise the pass only degenerately — telling a mean from a value
      needs three.
- [ ] 5.5 Centre `phase` too, and record in the pull request that it changes
      no output today — `phaseDelta` is read only at `model.ts:225`, and
      every candidate in a call shares one phase, so a constant common to all
      heroes reorders nothing. It is centred so that two fields of one
      contract carry one definition.
- [ ] 5.6 Check the win estimate on a full draft before and after (ZOMBIES
      14, 15). Without this step it reads about 97.5% for a Radiant draft;
      with it a draft of average heroes carries about 0 from the side, while
      a draft stacked with heroes that genuinely prefer Radiant still carries
      a positive one — the pass removes the constant, not the signal.
- [ ] 5.7 Confirm every centred value stays finite and both fields keep their
      shapes (ZOMBIES 10, 11), so `contract.ts`'s assertion publishes.
- [ ] 5.8 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 5.9 Run the pre-PR sequence per `docs/review-toolkit.md` on every
      step, and `bun test` and `bun run test:db` besides. Every step here
      touches the database, and CI runs only the first
      (`.github/workflows/test.yml:110`).
