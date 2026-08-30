# side-and-phase-deltas — tasks

Three steps, three pull requests, in this order. Each names the criteria it
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
- [ ] 1.2 Derive phase through `pickPhase`'s own rule — count ≤ 1 is `p1`,
      ≤ 3 is `p2`, else `last` — rather than through Dota's real draft
      phases. A different derivation gives the build a `phase` under a
      definition the model does not use, and the two would disagree about
      the same hero in the same match.
- [ ] 1.3 Mind the three spellings (ZOMBIES 10). `PickPhase` is
      `p1 | p2 | last`, the staging column checks `'1' | '2' | 'last'`, and
      the snapshot columns are `phase_adj_1 | _2 | _last`. Only the middle
      one is enforced by the database.
- [ ] 1.4 Rewrite the comment at `src/job/ingest/staging.ts:72`. It says the
      two tables "are not touched: side and phase are this change's stated
      non-goals, nothing writes those tables, and there is accordingly
      nothing in them to replace or retain" — every clause of which stops
      being true.

## 2. Every hero or no hero

Closes `snapshot-ingest/a-hero-with-no-match-on-one-side`,
`snapshot-ingest/a-hero-the-harvest-has-never-seen`.

This step is the one that keeps the build from failing on a quiet night.

- [ ] 2.1 Write the failing cases first (ZOMBIES 2, 12, 13, 14): a hero with
      picks on one side only still gets a zero-match row for the other; a
      hero the harvest never saw gets zero-match rows for every part; a
      patch whose picks are all on one side leaves no `dire` row for anyone,
      which publishes; a match with fewer than ten picks contributes to
      neither table.
- [ ] 2.2 Write rows per hero of `heroes`, never per hero the harvest saw.
      *An unmeasured component is zero for every hero* fails a build where a
      component is measured for some heroes and not others, and this change
      is what makes that case reachable — phase most of all, since some
      heroes are never among a side's first two picks.
- [ ] 2.3 Keep the empty-harvest case distinct from the zero-match case. No
      match for the patch means no row at all, so the component reads as
      unmeasured; any match means a row for every hero, so it reads as
      measured for all of them. Writing zeros in the first case would set
      `side_measured` on a component nothing observed.

## 3. The base a delta is taken from

Closes `snapshot-build/a-side-delta-on-a-hero-that-is-above-average`,
`snapshot-build/a-hero-with-no-side-preference`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 15, 16, 17, 18, 19): a hero
      at 55% overall and 56% on Radiant stores about 1.0 rather than 6.0; a
      hero whose side winrates both equal its overall stores 0 however far
      that overall sits from 50; `meta`, `matchup` and `synergy` still take
      50; the overall winrate is counted from the same matches and never
      from `hero_stats`, which `rows.ts:21` says holds none; a hero with
      side rows but no counted matches is refused rather than falling back
      to 50.
- [ ] 3.2 Give `delta()` a base per component rather than the single
      `NEUTRAL` it subtracts today, and widen `blend.test.ts` (ZOMBIES 20),
      whose cases pin the 50 path and none of which pins that the caller
      passes the right base for the right component.
- [ ] 3.3 Make `src/types.ts:71` and `:73` true. Both say these deltas are
      "relative to the hero's overall winrate" and always have; the
      arithmetic never matched, and nothing noticed because the numbers were
      zero. The comments do not change — this is the step that stops them
      being wrong.
- [ ] 3.4 Confirm the components are non-zero for the first time (ZOMBIES
      21): a build over a fixture harvest publishes with `side_measured` and
      `phase_measured` both true and non-zero deltas on hero rows. Record
      the count of non-zero heroes against the 0 of 127 the proposal
      measured.
- [ ] 3.5 Update `PLAN.md`'s queue in this step's pull request, not
      afterwards.
- [ ] 3.6 Run the pre-PR sequence per `docs/review-toolkit.md` on every
      step, and `bun test` and `bun run test:db` besides. Every step here
      touches the database, and CI runs only the first
      (`.github/workflows/test.yml:110`).
