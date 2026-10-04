# harness-consumption

## Purpose

How this repository takes in the agent harness it shares with other projects:
one dependency pinned to a commit, what resolves from it in a session, in CI
and for the review bot, which values stay this repository's own, and how a
clone that has not installed yet is not locked out by the harness's own guard.

## ADDED Requirements

### Requirement: The harness is one dependency pinned to a commit

`package.json` SHALL name the harness exactly once, by a GitHub specifier
whose reference is a full 40-character commit hash. The manifest check SHALL
accept that form and SHALL reject a harness specifier naming a branch, a tag,
an abbreviated hash or no reference, naming the entry it rejected.

#### Scenario: Pinned to a commit

- **WHEN** `package.json` names the harness as
  `github:laidrivm/harness#<40 lowercase hex characters>`
- **THEN** the manifest check SHALL pass on that entry

#### Scenario: Pinned to something that moves

- **WHEN** the harness specifier ends in `#main`, in a tag, in a hash shorter
  than 40 characters, or in no `#` reference at all
- **THEN** the manifest check SHALL fail and SHALL name the entry

#### Scenario: A non-harness Git specifier

- **WHEN** any other dependency is named by a Git specifier, pinned or not
- **THEN** the manifest check SHALL fail on it as it fails on a range — the
  commit-hash form is admitted for the harness alone

### Requirement: The skills resolve from the pinned package

Every entry under `.claude/skills/` SHALL be a tracked symbolic link whose
target is a relative path into the installed harness package, and a check
SHALL fail on an entry that is not a link, that points anywhere else, or that
does not resolve after `bun install`, naming the entry.

#### Scenario: A link into the package

- **WHEN** `.claude/skills/triage` is a tracked link to
  `../../node_modules/harness/core/skills/triage` and that directory holds a
  `SKILL.md` after `bun install`
- **THEN** the check SHALL pass on it

#### Scenario: A link into another checkout

- **WHEN** an entry links to a path outside `node_modules/harness/`, such as a
  sibling working tree
- **THEN** the check SHALL fail naming the entry and its target

#### Scenario: A link the package no longer carries

- **WHEN** a pin bump removes a skill that `.claude/skills/` still links to
- **THEN** the check SHALL fail naming the dangling entry

### Requirement: The harness rules are a tracked copy of the pinned package

The rules and docs the harness ships for every project SHALL be held in this
repository as a tracked copy, `CLAUDE.md` SHALL import that copy, and a check
SHALL fail when any file of the copy differs from the installed package at
the pinned commit or is missing from either side, naming the file.

#### Scenario: A copy in step with the pin

- **WHEN** every file in the copy is byte-identical to its counterpart in the
  installed package and neither side holds a file the other lacks
- **THEN** the check SHALL pass

#### Scenario: A copy edited by hand

- **WHEN** a file in the copy is edited in this repository
- **THEN** the check SHALL fail naming that file, an edit to a harness rule
  belonging in the harness repository

#### Scenario: A pin bumped without refreshing the copy

- **WHEN** the pinned commit changes and the copy is left as it was
- **THEN** the check SHALL fail naming every file that differs

### Requirement: The guard does not lock out a clone that has not installed

WHILE the installed harness package is absent, the Bash `PreToolUse` hook SHALL
allow `bun install` and SHALL block every other command with a message naming
`bun install` as what to run, rather than failing every command alike.

#### Scenario: A fresh clone

- **WHEN** a session in a clone with no `node_modules/` runs `bun install`
- **THEN** the hook SHALL let it run

#### Scenario: Any other command before the install

- **WHEN** the same session runs any other command, `git status` included
- **THEN** the hook SHALL block it and its message SHALL name `bun install`

#### Scenario: After the install

- **WHEN** the package is installed
- **THEN** every command SHALL be decided by the harness's guard alone

### Requirement: The values a gate runs with are this repository's

The values a harness gate is run with here — the module mutated and its
surviving-mutant floor, the files allowed at the root, the approved
suppressions, the diff-budget exclusions — SHALL be held in a tracked file of
this repository, and no gate the harness package ships SHALL carry one of
them in its own source.

#### Scenario: Raising the mutation floor

- **WHEN** the floor for `src/model.ts` changes
- **THEN** the change SHALL touch a file of this repository and no file of the
  harness

#### Scenario: A d2ass value in a gate

- **WHEN** the non-test source of the installed package's gates is searched
  for `src/model.ts` or `src/fixtures/snapshot.json`
- **THEN** no file SHALL match — the moved specs, changes and docs may still
  name d2ass, and are outside what this scenario searches

### Requirement: CI runs the gates from the same pin

Every workflow that runs a harness gate SHALL run it from the package
`bun install` placed in `node_modules/`, and no workflow SHALL check out the
harness repository by itself, so a session, a hook and CI are never on two
different commits of it.

#### Scenario: A workflow running a gate

- **WHEN** `diff-budget.yml`, `lint.yml` or `mutation.yml` runs a harness gate
- **THEN** the gate's path SHALL be under `node_modules/harness/`, reached
  after the workflow's `bun install`

#### Scenario: A second checkout

- **WHEN** a workflow adds an `actions/checkout` of `laidrivm/harness`, or
  calls a reusable workflow from it
- **THEN** a check over `.github/workflows/` SHALL fail naming the workflow
