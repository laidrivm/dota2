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
- `openspec/specs/` describe product behaviour (what the system does), never
  code style or conventions — those live only in this file.
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

### The loop — agent responsibilities

Whenever a mistake is confirmed — a bug the user reports, a failed test, a
review finding (human, /triage, /zombies, /warm, or CodeRabbit) the user
agrees with, or a mistake you catch in your own earlier output — do BOTH:

1. Fix the code.
2. Capture the lesson, in the same turn, before treating the task as done:
   - If it's about how code should be written here → propose a one-line rule
     for the "Rules" list below and add it after the user confirms.
   - If it's about how reviews should be run → say the fix belongs in the
     corresponding skill in the shared skills repo, and propose the exact
     wording (do not edit the skill from this project).
   - If it's a one-off (typo, misread requirement, wrong file) → say
     "not capturing this" and why. Not every bug becomes a rule.

Rule quality bar — a rule must be:
- **Checkable**: pass/fail is obvious from reading a diff.
  Good: "Invalidate previously issued OTP codes when generating a new one."
  Bad: "Be careful with auth logic."
- **One line**, imperative mood, no rationale (rationale lives in git blame).
- **Non-duplicate**: before adding, re-read the list; if a similar rule
  exists, tighten that rule instead of appending a variant.

### Maintenance

- When this list exceeds ~20 rules, propose merging or promoting stable
  clusters into "Code style" / "Testing" sections above.
- If a rule stops applying (dependency removed, approach changed), propose
  deleting it — a stale rule costs trust in the whole list.

### Rules

<!-- newest first; added via the loop above -->

<!-- Examples of the expected shape:
- Always invalidate previously issued OTP codes when generating a new one.
- Validation errors must return 4xx, never 500.
-->
