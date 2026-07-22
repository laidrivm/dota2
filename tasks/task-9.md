# Task 9 — Unit test setup: make the pre-push gate real

## Context

The repo has zero test files. `bun test --pass-with-no-tests` in the
pre-push hook keeps the gate green over an empty suite — a placeholder
that must die the moment real tests exist, or the gate protects nothing.
`bun test` also runs in no workflow, only in a hook that `--no-verify`
bypasses.

Policy (what a test may assert, how `/zombies` findings route) already
lives in `docs/testing.md`. This task adds mechanics, and only the
mechanics the first tests actually force.

Facts you must respect:

- Bun's runner is native (`bun test`, `bun:test`) — this task adds no
  dependency, no runner config file, no coverage tool.
- Phase 1 supplies the first subjects (the 6 acceptance tests of
  model-spec §7 against the fixture). Do not invent test subjects here.
- This task changes how an existing gate behaves, so per
  `docs/feature-workflow.md` it enters the OpenSpec cycle.

## Steps

1. Remove `--pass-with-no-tests` from the `pre-push` hook in
   `package.json` once the first real test exists; update the README
   "Git hooks" bullet and the note in `tasks/task-6.md` that mark the flag
   for removal.
2. Add a `bun test` job to `lint.yml` — same pinned bun version and
   `--frozen-lockfile` install as its neighbours. The hook alone is not an
   option: `--no-verify` bypasses it, so CI is the only gate that holds.
3. Record in `docs/testing.md` what the first tests settled: where test
   files live, how the fixture is loaded, how to run one file or one test
   by name. Mechanics only — do not restate the policy already there.

## Acceptance criteria

- [ ] `--pass-with-no-tests` gone; an empty or broken suite fails both the
      pre-push hook and CI.
- [ ] `bun test` runs in CI on the pinned bun version.
- [ ] `docs/testing.md` covers file layout, fixture loading, and running a
      single test by name.
- [ ] No new dependency and no runner config file in the diff.
