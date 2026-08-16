# scan-lift — design

## Context

Three scanners of the same shape stand in the tree, and each answers a
different question about the same walk:

| caller | wants | how it gets it today |
| --- | --- | --- |
| `src/app/module-classes.test.ts` | code with non-code erased | `blank(source, language)` in `scripts/scan.ts` |
| `scripts/mutation-floor.ts` | every comment, its line, block or not | private `comments(source)`, 49 lines |
| `scripts/spec-coverage.ts` | which lines sit inside a block comment | per-line regex strip, 22 lines |

`scan.ts` is the one that carries the state a correct scan needs — an escaped
quote, a `/*` inside a line comment, a quote inside a regex literal, a template
literal that is text and code at once, and a language table so CSS is not read
as if it had `//` or regex literals. The other two predate it, and their holes
are the shapes it was written against.

The blocker is that `blank` erases what the other two callers exist to read.
The scan already knows where every comment is; it throws that away and returns
only the residue.

## Goals / Non-Goals

**Goals:**

- One walk in one module, with each caller taking the view it needs from it.
- The two live defects closed, each with a case that fails before the switch.
- `blank`'s contract unchanged, so `src/app/module-classes.test.ts` is
  untouched and stands as the check that the lift kept it.
- `scripts/mutation-floor-exemptions.test.ts` leaves as a deletion.

**Non-Goals:**

- A parser. The only question asked of a character stays *what encloses it*.
- Any new language in the `SYNTAX` table.
- Changing how a directive or a citation is *interpreted* once found. The
  grammars in `mutation-floor.ts` (`DISABLE`, `ADMITTED`) and
  `spec-coverage.ts` (`CITATION`, the following-comment-lines walk) are this
  change's fixed points.

## Decisions

### One export returning comments, not three exports returning views

`scan.ts` gains `comments(source, language)` returning
`{ text, line, block }[]` — the shape `mutation-floor.ts` already defines and
already consumes, so that caller becomes an import and a deletion.

`spec-coverage.ts` wants a different view: for each line index, is it inside a
block comment. That is derivable from the comment list — a block comment
opening on line *n* whose text spans *k* newlines encloses lines *n* through
*n + k* — so it derives it at its own call site rather than earning a second
export.

*Alternatives considered.* A `regions()` primitive returning every non-code
span with its kind, with `blank` and `comments` as derivations, is the more
general shape and was rejected: nothing asks for string or template spans, and
a third caller wanting them can widen it then. Exporting `enclosed(source)`
alongside `comments()` was rejected on the same ground — one caller, and the
derivation is three lines.

### `blank` and `comments` share the walk by construction, not by convention

The two exports are one internal scan parameterised by what it collects, so a
fix to the state machine reaches both. Two walks kept in step by review is the
arrangement this change exists to end.

### `mutation-floor-exemptions.test.ts` is deleted, not migrated wholesale

Its 236 lines split by what they exercise:

- cases about *scanning* — an escaped quote, a `/*` inside a line comment, a
  multi-line block, a quote inside a regex literal — belong to
  `scripts/scan.test.ts`, and are kept only where `scan.test.ts` has no
  equivalent already. It is a lift, so a duplicate case is a duplicate.
- cases about the *directive grammar* — `all`, a missing `next-line`, a missing
  reason, the block-comment spelling — move to
  `scripts/mutation-floor.test.ts`, which owns `exemptions()`.

`file-size-cap` step 7.5 recorded 219 for `mutation-floor.test.ts` against a
300-line cap, so the grammar cases have room. Measure after, not before.

### The floor moves if a hidden directive appears

Making a comment visible that the scanner missed can change what `exemptions()`
reports, and a directive that starts being honoured can change the surviving
count. `src/model.ts` holds no regex literal today, so the expected delta is
zero — which is a prediction, and the task list checks it rather than assuming
it. If it is not zero, the floor moves with its reason on its line, as
`mutation-floor` already requires.

### The rule of two is a `CLAUDE.md` Code rule, not a spec

`reviewable-diff-gates` deferred it as "its own one-line rule, separately". A
rule about when to extract a helper is a statement about how code is written
here, which is what the Code list is; it ages with the code, and no gate can
check it from a diff without reading intent.

## Risks / Trade-offs

- **The switch changes what a gate reports, and a gate that starts failing
  looks like the change broke it.** → Each switch lands with the failing case
  first: add the case against the old implementation, watch it fail, then
  switch. A gate whose count moves reports it in the task list with the input
  that moved it.
- **`spec-coverage.ts`'s derivation of enclosed lines is new code, and the
  citation floor is what would report it wrong.** → The floor is the wrong
  alarm for a broken scanner — that is the defect being fixed, not a mitigation
  — so the derivation gets its own cases: a citation inside a commented-out
  block still does not count, and one below a block that closed still does.
- **A duplicate case survives the redistribution and the deletion silently
  shrinks coverage instead.** → Compare full describe paths before and after,
  the check `CLAUDE.md` carries; a case dropped as a duplicate is named in the
  task list with the `scan.test.ts` case that already covers it.
- **`blank`'s behaviour drifts while the internals are parameterised.** →
  `src/app/module-classes.test.ts` and `scripts/scan.test.ts` are not edited by
  this change, so they are the control.
