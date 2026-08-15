# mutation-floor — delta spec

## MODIFIED Requirements

### Requirement: Mutation testing covers the model module and nothing else

The project SHALL run mutation testing over `src/model.ts` alone, killing
mutants with `bun test src/model` through Stryker's built-in command runner —
the path prefix the model's test files share, never one file's name. Step 7.2
split those tests into three files and the command still named the first, so
185 mutants survived against a floor of 67: a runner that enumerates its
killers reports a gap the tests do not have, the first time one of them moves.

No Stryker runner plugin SHALL be installed. Two third-party ones for
`bun:test` exist, and what they offer is per-test optimisation; the command
runner's documented cost — the whole suite runs for every mutant — is 53 ms
here.

#### Scenario: A mutant the tests assert against

- **WHEN** Stryker mutates an arithmetic operator on a line of `src/model.ts`
  such that a value one of the model's test files asserts on changes, and
  `bun test src/model` fails while the mutant is active
- **THEN** the mutant's status is `Killed` and it does not count towards the
  floor

#### Scenario: The model's tests move to another file

- **WHEN** a case that kills a mutant is moved from `src/model.test.ts` into a
  sibling matching the same prefix
- **THEN** the mutant stays killed and the survivor count is unchanged

#### Scenario: The suite is the only killer

- **WHEN** the command runner executes for a mutant
- **THEN** it runs `bun test src/model` and no Playwright test, so a mutant
  reachable only through `src/app/app.tsx` survives

### Requirement: The count of surviving mutants may not rise silently

#### Scenario: A branch added without a test

- **WHEN** a line is added to `src/model.ts` whose mutant no test under
  `src/model` kills
- **THEN** the check fails, reporting the survivor count and the floor
