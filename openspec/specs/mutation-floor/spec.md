# mutation-floor Specification

## Purpose

What is mutated in this repository, what kills a mutant, how a survivor is
admitted, and what the floor forbids. It exists because `src/model.ts` is at
100% line and function coverage from its own tests, so coverage can no longer
tell a test that asserts a value from one that merely executes a line — and the
model is the one place here where a wrong sign or a wrong boundary yields a
plausible number instead of a crash.

## Requirements

### Requirement: Mutation testing covers the model module and nothing else

The project SHALL run mutation testing over `src/model.ts` alone, killing
mutants with `bun test src/model` through Stryker's built-in command runner —
the path prefix the model's test files share, never one file's name. A runner
that enumerates its killers reports a gap the tests do not have, the first time
one of them moves.

No Stryker runner plugin SHALL be installed. Two third-party ones for
`bun:test` exist, and what they offer is per-test optimisation; the command
runner's documented cost — the whole suite runs for every mutant — is 53 ms
against this suite, so the optimisation is worth nothing and the second
supply-chain root is not.

The scope SHALL stay at one source file and one command. A second file under
the same configuration would share one floor, and a number that moves whenever
either file is edited cannot carry a reason for a single admitted survivor;
adding `src/app/session.ts` therefore means a second configuration and a second
floor, not a widened glob.

The killing set SHALL be the model's own unit tests. `src/app/app.tsx` also
calls `computeModel`, and its path is exercised by Playwright rather than by
`bun test`; a mutant that only an e2e test would kill therefore counts as
surviving, which overstates the gap rather than concealing it.

The gate SHALL NOT be a `*.test.ts` file: it spawns a process per mutant, and
`bun test` is run both in CI and before every push. It SHALL run as its own CI
job, and before a push as its own command beside the suite rather than inside
it — `commit-gates` owns that list.

#### Scenario: A mutant the tests assert against

- **WHEN** Stryker mutates an arithmetic operator on a line of `src/model.ts`
  such that a value one of the model's test files asserts on changes, and
  `bun test src/model` fails while the mutant is active
- **THEN** the mutant's status is `Killed` and it does not count towards the
  floor

#### Scenario: A file outside the scope

- **WHEN** `src/app/session.ts` or `src/types.ts` is edited
- **THEN** the mutant set is unchanged, because neither file is mutated

#### Scenario: The model's tests move to another file

- **WHEN** a case that kills a mutant is moved from `src/model.test.ts` into a
  sibling matching the same prefix
- **THEN** the mutant stays killed and the survivor count is unchanged

#### Scenario: The suite is the only killer

- **WHEN** the command runner executes for a mutant
- **THEN** it runs `bun test src/model` and no Playwright test, so a mutant
  reachable only through `src/app/app.tsx` survives

#### Scenario: The gate is not picked up by the suite

- **WHEN** `bun test` runs, in CI or from the pre-push hook
- **THEN** it does not execute Stryker, because the gate is a script rather
  than a test file
