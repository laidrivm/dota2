# Repo onboarding

## ADDED Requirements

### Requirement: The README states no other repository's mutable properties

`README.md` SHALL NOT describe a property of another repository that can
change without a change here — visibility, default branch, ownership. Where
such a repository is referenced, the README SHALL link to it instead.

#### Scenario: The skills repository is referenced

- **WHEN** the knowledge ownership map names the skills repository
- **THEN** the row links to `https://github.com/laidrivm/skills`
- **AND** carries no claim about whether it is public or private

### Requirement: A clone is told how to obtain the review skills

`README.md` SHALL name the command that links the shared skills into
`.claude/skills/`, and SHALL state that `/ponytail-review` comes from the
ponytail plugin rather than that repository.

#### Scenario: A fresh clone

- **WHEN** a reader clones the repo and finds `.claude/skills/` absent
- **THEN** the README names `./link.sh all <path-to-d2ass>`, run from the
  skills repo root
- **AND** says which of the five commands `CLAUDE.md` requires that supplies

### Requirement: The ownership map covers the files that own decisions

The knowledge ownership map SHALL include `.claude/settings.json` and
`.coderabbit.yaml`, which own the agent permission policy and the review-bot
configuration respectively.

#### Scenario: Reading the map to find where a decision lives

- **WHEN** a reader looks for where the denied package managers are recorded
- **THEN** the map names `.claude/settings.json`

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

- **WHEN** the map names `tasks/*.md`
- **THEN** the check passes on at least one matching file, not on literal
  existence

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
