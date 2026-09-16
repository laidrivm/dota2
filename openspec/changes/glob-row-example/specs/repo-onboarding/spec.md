# repo-onboarding delta — glob-row-example

The requirement is copied whole from the live spec and one scenario's `WHEN`
is edited; the other six and the requirement's own text are untouched, which a
`MODIFIED` replacement requires and a reader of the diff should be able to see
at a glance.

## MODIFIED Requirements

### Requirement: Every path the map names is real and shipped

The test run SHALL fail when a path named in the ownership map does not
resolve in the repository. Resolution MUST accept a literal file, a
directory, and a glob matching at least one file. A path that exists locally
but is not tracked by git MUST NOT satisfy the check, so the test cannot pass
on a maintainer's machine and fail in a clone.

#### Scenario: A doc is renamed but the map is not

- **WHEN** `docs/testing.md` is renamed and the map still names it
- **THEN** `bun test` fails, naming that row

#### Scenario: A glob row

- **WHEN** a row's path carries a glob, as `docs/research/*` does
- **THEN** the check passes on at least one matching file, not on literal
  existence

The trigger is the shape of the path rather than one row of today's map. A
scenario that fires on a named row stops firing when a change deletes that
row, which is what happened to the `tasks/*.md` this one used to name: the
criterion went on being enforced and went on reading as though it were not.
The row above illustrates the shape and the scenario survives its deletion.

#### Scenario: A directory row

- **WHEN** the map names `spec-inbox/`
- **THEN** the check passes on the directory

#### Scenario: A row with two backticked spans

- **WHEN** the map names `openspec/config.yaml` → `context:`
- **THEN** only the first span is treated as a path

#### Scenario: A gitignored row

- **WHEN** the map names `.claude/skills/`, which `.gitignore` covers
- **THEN** the row is not asserted to exist, since a clone does not have it

#### Scenario: The table shape changes

- **WHEN** no row can be parsed out of the map
- **THEN** `bun test` fails rather than passing on an empty set

#### Scenario: A row loses its path

- **WHEN** a row's first cell carries no backticked span
- **THEN** `bun test` fails, since fewer paths were parsed than the table has
  rows
