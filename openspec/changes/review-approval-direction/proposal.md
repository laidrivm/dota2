# Review approval direction

## Why

The repository states its review policy from one side only: *Major and above
applied without asking*. That sentence is true and yet wrong in both
directions.

Read forwards, it scopes the override of the skills' "No fixes before approval"
to Major and Critical, so a correct three-line Minor fix stops the run and
waits — which happened on PR #39.

Read backwards, it says nothing about **dismissing** a finding, so a 🟠 Major
can be rejected on the agent's own written reasoning and never reach the user.
Two Major findings on `mechanised-prohibitions` were closed that way.

The asymmetry is the point: a wrong fix on an unpushed branch costs a `git
checkout`, while a wrongly dismissed Major ships. The approval gate belongs on
the dismissal, not on the fix.

## What Changes

- The requirement *Major and above are fixed without asking* becomes *A finding
  is fixed without asking, whatever its severity*. The override of the skills'
  "No fixes before approval" stops being scoped by severity.
- A new requirement: dismissing a 🟠 Major or 🔴 Critical — rejecting it as
  wrong, or skipping it — SHALL be put to the user with what the bot missed,
  and SHALL leave the gate line `OPEN` until they settle it. A pending fix
  never holds the gate; a pending dismissal always does.
- Minor keeps its existing treatment — read it, then fix or skip with a reason
  that is not `below severity threshold` — with the fix half no longer needing
  approval.
- The four sites restating the old wording are reconciled:
  `openspec/specs/local-review-loop/spec.md`, `docs/review-toolkit.md` (twice)
  and `PLAN.md` (twice).
- The matching wording for the `coderabbit` and `coderabbit-local` skills is
  drafted here for the user to apply in the skills repository, which this
  project does not edit.

## Non-goals

- **Changing the pass count or the stop condition.** Three passes and the
  early stop on a clean review are unaffected.
- **Editing the vendored skills.** They live in another repository; this change
  drafts the wording and the user applies it there.
- **A record of every dismissal.** The report already names each one with its
  reason; what changes is who settles it.
- **Extending the direction to `/zombies`, `/ponytail-review` or `/triage`.**
  Their findings are not severity-graded, and this policy is about a severity
  ladder. If they need one, it is their own change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-review-loop`: the auto-apply requirement loses its severity scope, and
  the capability gains the constraint the old wording left open — that a Major
  dismissal is the user's call.

## Impact

- **Rules and docs**: `openspec/specs/local-review-loop/spec.md`,
  `docs/review-toolkit.md`, `PLAN.md`.
- **Behaviour change for the agent**: it fixes Minor findings without pausing,
  and stops on a Major it wants to reject rather than closing it alone. Runs
  get shorter at the bottom of the ladder and longer at the top, which is the
  trade being bought.
- **Outstanding**: the two Major dismissals already made on
  `mechanised-prohibitions` are put to the user, since the change they belong
  to is not yet applied.
