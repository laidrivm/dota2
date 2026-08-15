# commit-gates — delta spec

## ADDED Requirements

### Requirement: The pre-push hook runs every gate that needs no browser

The pre-push hook SHALL run, in addition to the type check and `bun test`:
`biome ci`, the YAML syntax check, the suppression scan, and the mutation
floor with the Stryker run that produces its report. A non-zero exit from any
of them SHALL block the push. The diff budget SHALL remain the single
exception, absorbed as `change-slicing` requires, because it measures rather
than judges.

The list SHALL be stated here and nowhere else. It was previously spread
across four specifications, two of which disagreed, and a gate that no single
file claims is one a change can break without contradicting anything.

A check whose tool may be absent from a developer's machine — `actionlint`,
`gitleaks` — SHALL run when the binary is on `PATH` and SHALL be skipped
silently when it is not, so a fresh clone can push. Absence SHALL NOT fail the
hook: CI runs both from pinned versions, and that is where their verdict is
binding.

The hook SHALL NOT run the browser suite or the coverage report. `smoke-suite`
owns why for both.

#### Scenario: A gate that CI would fail blocks the push instead

- **WHEN** a branch is pushed whose surviving-mutant count exceeds the floor
- **THEN** the hook reports the count and the floor and exits non-zero, and the
  push does not happen

#### Scenario: A tool the machine does not have

- **WHEN** `actionlint` is not on `PATH` and a branch is pushed
- **THEN** the hook completes without error and without linting the workflows

#### Scenario: The budget is still soft

- **WHEN** a branch at 950 counted lines is pushed and every other gate passes
- **THEN** the hook prints the `FAIL` gate line and the push proceeds

#### Scenario: The list has one home

- **WHEN** a specification other than this one enumerates what the pre-push
  hook runs
- **THEN** the change is rejected at review — the fragment belongs here, and
  the other specification states only the part it owns
