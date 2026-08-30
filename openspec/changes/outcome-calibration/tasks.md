# outcome-calibration — tasks

Five steps, five pull requests, in this order — `change-slicing` ships one
per task group and the last group is a group. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers; the last closes
none and says so.

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
— so step 4 re-verifies them rather than assuming them.

## 1. A draft becomes a session

Closes `outcome-calibration/a-full-draft-becomes-a-session`,
`outcome-calibration/a-draft-naming-a-hero-the-bundle-does-not-carry`,
`outcome-calibration/a-match-the-model-returns-no-estimate-for`.

- [ ] 1.1 Write the failing cases first, against a fixture bundle and a
      fixture draft rather than a database: ten stored picks become
      `teamPicks` at their stored positions with `side: "radiant"`, five Dire
      picks as `enemyPicks` and every stored ban in `bans`; a pick naming a
      hero the bundle lacks yields no score and one unscorable; a session the
      model returns `winEstimate: null` for yields no score and one
      unscorable, with no probability invented.
- [ ] 1.2 Build the session from a stored match. `Session` wants `side`,
      `myRole`, `teamPicks` keyed by role as a string, `enemyPicks` and
      `bans` — read the shape from `src/types.ts` rather than from this list,
      which is a summary and will age.
- [ ] 1.3 Call `computeModel` and take `winEstimate.winProbability` as
      P(Radiant wins). Import the model; never copy any part of it. The
      boundary rule forbids `src/model.ts` importing from `src/app/**` and
      says nothing against the job importing the model, which is what keeps
      the scored formula identical to the served one by construction.

## 2. The figures and the baseline

Closes `outcome-calibration/the-baseline-comes-from-the-matches-scored`,
`outcome-calibration/a-run-that-could-score-nothing`,
`outcome-calibration/the-figures-name-the-snapshot-that-produced-them`.

- [ ] 2.1 Write the failing cases first: over a set with a known Radiant
      fraction the baseline probability is that fraction and its figures are
      computed over the same matches the model was; a run that scored nothing
      records that rather than a Brier over an empty set; two runs over one
      set of matches under two snapshots are two rows.
- [ ] 2.2 Add the per-run table to `src/job/schema.sql` — snapshot, matches
      scored, matches unscorable, model Brier, model accuracy, baseline
      Brier, baseline accuracy — and its reclaim in `src/job/db.fixture.ts`,
      without which no suite may write to it.
- [ ] 2.3 Compute Brier as the mean of `(p − outcome)²` and accuracy as the
      share where `p > 0.5` matches the outcome. Both are one expression; the
      value of this step is the cases above, not the arithmetic.
- [ ] 2.4 Store no per-match prediction. A prediction is a pure function of a
      stored draft and a bundle, and re-deriving it costs no request — the
      reason the scorer is separately invocable at all. Recorded here so a
      later reader does not add a table believing it was overlooked.

## 3. The scorer on its own

Closes `outcome-calibration/the-scorer-invoked-on-its-own`.

- [ ] 3.1 Write the failing case first: invoked alone, the scorer scores the
      stored matches, exits zero, and issues no request to the statistics
      API. The last clause is the one worth asserting — `src/job/run.ts`
      already tests the export's standalone mode that way.
- [ ] 3.2 Add the mode beside the export's in `src/job/run.ts`'s command,
      whose current message names the export as the only step invocable
      alone. That message is a claim this step falsifies, so it moves with
      the code.

## 4. The step in the run

Closes `snapshot-ingest/a-scorer-that-fails`.

- [ ] 4.1 Write the failing cases first: a scorer that throws leaves the
      exported bundle served and the harvest's work standing, exits non-zero
      and names the scorer; a harvest that fails runs no scorer.
- [ ] 4.2 Run the scorer from `src/job/run.ts` after the harvest.
- [ ] 4.3 Re-verify `snapshot-ingest/a-run-that-succeeds` and
      `snapshot-ingest/a-harvest-that-fails`, both of whose text this change
      rewrites — one to five steps, the other to also stop the scorer.
- [ ] 4.4 Reconcile the places in `src/job/run.ts` that state a step count or
      name the export as the only standalone mode. `match-harvest` already
      lists three such comments; re-grep rather than trusting that list,
      since this change lands on top of it.

## 5. Closing the change

Closes no acceptance criterion.

- [ ] 5.1 Record the first real figures — model Brier, model accuracy,
      baseline Brier, baseline accuracy, matches scored — in the pull request
      that merges the last step. They are what the whole change exists to
      produce, and the first ones settle whether `beta-refit` is urgent or
      merely due.
- [ ] 5.2 Update `PLAN.md`'s queue in the same pull request, not afterwards.
- [ ] 5.3 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
      Steps 2 to 4 touch the database, so each one's suite must assert it ran
      rather than skipping, and `bun run test:db` is the run that counts.
