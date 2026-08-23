# d2ass

## Project overview

- What it is: a single-page draft assistant for Dota 2 ranked All Pick —
  the player mirrors a live draft into it and gets per-role pick
  suggestions and a win-probability estimate.
- Stack: TypeScript on Bun, Preact, no build tool beyond Bun's bundler.
- Run locally: `bun run dev` (see README for what it serves).
- Run tests: `bun test`.

## Code style

The ponytail ladder, dependency safety and accessibility — see
[docs/code-style.md](docs/code-style.md).

## API design

Response contract rules for every endpoint — see
[docs/api-design.md](docs/api-design.md).

## Git & PRs

Branch and commit shape, PR description, and the git mechanics that
protect the history — see [docs/git-and-prs.md](docs/git-and-prs.md).

## Review toolkit

Which review skill to run, when, and the pre-PR sequence they form —
see [docs/review-toolkit.md](docs/review-toolkit.md).

## Feature workflow (spec-driven, OpenSpec)

The four OpenSpec stages, what gates each one, and the discipline every
change artefact is written under — see
[docs/feature-workflow.md](docs/feature-workflow.md).

## Testing

What a test must assert, how `/zombies` findings route, and the e2e
rules — see [docs/testing.md](docs/testing.md).

## Lessons learned (fix & capture)

### The loop — agent responsibilities

Whenever a mistake is confirmed — a bug the user reports, a failed test, a
review finding (human, /triage, /zombies, /warm, /ponytail-review, or
CodeRabbit) the user agrees with, or a mistake you catch in your own earlier
output — do BOTH.
The same applies to **style preferences**: when the user pauses an apply run
(or any task) to say "do it this way instead", that correction is a lesson —
capture it exactly like a bug, so future runs don't repeat the old style:

1. Fix the code.
2. Capture the lesson, in the same turn, before treating the task as done:
   - If it's about how code should be written here → propose a one-line rule
     for the matching sublist of "Rules" below — Code, Process or Safety —
     and add it after the user confirms.
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

- When one sublist exceeds ~20 rules, propose merging or promoting stable
  clusters out of **that** sublist into the "Code style" section above or the
  docs indexed there — the other two sublists are not counted against it. A
  Code rule also leaves by being deleted once the code it describes is
  rewritten; a Process or Safety rule leaves by promotion, or by the bullet
  below when it stops applying at all.
- If a rule stops applying (dependency removed, approach changed), propose
  deleting it — a stale rule costs trust in the whole list.

### Structure & growth of this file

This file must stay readable in one sitting. Keep it small; do not add to
it beyond the fix & capture loop. When it outgrows itself, split by this
protocol:

- **Trigger**: the always-on set — this file plus `PLAN.md`, the two read at
  the start of every session — exceeds ~500 lines together, or rules from this
  file's middle are observably being ignored. The budget is the sum because
  the cost is what a session must read before it starts, and neither file pays
  it alone. A file indexed below under `docs/` is read when its topic comes up
  and does not count: that exclusion is what makes extraction a real remedy
  rather than the same lines under another name.
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

#### Code

Rules about this application's code. They age with it: when the code a rule
describes is rewritten, the rule is a candidate for deletion.

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
- State a scan's exemptions in the scan; never inherit them from another tool's
  configuration.
- Scan source left to right carrying string, comment, template-expression and
  regex-literal state, restoring the enclosing state when a nested construct
  closes, and name which of those the language being scanned has.
- Read a literal's contents from the source at the offset the scan reached,
  never from the copy the scan blanked.
- Where a delimiter's meaning depends on the position within a construct, track
  that position, never infer it from a nesting count.
- Comment what a reader would otherwise "fix": a deliberate departure from the
  obvious implementation, or a precondition the code does not check.
- Await a rejection from a driver's query object through `then(ok, err)`,
  never `expect().rejects`, which hangs on a thenable instead of failing.

#### Process

Rules about how work is carried out here. They do not age with the code.

- Confirm a path is tracked before a check or a claim depends on it — a
  gitignored file is present for the author and absent in a clone.
- Probe a gate by refusing it, with an input the session has not already
  cleared — an approval and an absent prompt reach you as the same successful
  result, and an approval outlives the mode that granted it.
- Never report what a permission prompt did; report what the call returned.
- Treat an empty result as evidence of absence only after the same query has
  returned a non-empty one — a broken query and a true absence print the same
  nothing.
- Take a count from the authoritative list — found by the token every member
  must carry, never one they merely tend to share — and reconcile it against
  any count the source states itself.
- Re-run the older probe before overwriting a recorded measurement your new
  one contradicts.
- Exercise a pre-written decision rule, or a condition you have written, only
  against a case that could have produced the opposite outcome — for a
  condition, name that case before writing it.
- A rules or docs edit that no artefact of the change under way asks for goes
  in its own commit.
- Take the queue's next entry in its stated order, and name every entry
  stepped over and why.
- Before syncing a `MODIFIED` delta, check it carries every scenario the live
  requirement has — the replacement is whole-requirement.
- Never silence a linter or type-checker finding by disabling its rule in
  configuration; fix the code or ask the user to approve a suppression.
- All repo artefacts — docs, plans, specs, code comments, commit messages —
  are written in British English by default (`behaviour`, `afterwards`);
  identifiers and third-party API names keep whatever spelling they ship with.
- Script a string replacement only for a pattern repeating across files, assert
  the match count, and read the changed passage back — a diff stat, a token
  count and a silent no-op all read as a successful edit.
- Edit a file with the editing tool, never a shell heredoc, when its text
  carries a backtick or `${`.
- Verify a test file's split by the full describe path of every test, never by
  their count — a block absorbed into its neighbour runs exactly as many.
- Split a file to the cap that will apply to it, not the one that applies today.
- A suite that may skip locally fails the CI job that owns it when it skips
  there — supply what it needs, and assert it ran.
- Cite the requirement that fixes a value; never restate the value in another
  requirement.
- Grep a claim's own wording when correcting it, never the files it was noticed
  in — a claim repeats wherever its subject is discussed.
- Apply a rule the branch adds to the artefacts the branch already carries,
  before it is pushed.

#### Safety

Rules that keep something out of the repository or off the machine. They do
not age with the code.

- Before the first dependency install or tool run in a repo, verify
  `.gitignore` covers its outputs (`node_modules/`, build dirs, local
  settings).
- Reconcile a vendored skill's `allowed-tools` and `disable-model-invocation`
  against this project's policy before the skill is used.
- Run each of the `playwright-cli` skill's three npm-family paths through bun
  instead — `bunx playwright cli`, `bunx --no-install playwright --version`,
  `bun add -g @playwright/cli` — since its own are denied here.
- Beside a pinned image, binary or digest that no dependency manifest tracks,
  write which tool updates the pin, or that nothing does.
- Gate a suite that runs destructive SQL on a variable saying the database is
  disposable, never on the connection string alone.
