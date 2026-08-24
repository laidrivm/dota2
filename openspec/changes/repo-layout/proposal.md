# Give every kind of file a directory, and a check that keeps it there

## Why

More than half the tracked files at the repository root are one thing — the
nightly snapshot job — and nothing in the tree says so. `design.md` holds the
census and the date it was taken; this is its consequence. They arrived over
twelve pull requests because no directory existed to receive them, and the
next three queue entries add roughly as many again:
`snapshot-build`'s eight task groups, `snapshot-ingest`'s entry point, and
Task 7's Dockerfile. The root reaches about ninety files, and Task 7 in
particular needs the tree to answer a question it currently cannot — which
files the served container needs and which the cron job does, since
`.dockerignore` and the `COPY` steps have to name them.

Now is the cheap moment: no branch is open, `snapshot-ingest` group 11c is
merged, and `snapshot-build` has not started. Every later moment moves files
underneath work in flight.

## What Changes

- The nightly job's files move to `src/job/`: the database edge and the
  schema at its top, the pulls and the staging write under
  `src/job/ingest/`. `build/` and `export/` are named for `snapshot-build` to
  fill; git tracks no empty directory, so they are a documented contract
  rather than directories this change creates.
- The HTTP server's six files move to `src/server/`. Four of its path
  resolutions are anchored to the module rather than the repository and are
  re-anchored as part of the move.
- The nine tests that assert things about the repository itself — the
  rulebook's shape, the permission policy, the commit gates, the ownership
  map, skill provenance, the review-bot configuration — move to `checks/`,
  which is new. `scripts/` keeps the executable gates and the tests that
  exercise them.
- `readme-map.test.ts` lists the tracked tree with `git ls-files` run at its
  own directory and no repository root resolved. That is correct only while
  the file sits at the root; the move makes it wrong, so it adopts the
  `rev-parse --show-toplevel` form five other sites in this repository
  already use.
- A new check refuses a source file added to the repository root, scoped by
  the configuration files it exempts rather than by an enumeration of what it
  covers. Without it the root refills the way it filled the first time.
- The README gains a section stating where each kind of file lives and why,
  so a reader placing a new file does not have to read the check to learn the
  answer.

No behaviour of the application, the job or the served bundle changes. This
is a move, a check and a document.

## Capabilities

### New Capabilities

- `repo-layout`: which directory a file of each kind belongs to, the check
  that refuses one placed outside it, and the README section that states the
  contract for a reader.

### Modified Capabilities

None. `module-boundaries` names `src/model.ts`, `src/types.ts` and
`src/app/**`, none of which move. `repo-onboarding`'s ownership map names
only paths under `docs/`, `scripts/`, `openspec/`, `tasks/`, `spec-inbox/`
and `.claude/`, none of which move either — so the map needs no path edit and
its criteria are unchanged. `change-slicing` owns the per-file line cap,
which this change neither touches nor duplicates.

## Non-goals

- **No new import restriction.** The split makes "the client never imports
  from the job" expressible for the first time, and nothing does it. A rule
  with no violation and no caller is a rule bought on speculation; it becomes
  a `module-boundaries` requirement when something tries.
- **No renaming.** A file that moves keeps its name, so `git log --follow`
  and every prose mention of a module by name survive the change.
- **No re-cutting of modules.** `contest.ts` holding both the ban pull and
  the totals, `stratz.ts` holding transport and pacing together — those are
  questions about module seams, not about directories, and answering one here
  would hide it inside a move.
- **`index.html` stays at the root**, where `bun build ./index.html` and the
  bundler convention both expect it.
- **`scripts/` does not move.** Its tests sit beside the scripts they
  exercise, which is the correct arrangement and not the one being fixed.

## Impact

- **Free by measurement**: a pure rename is 0 lines against `diff-budget`.
  Measured on a throwaway branch — `contest.ts` and `contest.test.ts` moved
  to `src/job/` reported `PASS — 0 lines (0 source / 0 test)`, git showing
  `similarity index 100%` with no hunks. A commit that moves *and* edits in
  one step loses rename detection and is counted in full, which is why the
  moves and their fix-ups are separate commits.
- **No configuration edit is expected**: `biome.json`, `stryker.config.json`,
  `package.json` and `bunfig.toml` name only paths that stay put. Confirmed
  by reading each; the check that this holds is that the suite passes after
  the move rather than a claim made here.
- **Imports across the new boundaries: one.**
  `agent-permissions-allow.test.ts` imports `./bunfig.toml`. The server trio
  imports only itself and node/bun builtins; the job's modules import only
  each other. Everything else is internal to a directory that moves whole.
- **Path resolution across the new boundaries: five.** Four in the server —
  `dist/`, `src/app/styles/fonts/`, `src/fixtures/snapshot.json` and
  `icons/`, each built with `new URL("./…", import.meta.url)` — and one in
  `readme-map.test.ts`. `db.ts` resolves `schema.sql` beside itself and is
  correct as long as the two move together, which is why they do.
- **Ordering**: ahead of `proposal-slicing` and everything under it, so that
  `snapshot-build` lands into the shape rather than beside it.
  `tracked-file-sweep`, further down the queue, lifts the tracked-tree
  listing this change fixes one copy of; that copy is touched twice, which is
  a cost, not a conflict.
