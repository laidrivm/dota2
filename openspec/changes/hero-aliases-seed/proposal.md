# hero-aliases-seed

## Why

The picker's search already matches a hero through its legacy Dota 1 name and
through the abbreviation players actually type — `bone` reaches Clinkz, `wk`
reaches Wraith King. The type carries `aliases`, the schema carries
`hero_aliases`, the export reads that table and the client searches what it
returns. Every part of the path is written, tested and shipped.

Nothing fills the table. Measured on the live bundle at
`d2ass.laidrivm.com/snapshot.json` on 2026-08-29: **0 of 127 heroes carry a
non-empty `aliases`**. `src/job/schema.sql` says so in as many words —
"Seeded by hand: no source publishes them, and the ingest neither writes nor
reads this table" — and nobody has yet done the seeding by hand. The feature
is a data gap wearing the costume of a missing feature, and every session it
survives is one where a player types `wk` into a search field built to answer
it and gets nothing.

## What Changes

- The alias table gains a source: a tracked seed of English legacy names and
  abbreviations that the nightly job applies. When it runs and what replacing
  it means are `hero-reference`'s to state.
- **BREAKING** (bundle contract): the exported hero entry carries the two
  alias kinds separately, so the client can tell them apart. The exact shape
  is in `design.md`; what the export must refuse is `snapshot-export`'s.
- The picker's result order stops being alphabetical alone and starts
  depending on what matched. The precedence is `hero-picker`'s.

## Capabilities

### New Capabilities

None. Every requirement this change adds belongs to a capability that already
exists, and a capability holding one hand-maintained table would be a heading
rather than a boundary.

### Modified Capabilities

- `hero-reference`: gains the seeded alias table — what the seed holds, when
  it is applied, and what replacing it whole means for an alias removed from
  the file.
- `snapshot-export`: the rendered hero entry carries `abbreviations` beside
  `aliases`, and the runtime assertion over `SnapshotBundle` covers both.
- `hero-picker`: matches are ordered by what matched before they are ordered
  by name.

## Non-goals

- **Cyrillic and transliteration.** The seed is English only. `шейкер` and
  `фурик` are real things players type, and answering them is a change with a
  different shape — it needs a normalisation step in the search, not more
  rows in a table.
- **Fuzzy or substring matching.** `hero-picker` fixes prefix-of-a-word
  matching and refuses `ing` → Wraith King on purpose; this change adds rows
  the existing matcher reads and does not touch the matcher's rule.
- **Resolving collisions.** `es` reaching both Earth Spirit and Ember Spirit
  is the intended answer, not a defect: the picker shows both and the player
  chooses. No disambiguation, no single-winner rule.
- **A source for the aliases.** No API publishes them; this change does not
  go looking for one, and the seed stays hand-maintained.
- **Every other gap the same survey found.** Side deltas, pick-phase deltas,
  score calibration, ban weighting and match harvesting are separate changes.

## Impact

- `src/job/` — a tracked SQL seed, and one call in `ingest.ts` after
  `upsertHeroes` at line 52.
- `src/job/export/render.ts` — `entry()` at line 184 currently maps alias rows
  to their `alias` alone and drops `kind`; it splits into two arrays instead.
- `src/types.ts` — `HeroEntry` gains `abbreviations: string[]`. The model
  never reads either field, so `computeModel` is untouched.
- `src/app/picker/search.ts` — `matchHeroes` gains a sort key, and reads
  both alias arrays defensively for the bundle cached before the split.
- `src/app/picker/search.test.ts` — one existing case asserts an order this
  change inverts, so it is rewritten rather than left to fail.
- `src/job/db.fixture.ts` — `hero_aliases` joins the sentinel range the test
  database's cleaner reclaims. Until it does, no suite may write to the table
  at all: the cleaner's `DELETE FROM heroes` would fail on the foreign key
  and take every other database suite with it.
- `src/fixtures/snapshot.json` — regenerated to carry the new field, since
  the export asserts the bundle against `SnapshotBundle` and the fixture is
  what the client is served until a run publishes.
- No new dependency, no new table, no schema migration: `hero_aliases` and
  its `kind` constraint already exist.
- `PLAN.md`'s open entry on hero-tile lettering collisions rests on the
  fixture's aliases being "a partial source ... for 33 of the 128". This
  change does not settle that entry, and does not change what the fixture
  carries — but it makes the same data real in the published bundle, which is
  the source that entry would have to draw on. The entry is reconciled in the
  step that merges last, not silently left reading as though nothing moved.
