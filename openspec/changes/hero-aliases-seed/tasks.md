# hero-aliases-seed — tasks

Four steps, four pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers.

## 1. The seed file and when it is applied

Closes `hero-reference/a-fresh-database`,
`hero-reference/the-seed-names-a-hero-the-reference-does-not-hold`,
`hero-reference/applied-twice`.

- [ ] 1.0 Add `hero_aliases` to the sentinel reclaim in
      `src/job/db.fixture.ts`, before the `DELETE FROM heroes` at line 73.
      Its own comment fixes why this comes first: a table left out of the
      list is one no suite may write to at all, because the hero delete then
      fails on the foreign key and takes every other database suite with it.
- [ ] 1.1 Decide how the seed's application is exercised without writing
      real hero ids to the shared database. The shipped seed names ids
      1–145 and the cleaner reclaims only `>= 9000`, so a test applying the
      shipped file breaks the sentinel rule outright: the applier takes the
      file path as an argument and the suite passes it a sentinel-range
      substitute.
- [ ] 1.2 Write the failing cases first (ZOMBIES 1, 3, 4, 5, 8, 9): an empty
      table fills; a fresh database with no `heroes` rows at connect time
      does not fail the foreign key; a second run neither duplicates nor
      grows; every seeded id resolves in `heroes`; an unknown hero id fails
      the run and names the id; a `kind` outside the CHECK fails on the
      schema. These need a database, so they run under `bun run test:db` and
      must assert they ran rather than skipping. The `kind` case is a
      regression guard on the schema's own CHECK and closes no criterion —
      `docs/testing.md` admits an uncited test, and inventing a criterion to
      give it one would put a constraint in the spec that this change was
      never asked to add.
- [ ] 1.3 Write `src/job/aliases.sql` — the English legacy names and
      abbreviations, one `INSERT` carrying `hero_id`, lower-case `alias` and
      `kind`. Seed every hero that has an alias worth typing; a hero with
      none contributes no row.
- [ ] 1.4 Apply it from `src/job/ingest/ingest.ts`, immediately after
      `upsertHeroes` at line 52, by the mechanism `src/job/db.ts:connect()`
      already uses for `schema.sql` — `Bun.file(...).text()` through
      `sql.unsafe(...).simple()`.
- [ ] 1.5 Lower-case every alias in the seed, and assert it (ZOMBIES 7) —
      `matchHeroes` lowercases the query and compares against stored text, so
      a capital in the table is a row nothing can ever match.
- [ ] 1.6 Confirm on a real database that the bundle the export renders now
      carries non-empty `aliases`, and record the count against the 0 of 127
      the proposal measured.

## 2. Replacing the table whole

Closes `hero-reference/an-alias-removed-from-the-file`,
`hero-reference/a-seed-that-fails-part-way`.

No production code beyond what step 1 lands: the seed is a `DELETE` followed
by an `INSERT` from the start. This step proves the two properties that
choice was made for, and the rollback one rests on a claim about the driver
rather than about our own code — that a multi-statement simple query runs in
one implicit transaction — which is exactly why it is tested and not trusted.

- [ ] 2.1 Test that an alias absent from the file is absent from the table
      after the next run, starting from a table that holds it (ZOMBIES 11).
- [ ] 2.2 Test that a seed raising between the delete and the end of the
      insert leaves the table as it was (ZOMBIES 10).
- [ ] 2.3 Test that one alias text may belong to two heroes (ZOMBIES 6) —
      the primary key is `(hero_id, alias)`, and a whole-table replace must
      not quietly become an `alias`-unique one.

## 3. The bundle carries both kinds

Closes `snapshot-export/a-hero-with-no-alias-of-one-kind`,
`snapshot-export/an-alias-rendered-under-the-wrong-kind`.

- [ ] 3.1 Write the failing cases first (ZOMBIES 12, 13, 17, 18): a hero
      whose rows are all `abbrev` renders `aliases` as `[]` and publishes; a
      hero with one row of each kind renders each into its own array and
      neither into the other; a missing `abbreviations` fails the export; a
      non-string member fails it.
- [ ] 3.2 Add `abbreviations: string[]` to `HeroEntry` in `src/types.ts`, and
      narrow the doc comment on `aliases` to legacy names.
- [ ] 3.3 Split the rows by `kind` in `render.ts`'s `entry()` — it already
      selects the column and discards it at line 192.
- [ ] 3.4 Extend the export's runtime assertion over `SnapshotBundle` to both
      arrays, and to a member that is not a string — `contract.ts:71` already
      declares `aliases: texts`, so this is that line twice.
