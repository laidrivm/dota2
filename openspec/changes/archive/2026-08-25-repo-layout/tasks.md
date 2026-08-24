# Tasks — repo-layout

Four groups on `feat/repo-layout-1` … `-4`, in order, one pull request each.
The moves come first and the check last, because the check passes only over
the tree groups 1 to 3 leave — landing it first would ship a gate that fails.

Every group commits its moves before its fix-ups. A commit that moves a file
and edits it in the same step loses git's rename detection and is counted in
full by `diff-budget`, where a pure move is counted as nothing
(measured — see `design.md`).

Numbers in brackets are this change's `/zombies` ideas, kept so a task and the
edge it closes can be read against each other.

## 1. The nightly job

Planned as the free group and it was not; both fix-ups are recorded here
because groups 2 to 4 inherit the reasoning. Every import inside it is relative
and internal, which does not mean unchanged: sectioning puts a boundary inside
the group, and the five ingest suites reading `db.fixture.ts` take `../`.
`db.ts` does keep `schema.sql` beside it, as planned. And the move reorders the
files bun discovers, which is an input every suite sharing the database has —
`db.test.ts` stopped running first, so the rows it left outside the cleaner's
sentinel range reached the suites after it. Its evidence is `bun run test:db`;
`bun test` is green either way.

- [x] 1.1 Move the database edge to `src/job/`: `db.ts`, `db.test.ts`,
      `db.fixture.ts` and `schema.sql`, together and in one commit, because
      `db.ts` resolves its schema as `${import.meta.dir}/schema.sql` and the
      adjacency is what keeps that correct. (Req: repo-layout — The
      repository root holds only what is exempted by name)
- [x] 1.2 Move the pull, transport and staging files to
      `src/job/ingest/`: `stratz`, `patches`, `heroes`, `meta`, `contest`,
      `pairs`, `icons`, `staging` and `ingest`, with their tests and
      fixtures. (Req: repo-layout — The repository root holds only what is
      exempted by name)
- [x] 1.3 Run `bun run test:db` and confirm `db.ts` still applies
      `schema.sql` — a schema silently not applied fails every database
      suite on a missing table rather than on its cause [23]. (Req: none —
      evidence that 1.1 landed, closing no criterion of its own)

## 2. The HTTP server

The risky group, and the one whose own tests cover the risk: four path
resolutions are anchored to the module rather than the repository, and
`build.test.ts`'s header already says this failure is silent — the app still
builds, it just cannot load its fonts or its snapshot.

Two things the plan did not foresee, both owned by 2.2 and 2.4 below rather
than left in this prose: `scripts/dev.ts` imports `../server.ts` and stays
where it is, and `build.test.ts` anchors on `import.meta.dir` at three more
sites the count of four never reached.

- [x] 2.1 Move `server.ts`, `dist-routes.ts`, `static-routes.ts`,
      `static-routes.test.ts` and `build.test.ts` to `src/server/`, in a
      commit that only moves. (Req: repo-layout — The repository root holds
      only what is exempted by name)
- [x] 2.2 Re-anchor the four `new URL("./…", import.meta.url)` resolutions to
      the repository root: `dist/` in `dist-routes.ts`, and
      `src/app/styles/fonts/`, `src/fixtures/snapshot.json` and `icons/` in
      `static-routes.ts`. Then `scripts/dev.ts`'s `await import("../server.ts")`,
      which crosses out of the group because `scripts/` stays where it is.
      (Req: repo-layout — The repository root holds only what is exempted by
      name)
- [x] 2.3 Extend `static-routes.test.ts` so that serving a font asserts which
      directory was resolved, not only that the route answered — the anchor
      is what moved, and a route answering from
      `src/server/src/app/styles/fonts/` would answer nothing at all [21].
      (Req: repo-layout — The repository root holds only what is exempted by
      name)
- [x] 2.4 Extend `build.test.ts` the same way for `dist/` [22], re-anchoring
      its own three `import.meta.dir` sites first — the dist path, the cwd
      `bun run build` is spawned in, and the symlink target — none of which
      the count of four in 2.2 reached. Then the icon mirror's default, which
      is the one anchor no request can report on: the lookup turns a missing
      directory into an empty listing, so a wrong one 404s every hero exactly
      as a clone that never ran the ingest does. (Req: repo-layout — The
      repository root holds only what is exempted by name)

## 3. The repository's own checks

- [x] 3.1 Move the nine artefact tests to `checks/`: `rulebook.test.ts`,
      `readme-map.test.ts`, `skill-provenance.test.ts`,
      `coderabbit-config.test.ts`, `commit-gates.test.ts`, and the four
      `agent-permissions` files. Moves only. (Req: repo-layout — The
      repository root holds only what is exempted by name)
