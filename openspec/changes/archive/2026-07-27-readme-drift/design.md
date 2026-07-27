# Design — README drift

## Context

`README.md` opens with a knowledge ownership map — twelve rows, one per file,
each naming what that file owns and when to read it — under the claim "One
fact lives in exactly one file; everything else links to it." One row reads
"skills repo (private, symlinked into `.claude/skills/`)".

`.gitignore` carries `.claude/skills/`, and every entry under it is a
relative symlink into a checkout of the shared skills repository. A clone
gets the directory's absence, not broken links.

## Goals / Non-Goals

**Goals:**

- Remove the false claim, and remove the *category* of claim that produced
  it.
- Make a clone able to reach the state `CLAUDE.md` assumes.

**Non-Goals:**

- See the proposal — in particular, no attempt to check prose truth
  automatically.

## Decisions

**The visibility adjective is deleted, not corrected to "public".** Changing
"private" to "public" fixes today's sentence and leaves tomorrow's: the fact
belongs to another repository and can change without anything here changing.
A link is the same information at the point of use and cannot rot into a lie.
This is the root-cause fix; correcting the word is the symptom fix.

**The lesson generalises to a rule, and the existing grep rule is not
widened.** `CLAUDE.md` already says to grep every site restating a rule or
decision when it changes, and that rule is fine — it simply cannot fire here,
because the trigger is a local change and nothing local changed. Widening it
to "re-verify external facts periodically" would make it uncheckable, failing
the rule quality bar. The checkable form is a prohibition on writing the
claim at all: never restate another repository's mutable properties, link
instead. Pass or fail is visible in a diff.

**Only the map's paths get a test.** A README is prose about intent; a test
can decide whether `docs/testing.md` exists, never whether the sentence
describing it is still true. So the test asserts exactly the mechanical part
— every path the map names resolves — and nothing more. It follows the
precedent of `src/app/styles/styles.test.ts`, which pins the mechanical part
of a design decision and leaves the judgement to review. The paths are parsed
out of the backticked cells rather than restated in the test, so the map stays
the single source.

**The linking instructions name two sources, not one.** `CLAUDE.md` promises
five commands before every PR. Four — `/zombies`, `/warm`, `/triage`,
`/coderabbit` — come from the skills repository and arrive with
`./link.sh all <path>`. The fifth, `/ponytail-review`, ships in the ponytail
plugin, which `CLAUDE.md` already says. A section that implied one command
covers all five would replace a missing instruction with a wrong one.

**This change goes last in the queue.** All four proposed changes write to
the `CLAUDE.md` "Rules" list or immediately beside it, and this one's rule is
the least entangled, so it rebases most cheaply.

## Risks / Trade-offs

- **The test parses Markdown with a regex** → the map is a hand-written table
  in one file under the repo's own control, not arbitrary input. If its shape
  changes the test fails loudly, which is the correct outcome: the map is the
  thing being guarded.
- **A clone still cannot run the gates until the reader links the skills** →
  that is inherent to sharing skills across projects, and the README now says
  so plainly instead of leaving it to be discovered. Vendoring is the
  alternative and it is rejected in the proposal.
- **`link.sh` lives in the other repository** → the README names the command
  and links to the repository; it does not restate the script's usage, which
  would be the same drift in a new place.

## Open Questions

None.
