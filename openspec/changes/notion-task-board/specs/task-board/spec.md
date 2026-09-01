# task-board delta — notion-task-board

New capability. No version of it exists on the default branch.

## ADDED Requirements

### Requirement: The board records a task's status and nothing the tree holds

The project SHALL keep one board — the `D2ASS` database in the Notion
workspace — on which every task not yet finished, and every change already
archived, has exactly one card. A card SHALL carry its status, a title, and a
pointer to where its content lives, and SHALL NOT carry a copy of anything
the repository holds.

The prohibition is the requirement's substance rather than its caveat. The
queue this board replaces held a thirteen-line prose entry for each of
sixteen changes whose `proposal.md`, `design.md`, `tasks.md` and delta specs
were already in the tree — 216 lines restating what a directory beside them
said better. Two of those entries were wrong within a week of being written.
A second copy is checked by nothing.

Where a card's subject has a directory, the pointer SHALL be that path. Where
it has none — a finding not yet proposed — the card body is the record, and it
SHALL hold what a proposal would need: what was observed, where, and what
makes it work rather than an opinion.

#### Scenario: A card for a change that exists in the tree

- **WHEN** a card names a change with a directory under `openspec/changes/`
- **THEN** it SHALL carry that path and SHALL NOT restate the change's why,
  its scope, its measurements or its ordering

#### Scenario: A card for a finding with no change

- **WHEN** a card names work that has no directory anywhere in the tree
- **THEN** the card body SHALL be the record, and no file in the repository
  SHALL be expected to hold it

#### Scenario: A card and the tree disagreeing

- **WHEN** a card's status and the file tree disagree about a derived status
- **THEN** the tree SHALL be taken as right and the card corrected, the board
  being authoritative only for what the tree cannot express

### Requirement: Three statuses are derived and five are moved by hand

A card SHALL hold exactly one of eight statuses: `suggested`, `exploring`,
`proposing`, `ready`, `implementing`, `reviewing`, `archiving`, `done`.

`scripts/board-state.ts` SHALL derive three of them from the file tree alone
— `proposing`, `ready` and `done` — reading no network and consulting no
service, so that its whole behaviour is exercisable from a fabricated
directory:

```text
done        openspec/changes/archive/<date>-<slug>/ exists
ready       openspec/changes/<slug>/ holds proposal, design, tasks and specs/
proposing   openspec/changes/<slug>/ exists and is missing one of them
```

The remaining five SHALL be moved by whoever does the work, in the turn the
work moves, and `scripts/board-state.ts` SHALL NOT report them. Deriving them
was measured and refused: applied to the thirty archived changes, a
branch-name derivation gets fourteen wrong. Nine of those changes have no
`feat/<slug>` pull request at all, their work having shipped on `chore/` and
`fix/` branches that `docs/git-and-prs.md` permits; and a step splits, so
`snapshot-build`'s eight steps merged as sixteen pull requests and
`file-size-cap`'s eight as twenty-two, which makes "pull requests at least
steps" a coincidence rather than a test. No key in this repository joins a
pull request to its change.

#### Scenario: A complete change directory, no step applied

- **WHEN** a directory under `openspec/changes/` holds `proposal.md`,
  `design.md`, `tasks.md` and a `specs/` directory
- **THEN** the derived status SHALL be `ready`

#### Scenario: A change directory missing an artefact

- **WHEN** a directory holds `proposal.md` and delta specs but no `tasks.md`,
  as a split proposal's first branch leaves it
- **THEN** the derived status SHALL be `proposing`, and SHALL NOT be `ready`

#### Scenario: An archived change

- **WHEN** a slug has a directory under `openspec/changes/archive/`
- **THEN** the derived status SHALL be `done`, whatever else the tree holds
  for that slug

#### Scenario: A status the tree cannot see

- **WHEN** a card sits at `implementing`, `reviewing`, `archiving`,
  `suggested` or `exploring`
- **THEN** `scripts/board-state.ts` SHALL report nothing for it, and a
  reconciliation SHALL leave it untouched rather than resetting it to a
  derived value

#### Scenario: The derivation reaches no network

- **WHEN** `scripts/board-state.ts` runs with no network route and no
  connector attached
- **THEN** it SHALL produce its full output, every status coming from the
  file tree

### Requirement: A card names what blocks it, derived from the tree

A card SHALL name the tasks that must land before it can be taken up, and
`scripts/board-state.ts` SHALL derive that set from an `after:` list in each
change's `.openspec.yaml` — never from the board, and never from the prose of
a proposal's `## Ordering`.

A change's `after:` list SHALL name the slugs its `## Ordering` section
argues for, and that section SHALL keep the argument: the list is the fact and
the prose is the reason, so a reader asking *why* this order is not sent to a
YAML file and a session asking *what is takeable* is not sent to sixteen
proposals.

