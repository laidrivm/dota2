# Task 9 — Unit test setup: runner conventions and a real pre-push gate

## Context

The repo has zero test files. `bun test --pass-with-no-tests` in the
pre-push hook keeps the gate green over an empty suite — a placeholder
that must die the moment real tests exist, or the gate protects nothing.

`CLAUDE.md` (moving to `docs/testing.md` in task 8) states the *policy*:
tests assert behaviour, `/zombies` findings route by layer, scaffolding
tests are mortal. It states nothing *operational*: where test files live,
how they are named, how fixtures are shared, how to run one test. That gap
is what this task closes — policy stays, mechanics get added.

Facts you must respect:

- Bun has a native test runner (`bun test`, `bun:test` imports) — no
  vitest, no jest, no `@types/jest`. This task adds **no dependency**.
- Task 8 creates `docs/testing.md` by extracting the Testing section. This
  task appends to that file; if task 8 has not run, append to the Testing
  section of `CLAUDE.md` instead and leave the split to task 8.
- Phase 1 (model module) supplies the first real subjects: the 6
  acceptance tests of model-spec §7 against the fixture. Do not invent
  test subjects here — this task ships mechanics plus the gate change.
- The fixture (`fixture-snapshot.json`) arrives from the spec inbox under
  the camelCase contract; how it is loaded in tests is a decision this
  task records.
- This task changes how an existing gate behaves (pre-push), so per
  CLAUDE.md "Feature workflow" it enters the OpenSpec cycle rather than
  being applied directly.

## Steps

### 1. Fix the conventions

Decide and record, in this order of preference — colocation over a
mirrored tree, native over configured:

- File location and naming (`*.test.ts` next to the subject vs a `test/`
  tree). Whatever is chosen must match the glob the pre-push hook already
  runs, so no runner config is needed.
- How fixtures are loaded (a helper module vs direct import of the
  snapshot JSON) and where they live.
- What a test may import: the public entry point of a module, never its
  internals — an assertion against a private helper is the
  implementation-mirroring the policy forbids.

### 2. Drop the placeholder flag

Remove `--pass-with-no-tests` from the `pre-push` hook in `package.json`
once the first real test exists. An empty suite must then fail the push.
Update the README "Git hooks" bullet that documents the flag and the note
in `tasks/task-6.md` that marks it for removal.

### 3. Decide the CI position

`bun test` currently runs in no workflow — only in the hook, which
`--no-verify` bypasses. Add a job to `lint.yml` (or argue in the OpenSpec
design why the hook alone suffices). Same pinned bun version, same
`--frozen-lockfile` install as the existing jobs.

### 4. Populate `docs/testing.md`

Append an "Operational" section: how to run the suite, how to run a single
file or a single test by name, where fixtures live, the naming convention,
and how a `/zombies` finding becomes a test file. Keep it mechanics only —
do not restate the policy rules already in that file (single-source rule).

## Constraints

- Do NOT add a test framework, assertion library, or coverage tool. Bun's
  runner and `expect` are the whole toolchain.
- Do NOT add a runner config file to make a non-default layout work —
  change the layout instead.
- Do NOT write tests for code that does not exist yet; the subjects come
  from Phase 1.
- Do NOT weaken the gate to keep it green (no `|| true`, no skipped
  suites).

## Acceptance criteria

- [ ] Conventions (location, naming, fixture loading, import boundary)
      recorded in `docs/testing.md`, no runner config file added.
- [ ] `--pass-with-no-tests` removed from the pre-push hook; README and
      `tasks/task-6.md` no longer describe it as active.
- [ ] An empty or broken suite demonstrably fails both the pre-push hook
      and CI.
- [ ] `bun test` runs in CI on the pinned bun version with
      `--frozen-lockfile`, or the design argues the omission.
- [ ] `docs/testing.md` covers running one file and one test by name.
- [ ] No new dependency in `package.json`.
