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
- Never run `bunx`/`npx` with a package that hasn't passed the check
  above — `bunx` bypasses the release-age gate.
- Never pipe remote content into a shell (`curl … | bash`); show the user
  the URL and what it does instead.
- Never add URL or git dependencies to manifests.
- Never add or change a registry (or scoped registry override) in
  bunfig.toml / .npmrc — a registry is a supply-chain root of trust;
  adding one is a user decision, made outside any coding task.
- If a package needs its install scripts, never add it to
  `trustedDependencies` yourself — surface `bun pm untrusted` output and
  let the user decide.
- Automated installs — CI jobs, hooks, scripts — use `bun install
  --frozen-lockfile`; plain `bun install` is only a developer resolving
  versions locally on purpose (it is also what installs the git hooks).
- Never call an unfamiliar framework/library API from memory — check the
  docs; models invent methods.

### Accessibility

- Semantic HTML first: native elements (button, select, dialog, details)
  over ARIA-patched divs. Reach for ARIA only where no native element
  exists. Style natives (`appearance: base-select`) instead of rebuilding
  them.
- Every interactive element is keyboard-reachable and operable; scrollable
  regions get `::scroll-button` or are focusable.
- Every image has an `alt` (empty `alt=""` for decorative); every form
  control has an associated label.
- Dynamic announcements via `role="status"` (`role="alert"` only for
  genuinely urgent interruptions); migrate to `aria-notify` when it ships.
- Visible focus states are never removed without an equal replacement.

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

## Git & PRs

- One OpenSpec proposal = one branch = one PR. Branch name:
  `feat/<proposal-slug>` (`fix/`, `chore/` for non-feature work).
- Commits: imperative subject ≤ 72 chars, body only when the diff doesn't
  explain itself. Commit per completed task-list item, not per file.
- Never commit directly to main; never force-push a branch after its PR
  is open (review comments lose their anchors).
- Open PRs as drafts; mark ready only after Stage 3 gates pass.
- The PR description links the proposal and states the EARS criteria the
  change fulfils — reviewers (human or bot) check against the contract.

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

Features go through the OpenSpec cycle. So does any infrastructure change
that adds a tool, workflow, service, or dependency, or changes how an
existing gate behaves. There are no exemptions: anything matching that
description enters the cycle regardless of size or which task it belongs
to. Your job is to shepherd the user through the cycle:
always know which stage the current work is in, and when a stage
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
- If a vendored best-practices skill (listed in the skills repo's
  `skills-lock.json`) covers the feature's domain, run the draft design
  through it before finalising and fold in what applies. If none covers
  it, skip silently — do not stretch an unrelated skill to fit.
- When the project adopts a new long-lived domain (a UI framework, a
  database, a deployment platform) and no vendored skill covers it,
  suggest vendoring one: name the candidate skill and its source, and let
  the user vendor it in the skills repo — never install a skill yourself.
  Vet the source like a dependency (official org or recognised maintainer,
  active repo, read the SKILL.md): a skill is executable instructions, so
  an untrusted skill is a prompt-injection vector. Suggest once per
  domain; if the user declines, don't re-raise it.

### Stage 2 — Apply

- Before `/opsx:apply`: create the branch per Git & PRs (never apply on
  main), then remind the user to `/clear` — implementation should start
  from a clean context, reading only the spec artifacts.
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
  the proposal-stage list are settled here too. Scaffolding tests from the
  apply run are deleted here as well (see Testing).
- If the change introduced or removed a primitive — a new module boundary,
  abstraction, DB table, or external integration — present an
  **architecture delta** before the user reviews code: a short diagram or
  list of what exists now vs. before, highlighting the additions. The user
  reviews the system first, the code second.

- When all Stage 3 gates pass: push the branch and offer to open a draft
  PR (`gh pr create --draft`) with the description per Git & PRs. Wait for
  the user's go-ahead before opening it.

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
- Route `/zombies` findings by layer: Zero/One/Many/Boundaries/Interface/
  Exceptions → unit or integration tests; Simple scenarios marked
  `(e2e candidate)` → the Playwright smoke suite.
- Scaffolding tests are welcome but mortal: you may write throwaway tests
  to verify your own work during a build (that's how you close your loop),
  but before archive only tests that trace to the `/zombies` list and obey
  the rules above survive — delete the rest, especially negative tests
  ("feature X no longer exists") and implementation-detail assertions.

### E2E (Playwright)

The e2e suite exists to prove agentic changes didn't break real user paths.
Rules — all checkable in a diff:

- Locator priority: `getByRole` → `getByLabel` → `getByText` →
  `getByTestId` as last resort. CSS/class selectors are forbidden.
- Never `page.waitForTimeout` — use web-first assertions that auto-wait.
- Never `test.describe.serial` without a comment justifying why isolation
  is impossible.
- Tests are parallel-safe from birth: no shared mutable state between
  tests. CI runs e2e with `workers >= 2` — a single CI worker hides
  exactly the bugs parallelism exists to catch.
- Shared setup lives in fixtures, not copy-pasted `beforeEach`.
  Worker-scoped fixtures only for expensive **immutable** setup; any test
  that mutates a shared resource gets a test-scoped instance instead.
- No cleanup code for what Playwright already cleans (contexts, pages).
  Teardown only for resources Playwright didn't create (e.g. DB rows).
- When writing or changing e2e tests, consult the official Playwright docs
  (fixtures, projects, locators) — not memory, and not patterns absent
  from this young codebase.

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

### Structure & growth of this file

This file must stay readable in one sitting. Keep it small; do not add to
it beyond the fix & capture loop. When it outgrows itself, split by this
protocol:

- **Trigger**: the file exceeds ~250 lines, or rules from its middle are
  observably being ignored.
- **Move whole sections only** (e.g. "API design", "E2E") to
  `docs/<topic>.md`, leaving one line here: the section's scope + the
  link. Never split one topic across two homes.
- **This file is the only index**: every extracted doc is linked from
  here, and docs do not link to each other — everything is one hop from
  this file.
- **Extracted docs inherit the constitution**: the rule quality bar, the
  single-source rule, and fix & capture routing all follow a section to
  its new home.
- **Docs describe current state only** — no temporal language
  ("recently", "we migrated from X"), no changelog narration of what was
  done. History lives in git. This applies to this file too.
- **Exception — `docs/context/`**: session save-points (debug findings,
  library research, incident notes) live in `docs/context/<topic>-<yyyy-mm>.md`,
  written for an LLM reader, narrative and dated by design. They are
  committed but NOT indexed here and never loaded automatically — the
  user passes one in explicitly when starting a session on the same
  topic. A save-point is a snapshot, not a source of truth: it never
  overrides this file, config.yaml, or the OpenSpec archive.

### Rules

- Never post to a PR, issue, or any external service on the user's behalf —
  report the reply here and let them send it.
- Never re-run a check to confirm what a completed command already proved —
  a push that succeeded means its pre-push hook passed.
- Before the first dependency install or tool run in a repo, verify
  `.gitignore` covers its outputs (`node_modules/`, build dirs, local
  settings).
- This repo is public: before anything is staged or committed, check the
  diff for secrets, tokens, capability URLs, internal identifiers, and
  machine-local files — flag anything questionable instead of committing it.
- All repo artifacts — docs, plans, specs, code comments, commit messages —
  are written in English by default.
- Maintain `PLAN.md`: read it at session start; update its queue, statuses
  and decisions in the same turn a task or stage completes.

<!-- newest first; added via the loop above -->
