# Design — always-on context budget

## Context

Measured on `main` before this design was written:

- `CLAUDE.md` 223 lines, `PLAN.md` 515 — 738 always-on. The five files under
  `docs/` total 258 and are read on demand.
- `PLAN.md` splits into "Requirement sources" (11 lines), "Queue" (159),
  "Accepted decisions" (329) and "Gates (reminder)" (9). The decisions section
  is 64% of the file.
- The growth protocol in `CLAUDE.md` §*Structure & growth of this file* names
  its trigger as "the file exceeds ~250 lines". The subject is that file; no
  protocol governs `PLAN.md`, which the rule *Maintain `PLAN.md`* nonetheless
  requires the agent to read at session start.

Checked in the tree rather than assumed:

- Four decisions recorded in `PLAN.md` already stand as comments at the lines
  they govern: `src/model.ts:152-154` (`computeModel` trusts a well-formed
  session), `src/model.test.ts:344-345` (1 dp, not 1e-6, because my roles are
  known and enemy roles inferred), `index.html:7-8` (inline so Bun's CSS
  bundler leaves the `@import` alone), `src/app/snapshot.ts:1-18` (URL, not a
  module import, so Phase 3 replaces the producer alone). The premise that
  these facts need moving *into* the code is false — the duplicate is the copy
  in `PLAN.md`.
- The archive does not hold every decision. `undo window`, `usedAs`,
  `counter-risk`, `INK_THRESHOLD` and `roving` each appear in an archived
  change; *taken tiles use `aria-disabled`, not `disabled`* appears in none.
  Eviction is therefore per entry, not per section.

## Goals / Non-Goals

**Goals:**

- Measure the budget that actually exists — the sum of what is read every
  session.
- Give `PLAN.md` the eviction protocol that kept `CLAUDE.md` bounded.
- Delete from `PLAN.md` what is recorded elsewhere, and put in the code what
  only the code can enforce.
- State the fence practice as a rule, since it is already the practice.

**Non-Goals:** as listed in the proposal — a line-count gate, moving the gate
sequence, dropping the grep rule, a third plan file, editing archived changes,
and reopening docstring coverage.

## Decisions

### The trigger counts the set, not the file

The budget is `CLAUDE.md` + `PLAN.md`, and the figure is ~500 lines. It is
chosen so the trigger is firing today at 738 and clear after the eviction: the
decisions section is 329 lines and most of it goes, which lands the pair near
400. A number above today's total would announce a rule and enforce nothing;
one at the post-eviction figure would fire on the next paragraph anyone writes.
`docs/**` is excluded not as a
concession but because it is the mechanism: the growth protocol's remedy is to
move a section to `docs/<topic>.md` and leave a link, and that remedy only pays
if the extracted file is read when its topic comes up and not before. A budget
that counted `docs/` would price extraction at zero and the protocol would
have no lever.

Rejected: a check in CI counting lines. The trigger asks *what belongs here*,
and a build failure is cleared by moving text to any file that is not counted —
it would measure obedience rather than fitness. `/ponytail-review` and the
maintenance prompt do the judging; nothing here is a gate.

### Three dispositions, decided per entry

Every "Accepted decisions" entry takes one of: deleted because the archive
records it, written as a comment because it is a fence at a line, or kept
because it is a standing constraint no single site owns.

The archive check is a read, not an assumption. A five-item sample suggested
"the archive already has all of this"; the sixth, `aria-disabled`, is in no
archived change. Had the section been deleted wholesale on the strength of the
sample, that decision would have been lost — so the deletion is per entry and
the diff shows every line that went.

Rejected: back-filling the missing ones into their archived change. An archive
entry is what was proposed and applied at that date; editing it to add a fact
discovered later makes it a mutable record of nothing in particular. The fact
goes where it is enforced instead.

Rejected: a `plan-log.md` or `plan-archive.md`. It answers "where do I put
this?" by creating a second place to forget, and the archive already exists for
exactly this content.

### The fence rule, and why it is a rule rather than a metric

The four comments already in the tree are the argument: this project writes
fences and has no rule saying to. The gap is not the practice but its
persistence — the fifth one gets omitted, and `/ponytail-review` runs over
every diff hunting for constructions that look gratuitous. An unmarked
deliberate choice is that pass's ideal target.

One line, in the code sublist that `mechanised-prohibitions` creates: *Comment
what a reader would otherwise "fix": a deliberate departure from the obvious
implementation, or a precondition the code does not check.* It is checkable
from a diff and it does not ask for prose over a self-evident function, which
is the failure mode a coverage number produces.

The bot instruction is the same distinction the accessibility entry in
`.coderabbit.yaml` already draws — *automated scanners verify presence; you
verify meaning* — pointed at comments. `docstrings.mode` stays `"off"`:
`coderabbit-config` settled that a permanently amber check devalues the checks
beside it, and an instruction that flags a missing fence is not a coverage
threshold by another name.

### `PLAN.md`'s own protocol

Modelled on the one that bounded `CLAUDE.md`, with the difference that
`PLAN.md`'s outlet is the OpenSpec archive rather than `docs/`. It states what
lives there (open queue, open sources, standing constraints), what evicts an
entry (its change reaching the archive), and where the entry goes (deleted, or
to the code). The `Maintain PLAN.md` rule in `CLAUDE.md` gains nothing — it
already says to update the file; the protocol says what "update" removes.

## Risks / Trade-offs

- **A decision deleted that turns out to be load-bearing.** The section is
  329 lines and the review is manual → every deletion is in one diff on one
  branch, and git holds the removed text; the recovery is a `git show`.
- **The bot instruction generating noise on every TypeScript diff.** It is a
  review comment, not a gate, and the third scenario tells it not to flag
  self-evident functions → if it flags them anyway, the wording narrows, and
  `coderabbit-config` already establishes that a check nobody keeps gets
  disabled in its first week.
- **The aggregate figure drifting as `PLAN.md` refills.** Nothing enforces it →
  accepted: the trigger is a prompt, and the eviction protocol is what keeps
  the file from refilling, since a completed change now has somewhere to go.
- **Ordering.** `mechanised-prohibitions` deletes the "Gates (reminder)"
  section and splits the rules list → this change is applied after it and takes
  those two as done; applied before, it would collide in both files.

## Migration plan — two sequenced steps

1. `feat/always-on-context-budget-plan` — the `PLAN.md` eviction, its growth
   protocol, and the aggregate trigger in `CLAUDE.md`. Nearly all deletion.
2. `feat/always-on-context-budget-fences` — the rules-list line, the
   `.coderabbit.yaml` entry, and the comments for whichever decisions step 1
   dispositioned as fences without one.

Two, not four: the trigger is one paragraph in the file step 1 is already
rewriting, and separating it would be a PR whose diff is smaller than its
description. Step 2 follows step 1 because step 1 produces the list of fences
step 2 writes. Rollback for each is a revert.

## Open questions

None.
