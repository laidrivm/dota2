# d2ass

## Project overview

<!-- TODO: fill in as the project takes shape -->
- What it is: TBD
- Stack: TBD
- Run locally: TBD
- Run tests: TBD

## Code style

- Follow the ponytail ruleset: write the least code that works. Before adding
  code, walk the ladder — does this need to exist → is it already in the
  codebase → does the stdlib do it → does the platform do it natively.
- Prefer deleting code over abstracting it. No speculative flexibility (YAGNI).
<!-- Add concrete project conventions here as they emerge -->

## Review workflow

Review skills live in `.claude/skills/` (symlinked from the shared skills
repo — edit them there, not here). They are user-invoked slash commands:

- `/triage [base]` — risk-ordered map of the branch diff. Run before opening
  or reviewing a PR.
- `/zombies [feature]` — test ideas via the ZOMBIES heuristic. Run after
  finishing a feature, before writing tests.
- `/warm [base]` — WARM check (Worth it / Alive / Right-sized / Maintained
  securely) of dependencies the branch pulls in. Run after any dependency
  manifest change.

### Agent responsibilities

- After completing a feature or any non-trivial change, run `/zombies`,
  and offer to turn its output into tests.
- Before adding any dependency: first check whether the stdlib or the
  platform covers it (ponytail ladder). If a dependency is still added or
  upgraded, run /warm yourself and show the report — do not treat the
  task as done until the dependency is vetted.
- When the user says they're about to open a PR, suggest running `/triage`
  first.
- Never mark a feature complete while its ZOMBIES-derived edge cases have
  neither tests nor an explicit user decision to skip them.

## Testing

- Prefer TDD for edge cases: turn `/zombies` output into failing tests first,
  then implement.
- Tests must assert behaviour, not mirror the implementation. A test that
  would pass against a broken implementation is not a test.

## Lessons learned (fix & capture)

Every time a review catches a real mistake, add a one-line rule here so it
does not happen again. Keep rules concrete and checkable.

<!-- Examples of the expected shape:
- Always invalidate previously issued OTP codes when generating a new one.
- Validation errors must return 4xx, never 500.
-->
