# task-board — delta

## ADDED Requirements

### Requirement: The boards are named where a session chooses its next task

`docs/feature-workflow.md` SHALL name the three boards, the work each one
takes, and the saved view a session reads them through, each by its name. It
SHALL carry no board URL, view URL or Notion identifier, because this
repository is public and the boards are not. No file read at every session
start SHALL be needed to find a board.

#### Scenario: The workflow doc names the boards by name alone

- **WHEN** the check reads `docs/feature-workflow.md`
- **THEN** it finds `D2ASS`, `Harness`, `mellon` and `Board view`, and fails
  naming whichever is missing
- **AND** it fails on a Notion URL, a `collection://`, `view://` or
  `collectionPropertyOption://` reference, or a UUID in either case

## MODIFIED Requirements

### Requirement: Each task brief becomes one card and the directory goes

Each of the nine briefs under `tasks/` SHALL become exactly one card, and
`tasks/` SHALL leave the tree. No brief has a change directory anywhere —
they predate OpenSpec in this repository — so each card is the case this
capability already provides for, where the body is the record and no file is
expected to hold it.

One card each, rather than one card for the six that are done. `PLAN.md`
collapsed tasks 1, 2, 3, 6, 8 and 9 into a single line, and that line was
why what each of them decided was unreadable without opening six files that
were about to stop existing. A card per brief is what makes *task 6 chose
`biome check --staged` without `--write`* answerable, where a card per line
of `PLAN.md` would have recorded only that six tasks finished.

A brief's card SHALL carry what the brief recorded — what the task was, and
where its decisions are live now. Five of the nine already state that in a
`> **Status: DONE.**` block naming the live configuration; that block is what
the body is built from, not the brief's full text, which is a plan for work
that is finished.

`tasks/task-5.md` is the one still open. Its card SHALL hold the brief's scope
rather than a pointer to a file that is gone, and is found on `D2ASS` like any
other card rather than through a list of sources.

#### Scenario: A brief that is done

- **WHEN** a brief carries a `Status: DONE` block naming the live
  configuration its work produced
- **THEN** its card SHALL be `done` and its body SHALL carry that block,
  and SHALL NOT carry the brief's plan of steps

#### Scenario: The brief still open

- **WHEN** the card for `tasks/task-5.md` is created
- **THEN** the card SHALL hold the brief's scope, and the path SHALL NOT
  survive anywhere as a live citation

A brief's card SHALL be titled with the brief's filename — `tasks/task-1.md`
and not *Task 1 — bun supply chain* — because that filename is the only key
any surviving citation carries. A brief card's pointer is empty, its body
being the record, so nothing else on the card could join a cited path to it,
and a title chosen for readability would leave the four citations resolving
to nothing.

#### Scenario: An archived change citing a brief by path

- **WHEN** an archived change names `tasks/task-1.md`, `tasks/task-7.md` or
  `tasks/task-8.md`, as four archived artefacts do
- **THEN** the archived change SHALL NOT be edited, and the cited path SHALL
  be the title of exactly one card — the archive records what was proposed at
  the time, and a path it named is a fact about that time

#### Scenario: The directory's row in the ownership map

- **WHEN** `tasks/` holds no tracked file
- **THEN** its row SHALL leave the `README.md` ownership map, because
  `scripts/repo-layout.ts` refuses a documented directory holding none — a
  stale row here fails a check rather than merely reading wrong
