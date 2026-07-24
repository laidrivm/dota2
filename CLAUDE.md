# d2ass

## Project overview

- What it is: a single-page draft assistant for Dota 2 ranked All Pick —
  the player mirrors a live draft into it and gets per-role pick
  suggestions and a win-probability estimate.
- Stack: TypeScript on Bun, Preact, no build tool beyond Bun's bundler.
- Run locally: `bun run dev` (see README for what it serves).
- Run tests: `bun test`.

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

Response contract rules for every endpoint — see
[docs/api-design.md](docs/api-design.md).

## Git & PRs

- One OpenSpec proposal = one branch = one PR. Branch name:
  `feat/<proposal-slug>` (`fix/`, `chore/` for non-feature work).
- Commits: imperative subject ≤ 72 chars, body only when the diff doesn't
  explain itself. Commit per completed task-list item, not per file.
- Never commit directly to main; never force-push a branch after its PR
  is open (review comments lose their anchors).
- Open PRs as drafts; mark ready only after Stage 3 gates pass.
- Keep the PR description to what the diff can't say: a link to the
  proposal, decisions taken, anything the reviewer must check by hand.
  Never write a walkthrough, a file-by-file summary, or a restatement of
  the acceptance criteria — CodeRabbit generates those on every run.

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

These gates apply to ALL work. Changes that match none of the cycle
criteria in [docs/feature-workflow.md](docs/feature-workflow.md) — a
bugfix, a chore, a single-value config edit — skip the OpenSpec stages but
still get: `/zombies` after any non-trivial change, `/warm` after any
manifest change, and a `/triage` suggestion before a PR is opened.

## Feature workflow (spec-driven, OpenSpec)

The four OpenSpec stages and what gates each one — see
[docs/feature-workflow.md](docs/feature-workflow.md).

## Testing

What a test must assert, how `/zombies` findings route, and the e2e
rules — see [docs/testing.md](docs/testing.md).

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
  clusters into "Code style" here or the docs indexed above.
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

- A guard against malformed input must cover the whole value, not a prefix —
  anchor both ends or parse it.
- Before calling a tracked file a duplicate, check whether its twin is
  tracked — a gitignored copy does not ship with the repo.
- When a rule or a recorded decision changes, grep every site that restates
  it — rules list, docs, OpenSpec artifacts, README — before calling the
  change done.
- Check a branch's PR state before adding commits — a squash merge strands
  anything pushed after it.
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
- Fix code a linter or type-checker flags; never suppress a finding with an
  ignore comment or config override unless the user approves the suppression.

<!-- newest first; added via the loop above -->
