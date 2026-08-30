# outcome-calibration — tasks

Five steps, five pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers. There is no
closing group: `openspec/config.yaml` lets a step close no criterion only
when it carries infrastructure, and recording the figures, updating
`PLAN.md` and running the review sequence are none of that — so they ride
with the step that merges last, where they were always going to happen.

**This change cannot be applied before `match-harvest` is applied and
synced.** It reads the tables that change creates, and its `snapshot-ingest`
delta is copied from the version that change leaves behind rather than from
`main`. Applying them out of order produces a delta that replaces a
requirement mentioning three steps with one mentioning five, silently losing
the fourth.

The `snapshot-ingest` delta carries six criteria this change does not close —
`an-ingest-that-fails`, `a-build-that-fails`, `an-export-that-fails`,
`the-export-invoked-on-its-own`, and `a-run-that-succeeds` and
`a-harvest-that-fails`, which `match-harvest` closes. The last two change
meaning here — one now names five steps, the other now also stops the scorer
— so step 5 re-verifies them rather than assuming them.

## 1. A draft becomes a session

Closes `outcome-calibration/a-full-draft-becomes-a-session`,
`outcome-calibration/a-draft-naming-a-hero-the-bundle-does-not-carry`,
`outcome-calibration/a-match-the-model-returns-no-estimate-for`.

- [ ] 1.1 Write the failing cases first, against a fixture bundle and a
      fixture draft rather than a database (ZOMBIES 1, 2, 3, 4, 6): a
      ten-pick match yields a probability and one scored match; five against
      four picks is unscorable, which is the exact boundary `computeModel`
      gates `winEstimate` on; a hero with `sufficient: false` is still scored
      with its meta reading 0; `winProbability` is what is taken and never
      `advantage`; a pick naming a hero the bundle lacks yields one
      unscorable and no invented probability.
- [ ] 1.2 Refuse a draft `computeModel` does not defend against (ZOMBIES 8,
      9) — the same hero id on both sides, a position outside 1..5, or two
      picks sharing a position. Its own comment says a hero in two sets is
      undefined behaviour it does not guard, so the guard belongs on this
      side of the call. These close no criterion: they are refusals of input
      the harvest should never produce, and a criterion fixing them would
      constrain the model rather than this change.
- [ ] 1.3 Assert that an unknown **ban** id does not make a match unscorable
      (ZOMBIES 7). `src/model.ts:181` spreads `session.bans` into `taken` as
      raw ids and never resolves them, so an unknown ban is harmless where an
      unknown pick is fatal — an asymmetry a reader will otherwise assume
      away.
- [ ] 1.4 Assert the bundle is unchanged after scoring a thousand matches
      (ZOMBIES 5). `draft-model` fixes non-mutation for `computeModel`;
      nothing yet fixes it for a caller reusing one bundle in a loop, and a
      caller that mutated it would score the last match differently from the
      first.
- [ ] 1.5 Build the session from a stored match. `Session` wants `side`,
      `myRole`, `teamPicks` keyed by role as a string, `enemyPicks` and
      `bans` — read the shape from `src/types.ts` rather than from this list,
      which is a summary and will age.
- [ ] 1.6 Call `computeModel` and take `winEstimate.winProbability` as
      P(Radiant wins). Import the model; never copy any part of it. The
      boundary rule forbids `src/model.ts` importing from `src/app/**` and
      says nothing against the job importing the model, which is what keeps
      the scored formula identical to the served one by construction.

## 2. Computing the figures

Closes `outcome-calibration/the-baseline-comes-from-the-matches-scored`,
`outcome-calibration/a-probability-of-exactly-one-half`.

- [ ] 2.1 Write the failing cases first, over a fixture set with no database
      (ZOMBIES 12, 13, 14, 15, 16, 17, 18): one match at `p = 0.8` that
      Radiant won gives Brier exactly 0.04; Brier over at least two matches
      is the mean and not the sum, which one match cannot tell apart; `p`
      exactly `0.5` is correct only where Radiant lost; `p` of 0 on a Radiant
      win gives 1.0; an all-Radiant-win set gives a baseline of 1.0 and Brier
      0; an all-Radiant-loss set gives a baseline of 0 and 100% accuracy; the
      baseline fraction is taken over the matches scored and never over the
      matches read.
- [ ] 2.2 Compute Brier as the mean of `(p − outcome)²` and accuracy as the
      share where the prediction matched, on the definitions *A run records
      the model's score and the baseline it must beat* fixes. Both are one
      expression; the value of this step is the cases above.

## 3. Recording what a run scored

Closes `outcome-calibration/one-row-per-run-and-no-per-match-row`,
`outcome-calibration/a-run-that-could-score-nothing`,
`outcome-calibration/the-figures-name-the-snapshot-that-produced-them`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 10, 11, 19, 20, 21): a run
      over a thousand matches writes one row and no row per match; a run that
      could score nothing records that rather than a Brier over an empty set,
      and a store holding no match at all is that same case and not a crash;
      two runs over one set under two snapshots are two rows; a database with
      no published snapshot records nothing and says so rather than scoring
      against a bundle it does not have.
- [ ] 3.2 Add the per-run table to `src/job/schema.sql` — snapshot, matches
      scored, matches unscorable, model Brier, model accuracy, baseline
      Brier, baseline accuracy — and its reclaim in `src/job/db.fixture.ts`,
      without which no suite may write to it.
- [ ] 3.3 Store no per-match prediction. Re-deriving one costs no request,
      which is the reason the scorer is separately invocable at all.

## 4. The scorer on its own

Closes `outcome-calibration/the-scorer-invoked-on-its-own`.

- [ ] 4.1 Write the failing case first (ZOMBIES 22): invoked alone, the
      scorer scores the stored matches, exits zero, and issues no request to
      the statistics API. The last clause is the one worth asserting —
      `run.test.ts:213` already makes it for the export's standalone mode.
- [ ] 4.2 Add the mode beside the export's in `src/job/run.ts`'s command,
      whose current message names the export as the only step invocable
      alone. That message is a claim this step falsifies, so it moves with
      the code.

## 5. The step in the run

Closes `snapshot-ingest/a-scorer-that-fails`.

- [ ] 5.1 Write the failing cases first (ZOMBIES 23, 24, 25, 26, 27): a
      harvest that fails runs no scorer; a scorer that throws leaves the
      exported bundle served; it leaves the harvest's rows standing rather
      than rolling back a step that succeeded; it names the scorer in the
      report the way `run.test.ts:97` requires of the other steps; and a full
      run records one row carrying all six figures and both counts.
- [ ] 5.2 Run the scorer from `src/job/run.ts` after the harvest.
- [ ] 5.3 Re-verify `snapshot-ingest/a-run-that-succeeds` and
      `snapshot-ingest/a-harvest-that-fails`, both of whose text this change
      rewrites — one to five steps, the other to also stop the scorer.
- [ ] 5.4 Reconcile the places in `src/job/run.ts` that state a step count or
      name the export as the only standalone mode. `match-harvest` already
      lists three such comments; re-grep rather than trusting that list,
      since this change lands on top of it.
- [ ] 5.5 Record the first real figures — model Brier, model accuracy,
      baseline Brier, baseline accuracy, matches scored — in the pull request
      that merges the last step. They are what the whole change exists to
      produce, and the first ones settle whether `beta-refit` is urgent or
      merely due.
- [ ] 5.6 Update `PLAN.md`'s queue in the same pull request, not afterwards.
- [ ] 5.7 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
      Steps 3 to 5 touch the database, so each one's suite must assert it ran
      rather than skipping, and `bun run test:db` is the run that counts.
