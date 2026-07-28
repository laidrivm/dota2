# Always-on context budget

## Why

Two files are read at the start of every session: `CLAUDE.md`, which the
harness injects, and `PLAN.md`, which a rule in `CLAUDE.md` requires the agent
to read. Together they are 738 lines. The ~250-line maintenance trigger is
written inside `CLAUDE.md` and counts `CLAUDE.md` only, so the file that has
grown to 515 lines is the one nothing measures.

`PLAN.md` grew because it has no eviction protocol. Two thirds of it —
"Accepted decisions", 329 lines — is largely apply-run narrative: *2c
corrections found during apply: `apply` closed the undo window on the action's
kind…*. That is the temporal narration `CLAUDE.md` forbids in docs, and most of
it is already recorded in `openspec/changes/archive/**`, which is where a
completed change's findings belong.

The same content is duplicated a second way. Four decisions in `PLAN.md` —
`computeModel` trusting a well-formed session, the 1 dp antisymmetry tolerance,
the inline `@import` that keeps the fonts out of the bundler, the snapshot
arriving by URL — already stand as comments at the lines they govern. The copy
in `PLAN.md` is the redundant one, and the practice it copies has no rule
behind it.

## What Changes

**`PLAN.md` — evict, then bound**

- Every entry under "Accepted decisions" is dispositioned by where its fact has
  to be legible, tested in this order: a fence a reader would otherwise remove
  → a comment at that line, if one is not already there; then, a fact the
  archive already records → deleted; then, a standing constraint that no single
  site owns (Preact, camelCase in JSON, Docker on a VPS, Dependabot over
  Renovate, Bun's bundler without Vite) → kept. Fence first, because an entry
  can be both.
- Each completed queue entry collapses to its name, its outcome and its archive
  path; "Requirement sources" collapses to the entries whose work is still
  open.
- `PLAN.md` gains its own growth protocol, stating what lives there, what
  evicts it, and where the evicted thing goes — the archive, a code comment, or
  nothing. A kept constraint that is later overtaken is deleted on the terms
  `CLAUDE.md` already applies to a stale rule, so "kept" is not permanent.

**The trigger becomes aggregate**

- The `CLAUDE.md` growth trigger is restated over the always-on set rather than
  over one file: the budget is ~500 lines across the files read every session,
  and the remedy remains extraction, which works because `docs/**` is read on
  demand.

**Fences get a rule**

- One line joins the `CLAUDE.md` rules list: comment what a reader would
  otherwise "fix" — a deliberate departure from the obvious implementation, or
  a precondition the code does not check. Four existing comments already
  satisfy it; the rule stops the fifth from being omitted.
- `.coderabbit.yaml` gains a `path_instructions` entry for `**/*.{ts,tsx}`
  asking the bot to judge whether such a fence is present and says what it
  protects. Docstring coverage stays off — the instruction is about meaning at
  a surprising line, not about prose over self-evident functions.

## Non-goals

- **A line-count check on the always-on files.** The trigger is a maintenance
  prompt, not a gate; a failing build over a 260-line `CLAUDE.md` would be
  cleared by moving text rather than by deciding what belongs.
- **Moving the pre-PR gate sequence.** `docs/review-toolkit.md` already owns
  it, and `mechanised-prohibitions` deletes the `PLAN.md` copy.
- **Dropping the grep rule.** `mechanised-prohibitions` narrows it, because
  `openspec/specs/**` and the README ownership map still restate things this
  change does not touch.
- **A third file** — `plan-log.md`, `plan-archive.md`. The archive already
  exists and is the right home; a new file would be a second place to forget.
- **Editing archived changes.** An archive entry is a snapshot of what was
  proposed and applied; a `PLAN.md` decision missing from it is written where
  it is enforced instead, not back-filled into a closed change.
- **Docstring coverage.** Turning it back on was settled against in
  `coderabbit-config`, and this change does not reopen it.

## Capabilities

### New Capabilities

- `context-budget`: which files are always-on, how their combined size is
  measured, what `PLAN.md` holds, and how an entry leaves it.

### Modified Capabilities

- `review-bot-config`: the bot gains an instruction about comments on
  TypeScript sources, which has to be stated so it cannot be read as
  reinstating the docstring check the same capability turns off.

## Impact

- **Rules and docs**: `PLAN.md` (largest share of the diff, nearly all
  deletion), `CLAUDE.md` (the growth protocol and one rule),
  `.coderabbit.yaml` (one `path_instructions` entry).
- **Code**: comments only, and only where a `PLAN.md` decision names a
  constraint that no comment currently carries.
- **Preconditions**: applied after `reviewable-diff-gates` and
  `mechanised-prohibitions`. The latter deletes `PLAN.md`'s "Gates (reminder)"
  section and splits the `CLAUDE.md` rules list into three sublists, so the
  rule added here goes into a sublist that exists by then.
