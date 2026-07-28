# Design — review approval direction

## Context

The policy is stated in four places, all from the same side:

- `openspec/specs/local-review-loop/spec.md:35` — *Major and above are fixed
  without asking*, the requirement this change modifies.
- `docs/review-toolkit.md:30-32` — the `/coderabbit-local` entry.
- `docs/review-toolkit.md:48-50` — the `/coderabbit` entry, on the same terms.
- `PLAN.md:94` and `:365-370` — the `coderabbit-local-gate` decision that
  introduced it.

None of them says what may be dismissed without asking, so nothing did. The
skills themselves default the other way — "No fixes before approval" — and the
project's override is what the four sites express.

The change is small in text and enters the OpenSpec cycle regardless:
`docs/feature-workflow.md` puts any change to how an existing gate behaves in
the cycle, with no exemption for size.

## Goals / Non-Goals

**Goals:**

- Move the approval from the fix to the dismissal.
- Say it once in the capability spec and let the other three sites reference
  the same terms.
- Make the gate line carry the distinction, so the state is machine-readable
  rather than a matter of reading the prose.

**Non-Goals:** as listed in the proposal — pass count, editing the vendored
skills, a dismissal ledger, and extending the direction to the ungraded review
skills.

## Decisions

### The override loses its severity scope rather than gaining a second one

The alternative was to keep Major+ auto-applied and add "Minor may also be
fixed without asking", which is two rules where the reason supports one. The
override exists because the branch is unpushed and a wrong fix costs a
`git checkout`; that reason does not consult the severity label. So the
severity scope goes, and one sentence covers the ladder.

### The gate line is where the change is observable

`PASS` and `OPEN` already exist in both skills. What changes is what puts a run
in `OPEN`: today it is fixes awaiting approval, and after this it is dismissals
of a 🟠 Major or 🔴 Critical awaiting approval. A run that fixes everything it
found now closes at `PASS` even when the fixes were Minor, and a run that
dismisses one finding at either of those two severities stays `OPEN` even when
it fixed everything else.

This is deliberately the part a hook or a PR template can read. The reason the
gate line exists is that the report alone is never the deliverable, and the
same argument applies to a dismissal buried in a "Not fixing" section.

### Minor and Trivial keep self-service skipping

Requiring approval for every skipped Trivial would make the gate a formality
and train everyone to approve without reading — the failure mode
`coderabbit-config` already named for a permanently amber check. The ladder's
top two rungs are where a dismissal is worth a pause.

### The skills are not edited here

`CLAUDE.md` routes a fix about how reviews run to the shared skills repository,
with the wording drafted here rather than applied there. The drafted change is
one line in each skill's severity section — that a dismissal at 🟠 Major or
🔴 Critical is proposed rather than decided, and that the gate stays `OPEN` on
it. The project's own
override already outranks the skills' default, so this change is complete
without it; the skills-repo edit removes the contradiction rather than
enabling the behaviour.

## Risks / Trade-offs

- **More pauses at the top of the ladder.** A run with three wrong Majors now
  stops three times → in practice a wrong Major is rare enough that the two on
  `mechanised-prohibitions` are the whole population so far, and they are
  exactly the two the old policy let through unreviewed.
- **A dismissal proposed with weak reasoning wastes the user's turn.** →
  unchanged from today's requirement that a rejection names concretely what the
  bot missed; the difference is only who reads it.
- **Divergence from the vendored skills until they are updated.** The skills
  say "No fixes before approval" and this says the opposite for every severity
  → the project's spec already outranks them and did before this change; the
  drafted wording closes the gap when the user applies it.

## Migration plan

One step, one PR on `fix/review-approval-direction`: the delta spec, the two
`docs/review-toolkit.md` entries, and the two `PLAN.md` sites. There is no
sequencing problem — nothing else in the queue touches these lines.

Rollback is a revert; the previous policy is a strictly narrower override.

## Open questions

None.
