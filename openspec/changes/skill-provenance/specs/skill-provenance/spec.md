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
so the pin cannot rot into decoration. The check MUST work from a clone, which
means it MUST NOT read through `.claude/skills/`: those symlinks point outside
the repository and resolve to nothing after `git clone`. It therefore asserts
the table's internal consistency against this file's own gate sequence, and
never the content of a skill.

#### Scenario: A gate loses its row

- **WHEN** a skill named in the pre-PR sequence has no row in the table
- **THEN** `bun test` fails

#### Scenario: An archived entry gains a commit

- **WHEN** an archived row is given a verified-at commit
- **THEN** `bun test` fails, because the commit asserts a check nothing
  depends on

#### Scenario: A row's commit is not an object name

- **WHEN** a verified-at cell holds prose such as "latest" or a date alone
- **THEN** `bun test` fails

#### Scenario: The skills are absent

- **WHEN** the test runs where `.claude/skills/` resolves to nothing
- **THEN** it still passes or fails on the table alone, never on the symlinks
