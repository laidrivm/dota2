# Design — the tree, the check, and what a pure move costs

## Context

The census, measured on 2026-08-24 and the only copy of these figures — the
proposal and `PLAN.md` describe the shape and cite this section rather than
restating a number that four pull requests stand between and today.

Sixty-one tracked files sit at the repository root. Thirty-three are the
nightly snapshot job, five are the HTTP server, nine are tests that assert
things about the repository itself, eleven are configuration and three are
the always-on documents. Only the last fourteen belong there by any
convention. `index.html` is counted among them rather than with the server it
is served by: the bundler entry point is a root citizen by convention, which
the non-goals keep it as.

The figures date, and none of the work below depends on them holding: the
groups move named files, and the scan in group 4 reads the tree it finds.

The job's files arrived over twelve pull requests of `snapshot-ingest`. No
directory existed to receive them, so each landed beside the last. The same
pressure is about to repeat at roughly the same scale: `snapshot-build` has
eight task groups, `snapshot-ingest` group 12 adds the entry point, and Task 7
adds a Dockerfile whose `COPY` steps and `.dockerignore` have to name what the
served container needs and what the cron job needs — a distinction the tree
cannot currently express.

`src/` already exists and holds the client (`src/app/**`), the prediction
model (`src/model.ts`, `src/types.ts`) and the fixtures. It is not a rival
arrangement to the root; it is the only part of the tree that was given a
directory.

## Goals / Non-Goals

**Goals:**

- One directory per kind of file, with the root left to configuration and the
  three always-on documents.
- A mechanism that refuses the next stray file, so the arrangement holds
  without anyone remembering it.
- A README section that answers "where does this new file go" without the
  reader opening the check.
- A move whose cost is measured rather than estimated.

**Non-Goals:**

- Renaming anything. Every file keeps its name.
- Re-cutting modules. Whether `contest.ts` should hold both the ban pull and
  the totals is a seam question; answering it inside a move would hide it.
- New import restrictions. See the proposal's non-goals.
- Moving `scripts/` or `src/app/`.

## Decisions

### One `src/`, not top-level `client/`, `server/`, `job/`

The rival shape puts the three deployable things at the root. It reads well
and it costs more than it returns here.

`module-boundaries` fixes that `src/model.ts` and `src/types.ts` never import
from `src/app/**`, enforced by a `biome.json` rule that names those three
paths literally. A root-level split rewrites the rule, its configuration, its
three scenarios and every spec sentence citing it — to buy a Dockerfile the
right to say `COPY job` instead of `COPY src/job`. Nothing else changes hands.

Keeping one `src/` also leaves `biome.json`, `stryker.config.json`,
`package.json` and `bunfig.toml` untouched, because every path they name —
`src/model.ts`, `src/app/styles/fonts`, `src/fixtures/snapshot.json`,
`./index.html`, `e2e/**` — stays where it is.

### `src/job/` is sectioned, with the database edge above the sections

```text
src/job/
  db.ts  db.test.ts  db.fixture.ts  schema.sql     the shared edge
  ingest/
    stratz · patches · heroes · meta · contest
    pairs · icons · staging · ingest  + tests + fixtures
  build/     reserved — snapshot-build
  export/    reserved — snapshot-build
  main.ts    reserved — snapshot-ingest group 12
```

`db.ts` is not ingest's. Its own header calls it "the database edge: one
connection with `schema.sql` applied to it", and `snapshot-build` reads
staging through the same edge. It sits above the sections because both use it.

It also resolves its schema as `${import.meta.dir}/schema.sql` — "beside this
module rather than inside it". The two therefore move together, and the
adjacency is load-bearing rather than tidy.

`build/` and `export/` are named and not created: git tracks no empty
directory. They are a contract this change writes down and `snapshot-build`
fills, which is why the spec's README requirement admits a directory marked
reserved without requiring a file under it.

The alternative — `src/job/` flat — was rejected on arithmetic. The job's
current file count is tolerable in one directory; `snapshot-build` adds about
twenty-five to it, and the sum is the same swamp one storey down.

### `checks/` is separate from `scripts/`

`scripts/` holds executable gates — `command-guard.ts`, `file-size.ts`,
`spec-coverage.ts`, `mutation-floor.ts`, `no-suppressions.ts` — each with its
tests beside it. The nine moving files have no script: they are assertions
about repository artefacts, read directly. `rulebook.test.ts` reads
`CLAUDE.md` and counts its sublists; `skill-provenance.test.ts` reads
`docs/review-toolkit.md`; `coderabbit-config.test.ts` parses
`.coderabbit.yaml`.

Folding them into `scripts/` would make the directory's name false for a
third of its contents. A sixth top-level directory is the cheaper lie to
avoid.

All nine reach their artefacts through `import.meta.dir` and so assume they
sit at the root. Under `checks/` they take `join(import.meta.dir, "..")` —
already the idiom at seven sites in `scripts/`, so nothing is invented.