A card whose `after:` names a slug that is not `done` SHALL be reported as
blocked, and a session choosing work SHALL NOT take it. Blocked SHALL be
**computed at the time of asking** rather than stored on the card: it is a
fact about what has landed, so a card that holds it goes stale the moment its
predecessor is archived, and nothing points at the staleness. What is stored
is the `after:` list, which changes only when the ordering argument does.

This is worth deriving where `implementing` was not, and the difference is
that a key exists. `## Ordering` names its predecessors as slugs, and a slug
is exactly what identifies a change directory; the pull-request derivation
failed because nothing joined a pull request to its change. Prose is still
not the source — *after `laning-phase-model`*, *`candidacy-gate` must be
applied and synced first*, and *SHOULD NOT be applied before
`outcome-calibration`* are three phrasings of one relation and one of them is
a negation, so the list is written rather than parsed out.

Measured on the prose as it stands. Six of the seventeen changes have a
predecessor, and taking every change slug an `## Ordering` section mentions
gets the predecessor set right for two of them. For the other four it adds
slugs that are not dependencies — a section argues about the changes around
it, not only the ones before it — and for two of those four the added slug is
a **successor** read as a predecessor: `laning-phase-model`'s section names
`suggestion-calibration`, which comes after it, and `lane-synergy-model`'s
does the same. An edge derived backwards blocks a task on work that is
waiting for it.

#### Scenario: A change whose predecessor has not landed

- **WHEN** a card's `after:` names a slug whose derived status is not `done`
- **THEN** the card SHALL be reported as blocked by that slug, and a session
  choosing work SHALL pass over it

#### Scenario: A change whose predecessors have all landed

- **WHEN** every slug in a card's `after:` is `done`
- **THEN** the card SHALL be reported as takeable, and the `after:` list SHALL
  NOT be emptied — what unblocked it stays readable

#### Scenario: A change with no ordering constraint

- **WHEN** a change's `.openspec.yaml` carries no `after:` key, as eleven of
  the seventeen do
- **THEN** it SHALL be reported as takeable, and the absent key SHALL NOT be
  read as an unmeasured or malformed one

#### Scenario: An `after:` naming a slug that does not exist

- **WHEN** an `after:` list names a slug with no directory under
  `openspec/changes/` and none under `openspec/changes/archive/`
- **THEN** the derivation SHALL fail naming the slug and the file, rather than
  treating the unresolvable name as landed — a typo that reads as `done`
  unblocks a task nothing has unblocked

### Requirement: The board is read through a saved view

A session SHALL read the board through a saved board view, grouped by status,
and SHALL NOT read it with a SQL query against the data source.

This is a quota, not a preference. On this workspace's plan `query_data_sources`
is limited: view mode carries no tool-specific quota on any plan, while SQL
mode draws on a shared workspace usage limit and cannot span data sources.
Reading the queue is the one operation every session performs, so putting it
on the metered path spends the limit on the routine case and leaves nothing
for the exceptional one.

#### Scenario: A session starting work

- **WHEN** a session needs to know what is open and at what status
- **THEN** it SHALL query the saved board view, and the view's grouping SHALL
  be what supplies the statuses rather than a filter written at the call site

#### Scenario: A question the view does not answer

- **WHEN** an answer needs a query the saved view cannot express
- **THEN** a further view SHALL be saved for it rather than a SQL query
  issued, unless the question is asked once — a one-off SHALL say in the turn
  that it spent the metered path and why

### Requirement: A stage that completes moves its card in the same turn

WHEN a task changes stage — a proposal merges, a step's branch opens, a pull
request opens or merges, a change is archived — the card SHALL be moved in the
same turn, before the work is reported as done.

This replaces the obligation `docs/feature-workflow.md` states towards
`PLAN.md`, and it exists because that obligation was not met twice in one
week: an entry read `not yet proposed` after its proposal merged, and the
entry recording the always-on measurement read 743 against a measured 851.
Moving the obligation to a board does not by itself fix that, and this
requirement is the part that has to be honoured rather than the part that is
mechanised — the three derived statuses are the ones a reconciliation can
repair, and these five are not.

#### Scenario: A proposal merges

- **WHEN** a change's `spec/<slug>` pull request merges and its directory
  becomes complete
- **THEN** the card SHALL read `ready` in that same turn, and a later
  reconciliation SHALL find nothing to correct

#### Scenario: A stage moved and not recorded

- **WHEN** a reconciliation finds a card whose derived status disagrees with
  the tree
- **THEN** it SHALL be corrected and the correction SHALL be reported, a
  silent repair leaving nobody aware the obligation was missed
