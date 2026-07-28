# context-budget delta specification

## ADDED Requirements

### Requirement: The always-on set is named and measured as one budget

The repository SHALL name, in `CLAUDE.md`, the files read at the start of every
session — `CLAUDE.md` itself and `PLAN.md` — and SHALL state the maintenance
trigger over their **combined** line count rather than over any single file.
A file indexed from `CLAUDE.md` under `docs/` is read on demand and SHALL NOT
count against the budget, which is what makes extraction a real remedy rather
than a move of the same cost to another name.

#### Scenario: The trigger is read against the sum

- **WHEN** the always-on files together exceed the stated line budget
- **THEN** the trigger has fired, whichever of them grew

#### Scenario: One file alone stays under the old figure

- **WHEN** `CLAUDE.md` is 223 lines and `PLAN.md` is 515
- **THEN** the trigger has fired, where a per-file reading of the same numbers
  would report both files as within budget

#### Scenario: A section moves to an indexed doc

- **WHEN** a section is extracted from an always-on file to `docs/<topic>.md`,
  leaving its scope and a link
- **THEN** the budget falls by the extracted lines, because the doc is read
  only when the work touches its topic

### Requirement: PLAN.md holds the open queue and the standing constraints

`PLAN.md` SHALL carry only what a future session needs in order not to reopen
settled work: the queue of tasks not yet done, the sources whose work is still
open, and the constraints that remain in force. A completed queue entry SHALL
be reduced to its outcome and a pointer to its archived change, and SHALL NOT
carry the narrative of how it was implemented — `CLAUDE.md`'s *Docs describe
current state only* applies to `PLAN.md` as it does to every other artefact.

#### Scenario: A completed stage

- **WHEN** a change is merged and archived
- **THEN** `PLAN.md` names it, its outcome and its archive path in one entry,
  and the corrections found during its apply run are not restated

#### Scenario: A constraint with no single owning line

- **WHEN** the constraint is a project-wide choice such as Preact, camelCase in
  every JSON payload, or Docker on a VPS
- **THEN** it stays in `PLAN.md`, because no file in the tree is the place a
  reader would look for it

#### Scenario: A source whose work is closed

- **WHEN** every task drawn from a listed requirement source is done
- **THEN** the source leaves the list

### Requirement: An entry leaves PLAN.md by one of three routes

WHEN an entry under "Accepted decisions" is reviewed against this
specification, it SHALL take exactly one of three dispositions, tested **in
this order**, and the review SHALL record which:

1. **Moved to the code** — the fact is a fence at a specific line: a deliberate
   departure from the obvious implementation, or a precondition the code does
   not check. It becomes a comment there, unless one already stands.
2. **Deleted** — the fact is already in `openspec/changes/archive/**`, verified
   by reading that change rather than by assuming the archive holds it.
3. **Kept** — the fact is a standing constraint that no single site owns.

The order matters because an entry can satisfy more than one test. A fence that
the archive also records is still a fence: deleting it on the archive's
strength leaves the line it governs unmarked, and the archive is not read when
someone edits that line.

An archived change SHALL NOT be edited to receive an evicted entry; the archive
records what was proposed and applied, and a decision missing from it is
written where it is enforced instead.

#### Scenario: A decision the archive already records

- **WHEN** the archived change for that work states the same finding
- **THEN** the `PLAN.md` entry is deleted, and the check that the archive
  states it was made by reading the archived file

#### Scenario: A decision the archive does not record

- **WHEN** a decision such as *taken tiles use `aria-disabled`, not `disabled`*
  appears in no archived change
- **THEN** it is written as a comment at the code it governs, and the archived
  change is left untouched

#### Scenario: A decision whose fence already stands

- **WHEN** the code at the governed line already carries the comment — as
  `computeModel`, the antisymmetry assertion, the inline `@import` and the
  snapshot URL all do
- **THEN** the `PLAN.md` entry is deleted rather than copied, because the
  duplicate is the one in `PLAN.md`

### Requirement: A fence stands where it is stepped on

A deliberate departure from the obvious implementation, or a precondition the
code relies on without checking, SHALL carry a comment at that line. `git
blame` records why a line changed on one occasion; it does not record what must
stay true, and no reader runs `git log -S` before editing. This matters here
because `/ponytail-review` runs over every diff looking for what to cut, and an
unmarked deliberate construction is exactly what such a pass removes.

The rule SHALL be one line in the `CLAUDE.md` rules list, in the sublist that
governs this application's code.

#### Scenario: An unchecked precondition

- **WHEN** a function trusts its input rather than validating it, as
  `computeModel` trusts a well-formed session
- **THEN** a comment at the function says so, and names what is undefined
  behaviour rather than defended against

#### Scenario: A tolerance that looks careless

- **WHEN** an assertion is loose on purpose, as the antisymmetry check is to
  1 dp rather than 1e-6
- **THEN** a comment says why, so the next reader does not tighten it

#### Scenario: A self-evident function

- **WHEN** a function's name and signature already say what it does
- **THEN** no comment is required, and its absence is not a finding
