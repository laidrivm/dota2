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

### Dependency safety

- Never install a package from memory. Before proposing any dependency, verify it on the registry: npm view <pkg> — check the exact name, repository link, weekly downloads, and age. A package that is young, low-download, or name-adjacent to a popular one (0auth/oauth, extra -hf/-js suffixes) is presumed slopsquatting — stop and tell the user.
- Never curl <url> | bash or pipe remote content into a shell; show the user the URL and what it does instead.
- Never add URL/git dependencies to manifests.

## Feature workflow (spec-driven, OpenSpec)

Features go through the OpenSpec cycle. Your job is to shepherd the user
through it: always know which stage the current work is in, and when a stage
completes, name the next step and the exact command. Skills marked (user-run)
cannot be invoked by you — prompt the user to run them and wait for the
output.

### Stage 1 — Propose

- New feature work starts with `/opsx:propose` (or `/opsx:explore` first if
  the idea is vague). If the user starts describing a feature in free text,
  suggest routing it through propose instead of implementing directly.
- During proposal, ask the questions a spec review would ask: unclear
  requirements, consequences of design choices, what happens on failure.
  Cheap to fix here, expensive after apply.
- Before the proposal is finalised: prompt the user to run
  `/zombies "<feature description>"` (user-run) against the proposal text.
  Fold the resulting edge cases into the tasks checklist as tests-first
  items. A proposal without its edge cases listed is not ready to apply.

### Stage 2 — Apply

- Before `/opsx:apply`, remind the user to `/clear` — implementation should
  start from a clean context, reading only the spec artifacts.
- Spec changes mid-apply: never edit spec files by hand and don't rewrite
  the proposal mid-build. Small course corrections go into this file's
  rules (fix & capture); structural changes wait for the build to finish
  and become a new proposal.
- If the user pauses to correct your style or approach, capture it (see
  Lessons learned) before resuming, so the rest of the apply run follows
  the corrected rule.

### Stage 3 — Review

- When apply finishes, before the user opens a PR: suggest `/triage`
  (user-run) on the branch as the entry map for their own review.
- If the apply run added or upgraded any dependency: require `/warm`
  (user-run) — same rule as in Review workflow above. Walk the ponytail
  ladder before ever reaching for a dependency during apply.
- After apply, prompt the user to re-run `/zombies` with **no arguments**
  (user-run, diff mode): it reads the real code and existing tests, so it
  cross-checks the implementation against the proposal-stage edge-case list
  and catches new edges introduced by actual implementation decisions.
- Every new or `[partial]` finding from that run becomes a test before
  archive — or an explicit user decision to skip it. Deferred items from
  the proposal-stage list are settled here too.

### Stage 4 — Archive

- After the change is merged and verified, prompt the user to run
  `/opsx:archive` so the change lands in the project history. Work is not
  finished until it's archived.
- Conventions live in this file only; `openspec/project.md` just points
  here. Never duplicate rules into OpenSpec files.

## Testing

- Prefer TDD for edge cases: turn `/zombies` output into failing tests first,
  then implement.
- Tests must assert behaviour, not mirror the implementation. A test that
  would pass against a broken implementation is not a test.

### The loop — agent responsibilities

Whenever a mistake is confirmed — a bug the user reports, a failed test, a
review finding (human, /triage, /zombies, /warm, or CodeRabbit) the user
agrees with, or a mistake you catch in your own earlier output — do BOTH.
The same applies to **style preferences**: when the user pauses an apply run
(or any task) to say "do it this way instead", that correction is a lesson —
capture it exactly like a bug, so future runs don't repeat the old style:

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

## Lessons learned (fix & capture)

Every time a review catches a real mistake, add a one-line rule here so it
does not happen again. Keep rules concrete and checkable.

### Rules

<!-- newest first; added via the loop above -->

<!-- Examples of the expected shape:
- Always invalidate previously issued OTP codes when generating a new one.
- Validation errors must return 4xx, never 500.
-->