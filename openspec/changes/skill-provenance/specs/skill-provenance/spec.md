# skill-provenance delta specification

## ADDED Requirements

### Requirement: Every gate skill records the commit it was verified against

`docs/review-toolkit.md` SHALL carry a table naming each shared skill this
project's gates depend on and the shared-repository commit at which that
skill's documented contract in this file was last checked against its
`SKILL.md`. The commit SHALL be a full or abbreviated git object name, so the
state is nameable rather than described.

A newer commit upstream SHALL NOT be treated as a defect. It marks a
verification the next branch touching that gate owes, because the symlink
resolves to a working tree and the behaviour may already have moved.

#### Scenario: A gate skill is listed

- **WHEN** `docs/review-toolkit.md` describes `/triage` as part of the pre-PR
  sequence
- **THEN** the table carries `/triage` with the commit its contract was
  verified against

#### Scenario: The upstream repository moves

- **WHEN** the shared repository gains commits after the recorded one
- **THEN** nothing fails, and the next branch that relies on that gate
  re-checks its contract and updates the commit

#### Scenario: A contract changes upstream

- **WHEN** a skill's `SKILL.md` no longer matches what this file says it does
- **THEN** this file is corrected and the commit is advanced in the same
  change, so the pair is never half-updated

### Requirement: Skills no gate depends on are marked archived

A skill symlinked into `.claude/skills/` that is named by no gate SHALL be
listed as archived and SHALL NOT carry a verified-at commit. Recording one
would claim a check that nothing here would notice the absence of. The listing
exists so that a reader can tell an unused skill from an unrecorded dependency,
which are indistinguishable while both are merely present.

#### Scenario: An available but unused skill

- **WHEN** `session-wrapup` is symlinked and named by no gate in this
  repository
- **THEN** it appears as archived, with no commit

#### Scenario: An archived skill becomes a gate

- **WHEN** a rule or a documented sequence starts depending on an archived
  skill
- **THEN** it moves out of the archived list and gains a verified-at commit in
  the same change

### Requirement: The table is pinned by a test, within what a clone can see

The repository's test run SHALL fail when the table stops covering the gates,
so the pin cannot rot into decoration. The **active set** is defined as the
skills named in this file's pre-PR sequence together with any skill a tracked
rule in `CLAUDE.md` depends on — `playwright-cli` is a gate by such a rule and
not by the sequence. The test SHALL require exactly one active row per member
of that set, SHALL reject a duplicate row and an active row for a skill in
neither source, and SHALL require the archived list to be disjoint from the
active one.

Every one of those assertions is over a set, so the test SHALL first require
its inputs to be non-empty: the pre-PR sequence and the `CLAUDE.md` rules MUST
both be found, the active set MUST hold at least one skill, and the table MUST
yield at least one row. Without that, a renamed heading empties a source and
every exactness check passes on nothing — the failure a length assertion in
`readme-map.test.ts` already shipped once.

The check MUST work from a clone, which means it MUST NOT read through
`.claude/skills/`: the entries this change is about are symlinks pointing
outside the repository, and they resolve to nothing after `git clone`. It
therefore asserts the table's internal consistency against tracked files, and
never the content of a skill.

#### Scenario: A gate loses its row

- **WHEN** a skill named in the pre-PR sequence has no row in the table
- **THEN** `bun test` fails

#### Scenario: A source section is renamed away

- **WHEN** the pre-PR sequence heading changes and the parse yields an empty
  active set
- **THEN** `bun test` fails on the empty set itself, rather than passing every
  per-skill assertion vacuously

#### Scenario: The table is emptied

- **WHEN** the table keeps its heading but holds no rows
- **THEN** `bun test` fails

#### Scenario: An archived entry gains a commit

- **WHEN** an archived row is given a verified-at commit
- **THEN** `bun test` fails, because the commit asserts a check nothing
  depends on

#### Scenario: One gate, two rows

- **WHEN** a skill appears twice in the active table, with two commits
- **THEN** `bun test` fails, because the pin would then name two states for
  one contract

#### Scenario: An active row for a skill nothing names

- **WHEN** an active row names a skill absent from both the pre-PR sequence and
  `CLAUDE.md`'s rules
- **THEN** `bun test` fails — a commit recorded for a skill nothing depends on
  is the archived case wearing the active shape

#### Scenario: A skill in both lists

- **WHEN** a skill appears as active and as archived
- **THEN** `bun test` fails

#### Scenario: A row's commit is not an object name

- **WHEN** a verified-at cell holds prose such as "latest" or a date alone
- **THEN** `bun test` fails

#### Scenario: The skills are absent

- **WHEN** the test runs where `.claude/skills/` resolves to nothing
- **THEN** it still passes or fails on the table alone, never on the symlinks
