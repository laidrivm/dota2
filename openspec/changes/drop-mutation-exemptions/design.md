## Context

`scripts/mutation-floor.ts` does two jobs. It counts the mutants surviving in
`src/model.ts` and compares that count against a floor declared in its own
source; and it reads every comment in that file looking for a `// Stryker
disable` directive, refusing one that names `all`, one written as a block
comment, one missing `next-line`, and one carrying no reason.

The second job has never had an input. `src/model.ts` carries no directive,
and `git log` shows none has ever been written. The machinery around it is
`exemptions()` and its two patterns in the check, the whole of
`scripts/mutation-floor-exemptions.test.ts`, one case in
`scripts/mutation-floor-cli.test.ts`, and `comments()` in `scripts/scan.ts`,
which exists for this caller alone.

## Goals / Non-Goals

**Goals:**

- Delete the second job and everything reachable only from it.
- Leave the first job — the count, the floor, the reason its line carries —
  reading exactly as it does now.
- Keep `scripts/spec-coverage.ts`'s `FLOOR` at 385 by removing the requirement
  rather than orphaning its scenarios.

**Non-Goals:**

- Removing mutation testing. Stryker, its config and its workflow stay. A
  300-line module of pure arithmetic is where mutation testing earns itself
  and where line coverage does not: every branch is reachable by a test that
  asserts nothing about the number it produced.
- Changing `FLOOR = 66`, the mutators Stryker runs, or the scope it runs over.
- Touching `blank()` in `scripts/scan.ts`, which `src/app/module-classes.test.ts`
  reads.

## Decisions

**The floor is the guard; the validator was its wording.** A directive is
written in order to lower the floor, and the floor compares exactly in both
directions. Probed against `gauge` before this was proposed: a malformed
directive with the floor lowered to 65 is refused with `66 surviving mutants
against a floor of 65`; a well-formed one with the floor lowered to 65 passes;
a directive written with the floor left alone passes, because nothing was
claimed and the mutant honestly still counts. The third case is the one that
could have gone the other way and did not, which is what makes the first two
evidence rather than arithmetic.

Alternative considered: keep `exemptions()` and delete only its test. Rejected
— a rule nothing exercises is worse than no rule, and the rule is the part
with no input.

**`comments()` goes with it rather than waiting for a second caller.** It was
lifted out of this check two branches ago so that one scanner served both
callers; with this caller gone it has none, and a scanner nobody runs is a
scanner nobody notices is wrong. `blank()` keeps the left-to-right walk, which
was always its own.

Alternative considered: keep `comments()` for the next consumer. Rejected —
there is no next consumer named, and the walk it reports from is still there
to report from on the day one appears.

**The requirement is removed, not relaxed.** Leaving it while deleting its
checks would leave four scenarios cited by nothing, which raises the uncited
count and fails `spec-coverage-floor` — and a floor raised to absorb that
would be a measurement recording that we stopped measuring.

## Risks / Trade-offs

- **An author mistypes their first directive and learns of it one step later,
  from the floor rather than from the line.** → The message names both
  numbers, and the author is at that moment editing the floor to record a gain
  they expected; the gap between writing the directive and being refused is
  one command. Accepted deliberately: 320 lines is a high price for an earlier
  sentence.
- **Stryker honours a block-comment directive and nothing here now refuses
  one.** → It is honoured correctly, which is Stryker's contract; what is lost
  is this repository's preference for one spelling. No mutant is admitted that
  Stryker would not have admitted.
- **A future consumer of `comments()` has to restore it.** → The span
  bookkeeping is ten lines over a walk that stays, and this change is in the
  archive to read.
