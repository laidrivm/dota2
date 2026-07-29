# agent-permissions delta specification

## ADDED Requirements

### Requirement: The supply-chain configuration files are gated

`.claude/settings.json` SHALL deny `Edit(.npmrc)` and ask on
`Edit(bunfig.toml)`. Both rules SHALL use the `Edit` specifier: the file
permission checks match `Edit(path)` rules only, and an `Edit` rule covers
every file-editing tool, while a `Write(path)` rule is accepted, never matched,
and warns at startup.

`.npmrc` is denied rather than asked because bun reads it — `bun install
--help` on 1.3.14 lists `.npmrc` beside `bunfig.toml` and the environment as a
registry source that `--registry` overrides — and this repository deliberately
has none. It is a live channel with no legitimate content here, so the file
appearing at all is the event. `bunfig.toml` is asked rather than denied
because it legitimately carries `[test] pathIgnorePatterns` and the
release-age gate; what must not pass unremarked is a registry key or an entry
in `minimumReleaseAgeExcludes`, and both are reached only through that file.

The boundary is a prompt, not a proof, and the capability SHALL say so rather
than imply otherwise. Three things pass it: a shell redirection writes either
file without an `Edit` call and no `Bash(...)` pattern matches a redirection
reliably; a permission mode such as `acceptEdits` or `bypassPermissions`
answers the prompt without the user; and a subprocess writes outside the tool
layer entirely. The prose rule in `CLAUDE.md` keeps its subject for that
reason, where a rule fully replaced by a mechanism is deleted.

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
documented workflow needs. An entry whose path leaves the repository SHALL NOT
appear in it: such an entry is a fact about one machine, and the tracked file
is read by every clone.

**Leaving the repository is decided by normalising, not by matching a shape.**
The check resolves each path in an entry — expanding `~` and any environment
reference, then collapsing `.` and `..` — and requires the result to stay under
the repository root. A blacklist of `//Users/` and `/tmp` would pass
`Edit(../../secrets/**)`, which escapes by a different spelling.

Two kinds of unwanted entry are separated by what a test can see. The path
criterion above is **pinned by a test**. Whether an entry is a one-off — a
`sed`, `cp` or `mv` against a single named file, repo-relative and so
indistinguishable by path — is a **review criterion**: the curation names its
promotions and the largest dropped group in the pull request body, because no
check can tell a command that is policy from one that was convenient once.

Entries accumulated in the untracked `.claude/settings.local.json` by approving
a prompt are not decisions: at the time of writing it holds 170, of which 19
name a machine-local or `/tmp` path and 8 a one-off `sed`, `cp` or `mv`.

#### Scenario: A machine-local entry

- **WHEN** an allow entry names `//Users/<someone>/…`
- **THEN** `bun test` fails, because the tracked file must not carry one
  machine's paths

#### Scenario: A scratch-directory entry

- **WHEN** an allow entry names a path under `/tmp`
- **THEN** `bun test` fails

#### Scenario: An entry that escapes by traversal

- **WHEN** an allow entry names `../../something` or a `~`-rooted path that
  normalises outside the repository
- **THEN** `bun test` fails, because containment is decided after
  normalisation and not by the spelling

#### Scenario: A one-off command with a repo-relative path

- **WHEN** an allow entry names a `sed -i` against one file inside the
  repository
- **THEN** no test fails, and the curation is answerable for it in the pull
  request body — the criterion is a review one, because the entry is
  indistinguishable from policy by path alone

#### Scenario: A workflow command

- **WHEN** the entry names a command this project's documented workflow runs
- **THEN** it belongs in the tracked file, where a clone receives it and a
  reviewer sees it

#### Scenario: The untracked file survives

- **WHEN** the curation is done
- **THEN** `.claude/settings.local.json` still exists and is still untracked;
  only what belonged in the tracked file has left it