- [ ] 3.5 Check `abbreviations` passes the camelCase assertion
      `render-shape.test.ts:32` applies at every depth (ZOMBIES 16).
- [ ] 3.6 Widen the test citing `snapshot-export/a-field-of-the-wrong-type`.
      This change edits that criterion's text — a non-string member of an
      alias array joins the string `"0.13"` as a shape the export refuses —
      and the heading is unchanged, so the existing citation still resolves
      while the existing assertion no longer covers the whole criterion. A
      criterion that grew under a citation nobody widened is the one kind of
      coverage gap the floor cannot see.
- [ ] 3.7 Check the four other criteria this requirement already carried
      still pass unchanged: `snapshot-export/the-client-s-own-check`,
      `snapshot-export/a-hero-entry-missing-a-field-the-client-never-checks`,
      `snapshot-export/a-component-rendered-as-zeros-throughout`,
      `snapshot-export/a-number-that-is-not-finite`. The first two read the
      hero entry this change adds a key to.
- [ ] 3.8 Regenerate `src/fixtures/snapshot.json` with the new key, and check
      the existing export and delivery suites still pass against it.

## 4. The picker ranks by what matched

Closes `hero-picker/the-three-kinds-are-ordered-against-each-other`,
`hero-picker/two-heroes-matched-the-same-way`,
`hero-picker/a-hero-matching-on-two-kinds-at-once`.

- [ ] 4.1 Write the failing cases first, against `matchHeroes` directly
      (ZOMBIES 19, 20, 21, 22): the three-way order holds against
      alphabetical order; `es` returns both spirits adjacent in name order; a
      hero matching on two kinds appears once, at the higher rank; the name
      order still holds within one bucket for three or more heroes, so the
      sort is `(rank, name)` and not `rank` alone.
- [ ] 4.2 Give `matchHeroes` a rank per matched hero — 0 name, 1
      abbreviation, 2 legacy, lowest wins — and sort by `(rank, name)`.
- [ ] 4.3 Rewrite `search.test.ts:56` (ZOMBIES 24). It asserts `names("ni")`
      is `["Enigma", "Night Stalker"]` — Enigma through the alias `nigma`,
      Night Stalker through its name — and ranking inverts that pair. Both
      the assertion and the title "still in name order" become false. The
      behaviour it guards is still worth asserting, so it is rewritten, not
      deleted.
- [ ] 4.4 Check that all six criteria this requirement already carried still
      pass unchanged — none is this change's to close and every one of them
      reads the list ranking now reorders:
      `hero-picker/alias-match`, `hero-picker/abbreviation-match`,
      `hero-picker/word-prefix-inside-a-name`,
      `hero-picker/not-a-substring-search`,
      `hero-picker/whitespace-only-query`,
      `hero-picker/search-field-has-focus-on-open`.
- [ ] 4.5 Check `matchHeroes` still returns `HeroEntry[]` (ZOMBIES 23) — the
      rank orders the list and never reaches the picker's contract. A
      regression guard closing no criterion, for the reason 1.2 gives.
- [ ] 4.6 Settle the stale-bundle case (ZOMBIES 25): a payload cached before
      this change carries no `abbreviations`, and spreading `undefined` in
      `matchHeroes` throws. Establish which it is — the client validates a
      fetched snapshot and the served bundle is revalidated by ETag, so a
      stale payload may already be unreachable — and read `src/app/storage.ts`
      to find out rather than adding a guard against a case that cannot
      arise.
- [ ] 4.7 Re-read `search.ts`'s header comment: it explains why the first
      match is positional and why the picker needs no scoring. Ranking is a
      bucket, not a score, so the comment stays true — confirm that rather
      than assume it.

## 5. Closing the change

- [ ] 5.1 Update `PLAN.md`'s queue in the pull request that merges the last
      step, not afterwards — including the hero-tile lettering entry, whose
      "a partial source already exists ... for 33 of the 128" now describes
      the fixture alone and no longer the published bundle.
- [ ] 5.2 Amend `hero-picker`'s `## Purpose`, which reads "how its search
      matches names and aliases" and now leaves out abbreviations. A Purpose
      is prose rather than a requirement, so no delta carries it: it is
      edited when the delta is synced, or it drifts from the requirement
      directly below it.
- [ ] 5.3 Add the e2e bullet (ZOMBIES 26) to the backlog `PLAN.md` owns: a
      player opens the picker, types `wk`, and Wraith King is selectable.
- [ ] 5.4 Run the pre-PR sequence per `docs/review-toolkit.md` on every step.
