# mutation-floor

## Why

`src/model.ts` is at 100% line and 100% function coverage from
`src/model.test.ts` alone. Coverage has therefore stopped being a signal here:
it cannot separate a test that asserts a value from one that merely executes a
line, and there is no headroom left for a coverage floor to guard.

The model is also the one place in the tree where a wrong sign, a wrong
comparison boundary or a dropped term produces a plausible number instead of a
crash — `computeModel` returns scores and a win probability that no caller can
sanity-check. A mutation floor is the only remaining mechanism that fails when
those lines are broken.

## What Changes

- `@stryker-mutator/core` is added as an exact-pinned devDependency, after
  `/warm`.
- `stryker.config.json` mutates `src/model.ts` only and runs the tests through
  the built-in command runner: `bun test src/model.test.ts`. There is no
  Stryker plugin for `bun:test` and none is needed — the command runner's
  documented cost is that it runs the whole suite per mutant, and that suite is
  53 ms.
- `scripts/mutation-floor.ts` runs Stryker, reads the survivor count out of its
  JSON report, and compares it against a floor constant declared in the script.
  The count is absolute, not a percentage: Stryker's own `thresholds.break` is
  a mutation-score percentage, which moves whenever the mutant total moves and
  so cannot carry a reason for a single admitted survivor.
- The floor may be lowered freely and raised only with a reason written on that
  line; a count below the floor also fails, naming the value to write, so the
  number tracks reality instead of drifting into a meaningless upper bound.
- An equivalent mutant is marked at the site it occurs, with
  `// Stryker disable next-line <Mutator>: <reason>`, and drops out of the
  count. That is the whole exemption mechanism — no register, no per-mutator
  exclusion in configuration.
- A new `.github/workflows/mutation.yml` job. Stryker declares
  `engines.node >= 20.0.0`, so this is the first job in the repository that may
  need `setup-node` beside `setup-bun`.
- `.gitignore` gains Stryker's sandbox and report directories.
- `docs/testing.md` gains the convention for marking an equivalent mutant.

## Capabilities

### New Capabilities

- `mutation-floor`: what is mutated, what kills a mutant here, how a survivor
  is admitted, and what the floor forbids.

### Modified Capabilities

None. `smoke-suite` owns the e2e suite and `commit-gates` owns the hooks;
neither states anything this change contradicts.

## Non-goals

- **Anything outside `src/model.ts`.** `src/app/session.ts` is the obvious
  second candidate — 422 lines of reducer, and it imports nothing from
  `model.ts`, so the two are cleanly separable. It is deliberately left out:
  the command runner runs one fixed command whichever file was mutated, so a
  single floor over two files is a number no one can move with a reason,
  because a change in either file shifts it. `session.ts` gets its own config
  and its own floor later, if this one earns it.
- **`src/types.ts`, which `PLAN.md` named alongside `model.ts`.** It holds
  types, `ROLES`, `EMPTY_SESSION` and `MODEL_CONSTANTS`; it has no branch and
  no arithmetic. The only mutants available there are literal edits to
  constants, and a test that dies on those is asserting the constants back at
  themselves rather than asserting behaviour.
- **A mutation-score percentage.** Reported by Stryker, ignored by the gate.
- **Driving survivors to zero.** The first measurement sets the floor.
- **Stryker's `typescript-checker`.** It exists to discard mutants that would
  not compile; under Bun the types are stripped and such a mutant simply runs,
  so the plugin buys nothing. TypeScript 7's native port also no longer exposes
  the compiler API the checker is built on.
- **The HTML report, the Stryker dashboard, and incremental mode.** A run this
  small needs none of them, and the dashboard would publish the repository's
  mutation data to a third party.
- **Replacing the coverage job.** `bun run test:coverage` stays as it is —
  visibility, not a gate.
- **Shipping the check as a `*.test.ts` file.** `spec-test-traceability` could
  do that because its check is milliseconds of file reading. This one spawns a
  process per mutant, and `pre-push` runs `bun test`.

## Impact

- New files: `stryker.config.json`, `scripts/mutation-floor.ts`,
  `.github/workflows/mutation.yml`. Modified: `package.json`, `bun.lock`,
  `.gitignore`, `docs/testing.md`.
- One new devDependency with 24 direct dependencies of its own, in a repository
  that currently has one runtime and six development dependencies. This is the
  largest single expansion of the dependency tree so far and the reason `/warm`
  runs before the install, not after.
- `src/model.ts` gains `// Stryker disable` comments wherever a survivor is
  equivalent. No other source file is touched.
- The mutant total, and therefore the first floor, is not knowable before the
  tool is installed: counting it needs a parser, and TypeScript 7.0.2 exposes
  only a scanner, which mis-reads the template literals `model.ts` is full of.
