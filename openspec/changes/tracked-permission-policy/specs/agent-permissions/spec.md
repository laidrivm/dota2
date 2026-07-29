# agent-permissions delta specification

## ADDED Requirements

### Requirement: The supply-chain configuration files are gated

`.claude/settings.json` SHALL deny `Edit(.npmrc)` and ask on
`Edit(bunfig.toml)`. Both rules SHALL use the `Edit` specifier: the file
permission checks match `Edit(path)` rules only, and an `Edit` rule covers
every file-editing tool, while a `Write(path)` rule is accepted, never matched,
and warns at startup.

`.npmrc` is denied rather than asked because this repository has none and needs
none — bun reads `bunfig.toml`, so the file appearing at all is the event.
`bunfig.toml` is asked rather than denied because it legitimately carries
`[test] pathIgnorePatterns` and the release-age gate; what must not pass
unremarked is a registry key or an entry in `minimumReleaseAgeExcludes`, and
both are reached only through that file.

The boundary is a prompt, not a proof: a shell redirection writes either file
without an `Edit` call, and no permission rule matches that reliably. The
prose rule keeps its subject for that reason.

#### Scenario: A registry added to bunfig.toml

- **WHEN** the agent edits `bunfig.toml` to add a `registry` key
- **THEN** Claude Code prompts, and the edit needs the user

#### Scenario: An exclusion added to the release-age gate

- **WHEN** the agent adds an entry to `minimumReleaseAgeExcludes`
- **THEN** the same prompt fires, because the rule is scoped to the file that
  holds both keys

#### Scenario: A legitimate edit to the same file

- **WHEN** the agent edits `[test] pathIgnorePatterns`
- **THEN** the prompt fires too, which is accepted: the file changes about
  twice in a repository's life

#### Scenario: An .npmrc is created

- **WHEN** the agent attempts to create `.npmrc` anywhere under the repository
- **THEN** the call is blocked without prompting

#### Scenario: The rules use the matched specifier

- **WHEN** `.claude/settings.json` is read
- **THEN** both rules are written as `Edit(...)` and neither as `Write(...)`,
  which Claude Code accepts but never matches

### Requirement: The tracked allow list holds only what a clone can use

`.claude/settings.json` SHALL carry the allow entries this project's own
documented workflow needs, and SHALL NOT carry an entry naming an absolute path
outside the repository or a path under `/tmp`. Such an entry is a fact about
one machine, and the tracked file is read by every clone.

Entries accumulated in the untracked `.claude/settings.local.json` by
approving a prompt are not decisions: at the time of writing it holds 170, of
which 19 name a machine-local or `/tmp` path and 8 a one-off `sed`, `cp` or
`mv` against a single named file. Those SHALL be dropped rather than promoted.

#### Scenario: A machine-local entry

- **WHEN** an allow entry names `//Users/<someone>/…`
- **THEN** `bun test` fails, because the tracked file must not carry one
  machine's paths

#### Scenario: A scratch-directory entry

- **WHEN** an allow entry names a path under `/tmp`
- **THEN** `bun test` fails

#### Scenario: A workflow command

- **WHEN** the entry names a command this project's documented workflow runs
- **THEN** it belongs in the tracked file, where a clone receives it and a
  reviewer sees it

#### Scenario: The untracked file survives

- **WHEN** the curation is done
- **THEN** `.claude/settings.local.json` still exists and is still untracked;
  only what belonged in the tracked file has left it
