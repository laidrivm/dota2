# context-budget Specification

## Purpose

What a session must read before it can start work, how that cost is measured,
and what leaves the always-on files when it grows. It exists because the two
files read at every session start have no shared ceiling and no eviction
route: `CLAUDE.md` had a protocol governing only itself, and `PLAN.md` had
none at all, so the only thing that ever happened to a decision recorded there
was that another one was added below it.

## Requirements
### Requirement: The always-on set is named and measured as one budget

The repository SHALL name, in `CLAUDE.md`, the files read at the start of every
session — `CLAUDE.md` itself and `PLAN.md` — and SHALL state the maintenance
trigger over their **combined** line count: the trigger fires when the two
together exceed **~500 lines**. A file indexed from `CLAUDE.md` under `docs/`
is read on demand and SHALL NOT count against the budget, which is what makes
extraction a real remedy rather than a move of the same cost to another name.

#### Scenario: The trigger is read against the sum

- **WHEN** `CLAUDE.md` and `PLAN.md` together exceed ~500 lines
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

### Requirement: PLAN.md holds the standing constraints and the sources

`PLAN.md` SHALL carry only what a future session needs in order not to reopen
settled work **and that is not a status**: the sources whose work is still
open, and the constraints that remain in force. The queue of tasks not yet
done SHALL live on the board `task-board` specifies, and `PLAN.md` SHALL
carry a pointer to it rather than a copy of any part of it.

The split is by what the thing is, not by how much of it there is. A standing
constraint — Preact, camelCase in every payload, Docker on a VPS — has no
status, is never finished, and is read by a session that is not looking for
work; a task has a status, is finished exactly once, and is read by a session
that is choosing what to do. The first belongs in a file the session already
reads. The second was in that file because there was nowhere else, and it is
what took the always-on set to 899 lines against a ~500 trigger.

`CLAUDE.md`'s *Docs describe current state only* applies to `PLAN.md` as it
does to every other artefact.

#### Scenario: A completed stage

- **WHEN** a change is merged and archived
- **THEN** its card reaches `done` and `PLAN.md` gains nothing — the archive
  path is what the card points at, and the narrative of how it was
  implemented is written nowhere

#### Scenario: A constraint with no single owning line

- **WHEN** the constraint is a project-wide choice such as Preact, camelCase in
  every JSON payload, or Docker on a VPS
- **THEN** it stays in `PLAN.md`, because no file in the tree is the place a
  reader would look for it, and it reaches no board — it is not a task and has
  no status to move

#### Scenario: A source whose work is closed

- **WHEN** every task drawn from a listed requirement source is done
- **THEN** the source leaves the list

#### Scenario: A source that is itself a task

- **WHEN** a listed source is a path to a task brief, as `tasks/task-5.md` is
- **THEN** it SHALL be replaced by that brief's card, the brief being a task
  with a status rather than a body of requirements — a source the list names
  by a path that no longer exists sends the next session to nothing, and the
  card is the only copy left

#### Scenario: A standing constraint that stops applying

- **WHEN** a kept constraint is overtaken — the dependency is dropped, the
  approach is replaced
- **THEN** it is deleted from `PLAN.md` rather than left standing, on the same
  terms as a stale rule in `CLAUDE.md`: a constraint nobody honours costs trust
  in the ones beside it

#### Scenario: A finding with no change of its own

- **WHEN** a review or a session surfaces work that has no change directory —
  as seventeen of the thirty-seven entries this change moves do not
- **THEN** it becomes a card at `suggested`, and `PLAN.md` records nothing:
  the board is where a task with no artefact in the tree is held, which is
  the case the tree cannot serve


### Requirement: An entry leaves PLAN.md by one of four routes

WHEN an entry in `PLAN.md` is reviewed against this specification, it SHALL
take exactly one of four dispositions, tested **in this order**, and the
review SHALL record which:

1. **Moved to the board** — the entry is a task: something that will be
   finished, and whose being finished is a fact somebody will want to read. It
   becomes a card at the status `task-board` derives or, where nothing in the
   tree derives it, at `suggested`.
2. **Moved to the code** — the fact is a fence at a specific line: a deliberate
   departure from the obvious implementation, or a precondition the code does
   not check. It becomes a comment there, unless one already stands.
3. **Deleted** — the fact is already in `openspec/changes/archive/**`, verified
   by reading that change rather than by assuming the archive holds it.
4. **Kept** — the fact is a standing constraint that no single site owns.

The order matters because an entry can satisfy more than one test, and the new
first route is where most of them now stop. A fence that the archive also
records is still a fence: deleting it on the archive's strength leaves the line
it governs unmarked, and the archive is not read when someone edits that line.

An archived change SHALL NOT be edited to receive an evicted entry; the archive
records what was proposed and applied, and a decision missing from it is
written where it is enforced instead.

#### Scenario: An entry that is a task and also a fence

- **WHEN** an entry names work still to do and also records what must stay
  true at a line of code
- **THEN** it becomes a card **and** a comment, the routes being tested in
  order rather than chosen between — a card nobody has taken up leaves the
  line unmarked exactly as deletion would

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