### The check is scoped by exemption, and says why that differs from the cap

`scripts/file-size.ts` enumerates the extensions it covers and argues the
departure in its own header. This check does the opposite, and the two are not
in tension: an uncapped file type is merely unmeasured, where an unplaced file
is already in the wrong directory. A placement scan that admitted by extension
would pass silently on the first `.mjs`, `.sql` or `.sh` nobody had thought
of — which is how the root filled the first time.

So every tracked root file must be named, with its reason. Task 7 adding a
compose file adds one line, and that line is the decision being taken rather
than defaulted.

### The check lives in `scripts/`, its README half in `checks/`

The root scan has fabricated-tree logic worth unit-testing the way
`file-size.ts` is: `scripts/repo-layout.ts` plus `scripts/repo-layout.test.ts`,
gated by `bun test` rather than by a `package.json` script, which is how
`file-size` and `spec-coverage` already run.

The README layout section is an artefact assertion with no script, so it goes
to `checks/readme-layout.test.ts`, beside the `readme-map.test.ts` it
resembles. The capability is one; its two halves land in the two homes this
change has just defined, which is the arrangement being demonstrated rather
than an exception to it.

### Moves and fix-ups are separate commits

Measured on a throwaway branch: `contest.ts` and `contest.test.ts` moved to
`src/job/` reported

```text
DIFF gate: PASS — 0 lines (0 source / 0 test)
contest.test.ts => src/job/contest.test.ts | 0
contest.ts      => src/job/contest.ts      | 0
```

git reporting `similarity index 100%` and no hunks, which the awk in
`diff-budget.sh` counts as nothing. A commit that moves a file *and* edits it
loses rename detection and is counted in full — so each group commits its
moves first and its fix-ups after, and the budget reads what the reviewer
actually has to read.

## Risks / Trade-offs

**A path resolved relative to a module breaks silently on the move** → Five
sites are known and each is fixed in the group that moves it: four in the
server (`dist/`, `src/app/styles/fonts/`, `src/fixtures/snapshot.json` and
`icons/`, each `new URL("./…", import.meta.url)`) and one in
`readme-map.test.ts`. `db.ts` is the sixth and is handled by adjacency. The
server's four are covered by `build.test.ts` and `static-routes.test.ts`,
whose own header says the failure mode is silent — the fonts stop being
served and the app still builds — so the tests are the reason this is a
managed risk rather than an unmanaged one.

**`readme-map.test.ts` lists the tree at its own directory** → It runs
`git ls-files` with `cwd: import.meta.dir` and resolves no repository root.
Measured: the same call from `scripts/` returns 33 paths instead of 382, named
relative to that directory. Correct today only because the file is at the
root. The move breaks it loudly — every mapped path stops resolving — and the
fix is the `rev-parse --show-toplevel` form six other sites already use —
four under `scripts/` and two under `src/app/`, this being the only count of
them, which the proposal and the tasks cite rather than restate. The
spec turns that into a requirement so the accident cannot recur.

**The exemption list is friction for a legitimate new root file** → Accepted,
and it is the point. Task 7's compose file gets a line and a reason.

**`tracked-file-sweep` will touch the fixed listing again** → This change
repairs one copy of the tracked-tree listing; that queue entry lifts all
seven. One copy is written twice. Cheaper than leaving a known-wrong listing
in place through a move that depends on it.

**A pure move is invisible to the diff budget, so a group can be arbitrarily
large without the gate objecting** → Real, and the gate is right: zero lines
is what the reviewer reads. The groups are cut by concern anyway, so the
largest is one directory's worth of moves plus at most five fix-ups.

## Migration Plan

Four groups, four pull requests, in order:

1. **`src/job/`** — the job's files, the database edge above `ingest/`. No
   fix-up: every import inside the group is relative and internal, and
   `db.ts` keeps `schema.sql` beside it. The free one.
2. **`src/server/`** — five files, then the four `new URL` re-anchorings. The
   risky one, and the one its own tests cover.
3. **`checks/`** — nine files, then `join(import.meta.dir, "..")` across them,
   `./bunfig.toml` → `../bunfig.toml`, and the repository-root fix in
   `readme-map.test.ts`.
4. **The check and the document** — `scripts/repo-layout.ts` with its
   exemption list, `scripts/repo-layout.test.ts`, `checks/readme-layout.test.ts`,
   and the README section. Last, because it is the ratchet: it passes only
   over the tree groups 1 to 3 leave, and landing it first would mean shipping
   a check that fails.

Rollback is `git revert` per group; nothing outside the repository changes and
no deployed artefact moves.

## Open Questions

None blocking. Two settled by the user during exploration and recorded here so
the apply stage does not reopen them: `src/job/` is sectioned from the start
rather than flat, and `checks/` is separate from `scripts/` rather than folded
into it.