- [x] 3.2 Take `join(import.meta.dir, "..")` across the nine where they read
      a repository artefact, and `../bunfig.toml` in
      `agent-permissions-allow.test.ts`, which is the one import crossing a
      new boundary. (Req: repo-layout — The repository root holds only what
      is exempted by name)
- [x] 3.3 Write the regression first, then fix it: `readme-map.test.ts`
      resolves every mapped path when run from `checks/` [24], which it does
      not today — it lists the tree with `git ls-files` at its own directory
      and resolves no repository root, so from `scripts/` the same call
      returns 33 paths instead of 382. Then adopt the
      `rev-parse --show-toplevel` form the other listing sites already use,
      which `design.md` counts. (Req:
      repo-layout — A check reads the tracked tree from the repository root)
- [x] 3.4 Cover the general form of that criterion: a check listing the
      tracked tree, run from a directory below the root, still reads the
      whole repository with paths named relative to the root [10]. (Req:
      repo-layout — A check reads the tracked tree from the repository root)

## 4. The check and the document

Last, because it is the ratchet: it passes only over the tree groups 1 to 3
leave.

- [x] 4.1 Write the scan's tests over fabricated trees, tests first: a root
      of exempted files only reports nothing [1]; one unexempted `.ts` is
      reported, naming the file and that the list does not name it [3]; two
      unexempted files are both reported [4]; a file one directory down is
      not [6]; a root dotfile is subject to the list like any other, a
      leading dot being no implicit pass [7]. (Req: repo-layout — The
      repository root holds only what is exempted by name)
- [x] 4.2 Write the could-not-measure tests: a scan that matched no root file
      at all fails rather than reporting a clean root [2], the shape
      `scripts/file-size.ts` already takes for a sweep that matched nothing;
      and `git` exiting non-zero fails with its own stderr rather than
      reporting one [13]. (Req: repo-layout — The repository root holds only
      what is exempted by name)
- [x] 4.3 Write the exemption list's own tests: an entry naming a path the
      repository no longer tracks fails rather than lingering unnoticed [8],
      and an entry whose reason is empty is refused [9]. (Req: repo-layout —
      The repository root holds only what is exempted by name)
- [x] 4.4 Write the non-regular-entry tests: a tracked-but-deleted root entry
      is skipped rather than crashing the scan [11], and a root symlink is
      skipped rather than read as a file [12] — `git` lists both, and neither
      is a file placed in the wrong directory. Then the subdirectory test:
      the scan run from below the root still reads the whole repository [10].
      (Req: repo-layout — The repository root holds only what is exempted by
      name / A check reads the tracked tree from the repository root)
- [x] 4.5 Implement `scripts/repo-layout.ts`: the tracked listing taken at the
      repository root, scoped to root-level entries, each admitted only by a
      named exemption carrying its reason. Scoped by what it exempts and not
      by the extensions it covers — `scripts/file-size.ts` argues the opposite
      departure for the line cap, and `design.md` says why the two differ.
      (Req: repo-layout — The repository root holds only what is exempted by
      name)
- [x] 4.6 Add the repository sweep: the tree as it stands reports no file
      [14], every remaining root file being named. This is the task that
      fails until groups 1 to 3 have landed. (Req: repo-layout — The
      repository root holds only what is exempted by name)
- [x] 4.7 Write `checks/readme-layout.test.ts`, tests first: a README with no
      layout heading fails rather than passing over an absent section [15];
      a section parsing to zero directories fails [16]; a named directory the
      repository tracks a file under passes [17]; a directory marked reserved
      is not required to exist [18]; one named without that mark and tracking
      nothing fails [19]; a directory present on disk but tracked by nothing
      does not satisfy a row [20]. It resolves the repository root before
      listing, like everything else in `checks/` — from its own directory
      [20] would examine `checks/` alone and pass every row by finding
      nothing. (Req: repo-layout — The README states where each kind of file
      lives / A check reads the tracked tree from the repository root)
- [x] 4.8 Write the README layout section: each directory that holds source,
      what belongs in it, and why the tree is cut that way — with
      `src/job/build/` and `src/job/export/` marked reserved for
      `snapshot-build`. `src/job/main.ts` is `snapshot-ingest` group 12's
      entry point and goes in the prose beside the table, not in it: the rows
      assert a tracked file *under* a path, which cannot express a path that
      is itself the file. (Req: repo-layout — The README states where each
      kind of file lives)
- [x] 4.9 Update `PLAN.md`: collapse this change's queue entry to its name,
      pull requests, archive path and where its spec landed, per that file's
      growth protocol. Done in two halves, because the protocol evicts an
      entry on *its change reaching the archive*: group 4 made the entry read
      as applied and name its pull requests, and the archive step supplied the
      archive path and the spec's landing site. (Req: none — bookkeeping the
      workflow requires, closing no criterion)
