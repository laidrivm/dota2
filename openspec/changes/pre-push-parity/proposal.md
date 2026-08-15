# pre-push-parity

## Why

A pull request in `file-size-cap` split `src/model.test.ts` into three files and
left `stryker.config.json` naming the first. Stryker went on killing mutants
with 8 of the 34 cases, 185 survived against a floor of 67, and the branch was
pushed green: the type check passed, the suite passed, and the gate that had
broken runs only in CI. The push had already happened by the time anything
said so.

That gate is not alone. Ten checks run on a pull request; the push path runs
three of them — the type check, the suite, and the diff budget. Of the seven
left, six need no browser: `biome`, the YAML syntax check, the suppression
scan, `actionlint`, `gitleaks` and the mutation floor. Three of those are
measured at 0.24 s between them and the floor at 4.9 s, against a hook that
already takes 11.8 s; `actionlint` and `gitleaks` are unmeasured because
neither is installed here, which is itself why they have to be optional.

`coverage` is not among the seven in any useful sense: it runs the same suite
the hook already runs, and what is CI-only about it is the number, which
`smoke-suite` requires not to gate anything.

The second half of the problem is that nothing owns the answer. What the hook
runs is stated in fragments across four specifications, and two of them
disagree: `smoke-suite` says the hook runs "the type check and `bun test`
only", while `change-slicing` requires it to run the diff budget as well. The
"only" has been false since the budget landed, and a contradiction between two
live criteria is one nobody can be shown to have broken.

## What Changes

- The pre-push hook gains four checks it does not run today: `biome ci`, the
  YAML syntax check, the suppression scan, and the mutation floor with the
  Stryker run that feeds it.
- `actionlint` and `gitleaks` run from the hook when they are on `PATH` and are
  skipped silently when they are not — the shape `commit-gates` already sets
  for `gitleaks` before a commit, so a fresh clone still pushes.
- One requirement states what the hook runs, in `commit-gates`, whose stated
  purpose already spans both sides of the push. The fragments in `smoke-suite`
  and `mutation-floor` cede the list to it and keep only what is theirs: that
  the push path starts no browser, and that the mutation gate is not a
  `*.test.ts` file.
- The hook keeps blocking on a failure. The diff budget stays the one
  exception, absorbed as `change-slicing` already requires.

## Capabilities

### New Capabilities

None. `commit-gates` already declares itself as "what is checked before a
commit lands and before a pull request can pass", which is this fact's home; a
second capability beside it would split one answer across two files again,
which is the defect being fixed.

### Modified Capabilities

- `commit-gates`: gains a requirement naming every check the pre-push hook
  runs, which of them may be absent from a machine, and that a failure blocks
  the push.
- `smoke-suite`: its *push path is unaffected* scenario stops enumerating what
  the hook runs and keeps the browser ban, which is the part it owns.
- `mutation-floor`: the clause justifying a CI job "because `bun test` is what
  `pre-push` runs" is restated — the gate stays out of `bun test` for the
  reason it always had, a process per mutant, and now runs beside it.

## Non-goals

- **The browser suite on the push path.** `smoke-suite` bans it and this change
  keeps the ban. Playwright needs a built `dist/` and a served port; three
  seconds of run time hides a dependency on state the other checks do not have,
  and a flake there would train the agent to reach for `--no-verify`.
- **Coverage locally.** `smoke-suite` already requires it to be visibility
  rather than a gate, so running it before a push would report a number nobody
  is allowed to act on.
- **CodeRabbit.** It stays behind `/coderabbit-local`, invoked once per branch
  in the pre-PR sequence, not once per push.
- **Making the hook the gate.** `--no-verify` bypasses it and CI does not. The
  hook is where the answer arrives in seconds instead of minutes; the checks
  stay in CI unchanged.
- **A single `verify` script both the hook and CI call.** CI runs these as
  separate jobs on purpose — a job name is what says which gate failed, and one
  serial script would report the first failure and hide the rest.

## Impact

- `package.json`: the `simple-git-hooks.pre-push` command, and `bun run
  prepare` re-run so the hook on disk matches it.
- `README.md`: the hook section, which today lists two of the three checks the
  hook already runs.
- `openspec/specs/commit-gates/`, `openspec/specs/smoke-suite/` and
  `openspec/specs/mutation-floor/`.
- No new dependency. Stryker, biome and the two scripts are already installed;
  `actionlint` and `gitleaks` are already optional.
- Measured cost on the author's machine: 11.8 s today, about 17 s after.
