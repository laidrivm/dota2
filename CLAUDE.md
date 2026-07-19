# d2ass

## Project overview

<!-- TODO: fill in as the project takes shape -->
- What it is: TBD
- Stack: TypeScript on Bun
- Run locally: TBD
- Run tests: TBD

## Code style

- Follow the ponytail ruleset: write the least code that works. Before adding
  code, walk the ladder — does this need to exist → is it already in the
  codebase → does the stdlib do it → does Bun/the platform do it natively.
- Prefer deleting code over abstracting it. No speculative flexibility (YAGNI).
<!-- Add concrete project conventions here as they emerge -->

### Dependency safety

- Never install a package from memory. Before proposing any dependency,
  verify it on the registry (`npm view <pkg>`): exact name, repository link,
  weekly downloads, and age. A package that is young, low-download, or
  name-adjacent to a popular one (0auth/oauth, extra -hf/-js suffixes) is
  presumed slopsquatting — stop and tell the user.
- Never pipe remote content into a shell (`curl … | bash`); show the user
  the URL and what it does instead.
- Never add URL or git dependencies to manifests.
- Never call an unfamiliar framework/library API from memory — check the
  docs; models invent methods.

## API design

The API is a product; its consumer is a TypeScript frontend. Contract rules
— all checkable in a diff:

- Every endpoint responds through an explicit response schema (zod/typebox
  or equivalent) — never a raw ORM/DB object. The TypeScript response type
  derives from that schema, not the other way round.
- Honest types: booleans are `true`/`false` (never 0/1), enums are strings
  (`"published"`, not magic numbers), dates are ISO 8601 with offset.
- Every contract key is always present; an absent value is `null`. No
  dynamic or conditional keys.
- camelCase everywhere in JSON — including error bodies and pagination
  metadata.
- IDs are UUIDv7 via `Bun.randomUUIDv7()` (time-sortable) — never
  incremental integers, no ulid/uuid packages.
- Display-ready fields are computed server-side once (assembled URLs,
  initials) instead of in every consumer.
- Errors follow RFC 9457 (`application/problem+json`) with two extension
  fields: a machine-readable `code` (frontend logic keys off codes, never
  off message strings) and, where the user can act, an `action` hint.
- CORS is configured server-side together with the first endpoint — a
  consumer staring at a CORS error means the backend isn't finished.
- List endpoints use cursor pagination unless the list is small and
  internal-only.

Architecture defaults (SSE vs WebSockets, BFF response shaping, caching,
N+1 policy) live in the `context:` field of `openspec/config.yaml` — apply
them at propose time.

## Review toolkit

Review skills live in `.claude/skills/` (symlinked from the shared skills
repo — edit them there, not here):

- `/triage [base]` — risk-ordered map of the branch diff, grouped by feature
  area. **User-run**: suggest it and wait; never invoke it yourself. It is
  the user's entry point into their own review.
- `/zombies [feature]` — test ideas via the ZOMBIES heuristic. With args:
  works from a feature description (pre-code). Without args: diff mode,
  cross-referenced against existing tests. **Agent-run**: invoke it yourself
  at the points defined below and show the output.
- `/warm [base]` — WARM check of dependencies the branch pulls in.
  **Agent-run**: invoke it yourself after any dependency manifest change and
  show the report; the change is not done until its dependencies are vetted.

These gates apply to ALL work. Non-feature changes (bugfixes, chores,
config) skip the OpenSpec stages but still get: `/zombies` after any
non-trivial change, `/warm` after any manifest change, and a `/triage`
suggestion before a PR is opened.

## Feature workflow (spec-driven, OpenSpec)

Features go through the OpenSpec cycle. Your job is to shepherd the user
through it: always know which stage the current work is in, and when a stage
completes, name the next step and the exact command.

### Stage 1 — Propose

- New feature work starts with `/opsx:propose` (or `/opsx:explore` first if
  the idea is vague). If the user starts describing a feature in free text,
  suggest routing it through propose instead of implementing directly.
- During proposal, ask the questions a spec review would ask: unclear
  requirements, consequences of design choices, what happens on failure.
  For any endpoint, fix the exact response shape in design.md per the
  API design rules above. Cheap to fix here, expensive after apply.
- Before the proposal is finalised: run `/zombies "<feature description>"`
  against the proposal text. Fold the resulting edge cases into the tasks
  checklist as tests-first items. A proposal without its edge cases listed
  is not ready to apply.

### Stage 2 — Apply

- Before `/opsx:apply`, remind the user to `/clear` — implementation should
  start from a clean context, reading only the spec artifacts.
- Never edit spec files by hand and don't rewrite the proposal mid-build.
  Small course corrections go into this file's rules (fix & capture);
  structural changes wait for the build to finish and become a new proposal.
- If the user pauses to correct your style or approach, capture it (see
  Lessons learned) before resuming, so the rest of the apply run follows
  the corrected rule.

### Stage 3 — Review

- When apply finishes, before the user opens a PR: suggest `/triage` on the
  branch as the entry map for their own review.
- If the apply run added or upgraded any dependency: run `/warm`. Walk the
  ponytail ladder before ever reaching for a dependency during apply.
- Re-run `/zombies` with **no arguments** (diff mode): it reads the real
  code and existing tests, cross-checks the implementation against the
  proposal-stage edge-case list, and catches new edges introduced by actual
  implementation decisions.
- Every new or `[partial]` finding from that run becomes a test before
  archive — or an explicit user decision to skip it. Deferred items from
  the proposal-stage list are settled here too.

### Stage 4 — Archive

- After the change is merged and verified, prompt the user to run
  `/opsx:archive` so the change lands in the project history. Work is not
  finished until it's archived.
- Single-source rule: agent rules and contract rules live in this file;
  architecture defaults live in the `context:` field of
  `openspec/config.yaml`. Neither restates the other, and no other OpenSpec
  artifact or rule duplicates either — OpenSpec `rules:` may only reference
  this file, not restate it.

## Testing

- Prefer TDD for edge cases: turn `/zombies` output into failing tests first,
  then implement.
- Tests must assert behaviour, not mirror the implementation. A test that
  would pass against a broken implementation is not a test.

## Lessons learned (fix & capture)

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
  clusters into "Code style" / "Testing" / "API design" sections above.
- If a rule stops applying (dependency removed, approach changed), propose
  deleting it — a stale rule costs trust in the whole list.

### Rules

<!-- newest first; added via the loop above -->
