# glob-row-example — design

## Context

Found by the documentation-branch grep gate on `feat/notion-task-board-3`, the
branch that deleted `tasks/` and its ownership-map row. The gate greps the
wording of each claim being replaced; `tasks/*.md` turned up in a live spec
that no step of that change had listed, and correcting a live spec is a delta
rather than an edit, so it became a card and then this.

Everything below marked *measured* was run against this tree on 2026-09-16.

## Goals / Non-Goals

**Goals:**

- Stop the scenario firing on a condition the repository cannot meet.
- Leave the requirement's behaviour, and the other six scenarios, exactly as
  they are.

**Non-Goals:**

- Changing what the check does. It is right and it is passing.
- Rewriting the requirement's other row-naming scenarios, or building a gate
  that would have caught this. Both are argued in the proposal's non-goals.

## Decisions

### The trigger becomes the shape; the row becomes an illustration

**Measured.** `checks/readme-map.test.ts` reads the live map, parses the first
backticked span of every row, and resolves each through `Bun.Glob` against
`git ls-files`. It names no path of its own. So the scenario's `tasks/*.md`
was never a fixture — nothing read it — and the test passes today at 28 cases
with that row gone.

That is what makes the fix a wording fix rather than a code one, and it is
also what makes the wording worth getting right: the scenario is read by
people, and the only thing that kept it honest was somebody remembering to
grep for it.

Two glob rows survive, measured off the map: `docs/research/*` and
`openspec/specs/*/spec.md`. The scenario names the first as an illustration.

**Alternative rejected: swap `tasks/*.md` for `docs/research/*` and stop
there.** It is one word smaller and it reinstates the defect: the new row is
as deletable as the old one, and the next change to remove it would have to
find this scenario by the same accident that found it this time. The trigger
carrying the shape is what makes the scenario survive its own example.

**Alternative rejected: drop the example entirely.** *WHEN a row's path
carries a glob* is complete on its own, but the other six scenarios in this
requirement all name something concrete, and a lone abstract one reads as an
oversight rather than as a decision.

### The delta is `MODIFIED`, carrying all seven scenarios

A `MODIFIED` replacement is whole-requirement: a scenario the delta omits is
deleted at sync rather than flagged. The block was copied from the live spec
programmatically rather than retyped, and the seven were compared by name
against the live seven before the delta was called done.

## Risks / Trade-offs

- **The illustration goes stale too.** → It can, and the scenario still reads
  correctly when it does, because nothing turns on it. That is the difference
  the change is buying; the residue is a sentence naming a row that once
  existed, which is a smaller defect than a trigger that cannot fire.
- **The other five concrete triggers carry the same latent defect.** →
  Accepted and recorded rather than fixed. None has gone stale, and the
  proposal says why fixing the class at one site is the smaller change.

## Migration Plan

One edit to one file, applied by sync. Nothing to order, nothing to roll back
that `git revert` does not cover.

## Open Questions

None. The requirement is unchanged, the check is unchanged, and the only
judgement — shape in the trigger, row as illustration — is argued above with
both alternatives named.
