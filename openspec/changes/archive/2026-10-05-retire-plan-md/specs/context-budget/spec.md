# context-budget — delta

## REMOVED Requirements

### Requirement: The always-on set is named and measured as one budget

**Reason**: The set it measures as one budget has one member left, so its
scenarios about a sum and about two files cannot be carried by a modification.

**Migration**: *CLAUDE.md is the only file read at every session start*
replaces it with a figure of its own, ~350 lines.

### Requirement: PLAN.md holds the standing constraints and the sources

**Reason**: `PLAN.md` leaves the tree. Nothing in it was needed by every
session. The next task reaches a session from the user or from a board, and
each standing constraint either duplicated a site that owns it or was a fence
missing from the line it guards.

**Migration**: Tasks stay on the boards, which `docs/feature-workflow.md`
names (`task-board`). Each constraint goes where *A fact with no status is
written where its reader looks* sends it. This change's design records the
destination of each.

### Requirement: An entry leaves PLAN.md by one of four routes

**Reason**: There is no `PLAN.md` left for an entry to leave. The routes
outlive it and now govern a fact wherever it surfaces, not only an entry
already in the file.

**Migration**: *A fact with no status is written where its reader looks*
carries the card, comment and archive routes, and replaces *kept* with the
owning site. A fact that no site owns goes to the user, not to a file.

## ADDED Requirements

### Requirement: CLAUDE.md is the only file read at every session start

`CLAUDE.md` SHALL name itself as the only file read at the start of every
session and SHALL state the maintenance trigger over its line count: the
trigger fires when `CLAUDE.md` exceeds **~350 lines**. A file indexed from
`CLAUDE.md` is read on demand and SHALL NOT count against the budget. The
`README.md` ownership map SHALL read exactly one file as read every session.

#### Scenario: The trigger fires on the one file

- **WHEN** `CLAUDE.md` exceeds ~350 lines
- **THEN** the trigger has fired, and what it asks for is extraction, promotion
  or deletion — never a second always-on file to carry what `CLAUDE.md` no
  longer holds

#### Scenario: A second file read every session

- **WHEN** the `README.md` ownership map reads a file other than `CLAUDE.md` as
  read every session
- **THEN** the check over that map fails, naming the file

### Requirement: A fact with no status is written where its reader looks

A fact that is not a status, recorded so that a later session does not reopen
it, SHALL be written at every site below that applies, the sites tested in
order:

1. a card, if it is a task;
2. a comment at the line, if it is a fence;
3. the owning spec, through a change, if it is behaviour;
4. `openspec/config.yaml` `context:`, if it is an architecture default;
5. `CLAUDE.md` or the indexed doc whose trigger matches, if it is a rule or a
   contract.

A fact the archive records SHALL be written nowhere new. An archived change
SHALL NOT be edited to receive one.

#### Scenario: An architecture default

- **WHEN** the fact is a project-wide architecture choice, such as STRATZ
  rather than OpenDota as the statistics source
- **THEN** it is written in `openspec/config.yaml` `context:`, which is read
  when a proposal is drafted — the moment someone would propose replacing it

#### Scenario: A fact its owner already states

- **WHEN** an owning site already says it, as `CLAUDE.md`'s stack line says
  Preact and Bun's bundler
- **THEN** nothing new is written

#### Scenario: A fact no site owns

- **WHEN** a fact fits none of the five sites
- **THEN** it SHALL be brought to the user, and no file SHALL be created to
  hold it — a file admitting whatever nothing else owns is what `PLAN.md` was
