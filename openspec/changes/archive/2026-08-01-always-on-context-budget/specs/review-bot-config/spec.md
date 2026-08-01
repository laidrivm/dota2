# review-bot-config delta specification

## ADDED Requirements

### Requirement: The bot judges what a comment protects, not whether one exists

`.coderabbit.yaml` SHALL carry a `path_instructions` entry for
`**/*.{ts,tsx}` asking the bot to flag a function that relies on an unchecked
precondition, or a non-obvious approach carrying no comment about what it
protects, and to leave self-evident functions alone. The instruction SHALL be
worded so it cannot be satisfied by prose over every function, because
`reviews.pre_merge_checks.docstrings.mode` stays `"off"` and this entry does
not reinstate it by another route.

This is the same division the accessibility instruction already draws in the
same file — automated scanners verify presence, the reviewer verifies meaning —
applied to comments instead of accessible names.

#### Scenario: A fence is missing

- **WHEN** a diff adds a function that trusts an unvalidated input, with no
  comment saying so
- **THEN** the bot flags it

#### Scenario: A self-evident function without a comment

- **WHEN** a diff adds a function whose name and signature say what it does
- **THEN** the bot does not flag the absent comment

#### Scenario: The docstring check stays off

- **WHEN** `.coderabbit.yaml` is read after this change
- **THEN** `reviews.pre_merge_checks.docstrings.mode` is still `"off"`, and no
  `threshold` has appeared beside it
