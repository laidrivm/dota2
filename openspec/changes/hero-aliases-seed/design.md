# hero-aliases-seed — design

## Context

Every part of the alias path exists and none of it carries data.
`src/job/schema.sql:33` declares `hero_aliases (hero_id, alias, kind)` with
`kind` constrained to `legacy` or `abbrev`; `src/job/export/render.ts:79`
selects from it; `render.ts:192` maps the rows to `alias` alone;
`src/types.ts:66` declares `aliases: string[]`; and
`src/app/picker/search.ts` already matches a query against
`[hero.name, ...hero.aliases]` by word prefix. The live bundle carries
`aliases: []` for all 127 heroes because no statement has ever written to the
table.

The seed is therefore a data change with two small contract changes attached:
carrying `kind` out to the client, and using it to order matches.

## Goals / Non-Goals

**Goals:**

- `hero_aliases` filled from a tracked file, on every run, idempotently.
- A removal from the file reaching the database and the bundle.
- `kind` surviving the export, so the picker can order by it.

**Non-Goals:** as the proposal's *Non-goals* fixes them — Cyrillic, fuzzy
matching, collision resolution, and a published source for aliases.

## Decisions

### The seed is SQL, applied by the job, not JSON read by it

`src/job/db.ts:connect()` already applies a tracked SQL file with
`sql.unsafe(await Bun.file(...).text()).simple()`; the comment there records
why the simple protocol and why `unsafe` is safe for a file this repository
owns. A second SQL file reuses that mechanism whole.

The alternative was a JSON file with a reader, a shape validation, an upsert
writer, a place in the run sequence and tests for each — roughly sixty lines
of new code whose only purchase is that the file could be edited without
knowing SQL. It is edited by one person, rarely. Rejected.

The cost of SQL is that a malformed seed is a run failure rather than a
validation message. That is the behaviour wanted: the alternative to failing
is publishing a bundle whose aliases silently disagree with the file.

### Applied after `upsertHeroes`, not with the schema

`hero_aliases.hero_id` references `heroes`. `schema.sql` is applied on
connect, before the ingest has upserted a single hero, so a seed carried
inside it fails its foreign key on any fresh database — and `connect()` is
what every database-backed test calls.

The seam is `src/job/ingest/ingest.ts:52`, immediately after
`await upsertHeroes(deps.sql, heroes, at)` and before the pulls. Heroes exist
by then, and the export three steps later reads a filled table.

An alias for a hero id no run has seen is a foreign-key failure, which is the
behaviour the spec asks for: a typo in the seed stops the run rather than
publishing 126 heroes' aliases and dropping one.

### Replace whole, not `ON CONFLICT DO NOTHING`

`DELETE FROM hero_aliases; INSERT INTO hero_aliases ...` states what is true.
`ON CONFLICT DO NOTHING` states what has ever been true: an alias deleted
from the file stays in the database for ever, and the file and the table
drift with nothing reporting it.

The table holds a few hundred rows, is referenced by nothing, and is rebuilt
in milliseconds, so the usual reason to prefer an incremental upsert does not
apply.

Atomicity comes free from the mechanism already chosen: a multi-statement
simple query is executed by PostgreSQL inside one implicit transaction unless
the string carries its own transaction control. The seed therefore carries no
`BEGIN`/`COMMIT` and gets the rollback anyway. This is the one decision here
resting on a claim about the driver rather than about our own code, so the
spec's *A seed that fails part way* scenario tests it rather than trusting it.

### Two arrays, not one array of objects

`kind` has to reach the client. Two shapes were considered:

| | `aliases: {alias, kind}[]` | `aliases: string[]` + `abbreviations: string[]` |
|---|---|---|
| Client-side ordering | read `kind` per entry | positional — which array matched is the rank |
| `search.ts` change | destructure every entry | one more array in the list it already walks |
| Export assertion | a new object shape to assert | the string-array assertion already written |
| Fixture | every alias rewritten | one key added |

The second is taken. The split is exactly the `CHECK (kind IN ('legacy',
'abbrev'))` the schema already enforces, so no third state can arrive, and
the picker's ordering falls out of which array matched rather than out of a
field it has to inspect.

`aliases` narrows in meaning from "every alias" to "legacy names". Nothing
outside this repository reads the bundle, and the export and the client ship
together, so the narrowing costs a fixture regeneration and nothing else.

### Ranking is a bucket, not a score

`matchHeroes` currently filters and sorts by name. It gains a per-hero rank —
0 for a match on the hero's own name, 1 on an abbreviation, 2 on a legacy
alias, taking the lowest where more than one matched — and sorts by
`(rank, name)`.

No score, no match length, no popularity. A score would need tuning, a
justification and a test per weight, to order a list the player reads whole
in one glance.

## Risks / Trade-offs

- **The seed and the fixture drift.** `src/fixtures/snapshot.json` is what
  the client is served until a run publishes, and it carries its own aliases.
  → The fixture is regenerated as part of this change and its generator is
  the same one that produced it before; the export's runtime assertion
  catches a shape mismatch, not a content one.
- **A hand-maintained list ages.** New heroes arrive with no alias and
  nothing reports it. → Out of scope to automate, but the seed is one file to
  open, and a hero with no alias is searchable by name as before.
- **Bundle contract change in flight.** A client holding a cached bundle
  without `abbreviations` meets a build expecting one. → `search.ts` reads
  the field defensively for one release, or the cache is keyed by
  `snapshotId`, which it already is; the served bundle is revalidated by
  ETag per `snapshot-export`.
- **`DELETE` then `INSERT` on every run.** A run that fails mid-seed leaves
  the table as it was, but a run that succeeds rewrites rows nothing changed.
  → The table is small and nothing reads it between the two statements.

## Open Questions

- Which abbreviations are canonical enough to seed. `wk`, `am`, `cm`, `pl`,
  `es` are unambiguous as *strings*; whether `es` should reach both spirits
  is settled (it should). The list itself is written in the first step and
  reviewed there, not decided here.
