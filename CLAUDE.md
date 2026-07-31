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
  verify it on the registry with `bun info <pkg> <field>`, one property path
  per call — for several values take the whole document with `bun info <pkg>
  --json` and filter it yourself: exact name, `repository.url`,
  `time.created` and `time.modified`, plus weekly downloads from
  `https://api.npmjs.org/downloads/point/last-week/<pkg>`, which `bun info`
  does not carry. A package that is young, low-download, or name-adjacent to
  a popular one (0auth/oauth, extra -hf/-js suffixes) is presumed
  slopsquatting — stop and tell the user.
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
- Never state a framework, library or tool's behaviour from memory — a
  method, a default, a file it reads — check the docs or ask the tool
  itself; models invent all three.

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

- One reviewable unit = one branch = one PR. The unit is the **step**: a
  change whose `tasks.md` holds more than one task group ships as one PR per
  group, in the order the groups appear, on `feat/<proposal-slug>-<step>`. A
  change whose `tasks.md` holds exactly one group is the exception and ships
  whole on `feat/<proposal-slug>` (`fix/`, `chore/` for non-feature work).
- Commits: imperative subject ≤ 72 chars, body only when the diff doesn't
  explain itself. Commit per completed task-list item, not per file.
- Never commit or push to main. When HEAD is on main and a change is needed,
  branch first, commit there, and push that branch — check which branch HEAD
  is on before the turn's first commit, because the user moves the working
  tree between turns.
- Never force-push a branch after its PR is open (review comments lose their
  anchors).
- Open PRs ready for review, not as drafts — CodeRabbit's auto-review skips
  drafts, so a draft is a PR nobody reviews.
- Keep the PR description to what the diff can't say: a link to the
  proposal, the criteria the step closes named by their `### Requirement:`
  headings — or a line saying it closes none — decisions taken, anything the
  reviewer must check by hand. Never write a walkthrough, a file-by-file
  summary, or the text of an acceptance criterion — CodeRabbit generates
  those on every run.
- Re-check a pushed branch's PR state before every commit to it — a merged
  PR strands anything added afterwards, whichever merge style closed it.
- Commit a session's wrap-up artefacts — the pipeline-yield ledger, a save
  point — to the branch in hand, never a branch of their own.
- Never post to a PR, issue, or any external service on the user's behalf —
  report the reply here and let them send it.
- Never re-run a check to confirm what a completed command already proved —
  a push that succeeded means its pre-push hook passed.
- Never wait on a result someone else produces — CI, a review bot, a queue:
  report where it will appear and end the turn.
- This repo is public: before anything is staged or committed, check the
  diff for secrets, tokens, capability URLs, internal identifiers, and
  machine-local files — flag anything questionable instead of committing it.

## Review toolkit

Which review skill to run, when, and the pre-PR sequence they form —
see [docs/review-toolkit.md](docs/review-toolkit.md).

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
   - If it's a Minor that a local review raised and you skipped → it becomes a
     rule only when the reason is a settled project convention the bot
     cannot know; a one-off keeps its reason in the report and becomes no
     rule. A rule here is read back by the next review, since
     `.coderabbit.yaml` points `code_guidelines` at `**/CLAUDE.md`.
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

What counts as evidence for a claim — environments, external contracts,
observability, causal claims — see [docs/verification.md](docs/verification.md).

- Before inlining a single-caller helper, grep for the logic it duplicates
  elsewhere.
- `src/model.ts` and `src/types.ts` never import from `src/app/**`, type-only
  imports included.
- Gate a side effect on the reducer's result, not on the action that asked
  for it.
- A default action bound to a key applies to the first *enabled* candidate,
  never the first rendered one.
- Restore focus after an action that unmounts the active element in a
  macrotask (`setTimeout(…, 0)`), not `requestAnimationFrame`.
- Read state a document-level listener depends on through a ref, never by
  re-subscribing the listener when that state changes.
- A guard against malformed input must cover the whole value, not a prefix —
  anchor both ends or parse it.
- Scope a scan by what it exempts, never by an enumeration of what it covers.
- Confirm a path is tracked before a check or a claim depends on it — a
  gitignored file is present for the author and absent in a clone.
- When a statement changes — a rule, a recorded decision, or one artefact of
  a change under review — grep every site that restates it, the change's own
  sibling artefacts included, before calling the change done.
- A rules or docs edit that no artefact of the change under way asks for goes
  in its own commit.
- Before the first dependency install or tool run in a repo, verify
  `.gitignore` covers its outputs (`node_modules/`, build dirs, local
  settings).
- All repo artifacts — docs, plans, specs, code comments, commit messages —
  are written in British English by default (`behaviour`, `afterwards`);
  identifiers and third-party API names keep whatever spelling they ship with.
- Maintain `PLAN.md`: read it at session start; update its queue, statuses
  and decisions in the same turn a task or stage completes. A step's box is
  ticked in the pull request that implements it, never in a commit after the
  merge.
- Fix code a linter or type-checker flags; never suppress a finding with an
  ignore comment or config override unless the user approves the suppression.
- Open every markdown file with a level-1 heading — OpenSpec's `design.md`
  and delta-spec templates start at `##`, so the title is yours to add.
- Assert the match before a scripted string replacement and read the
  resulting diff — a silent no-op and a malformed result both read as a
  successful edit.
- Commit the work before a probe whose undo is `git checkout <path>`,
  `git reset --hard`, or `git stash drop`.
- Reconcile a vendored skill's `allowed-tools` and `disable-model-invocation`
  against this project's policy before the skill is used.
- Substitute `bunx playwright test` for `npx playwright test` and
  `bun add -g @playwright/cli` for `npm install -g @playwright/cli` — the
  `playwright-cli` skill's own npx/npm paths are denied here.
- Never state another repository's mutable properties — visibility, default
  branch, owner — anywhere in this repo; link to it instead.
