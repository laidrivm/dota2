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
than imply otherwise — but the two rules do not leak alike, and the difference
was measured rather than assumed. On Claude Code 2.1.221, a Bash output
redirection whose target is a denied path is refused: `printf … >
tmpprobe/.npmrc` was blocked while `printf … > tmpprobe/other.txt` in the same
directory went through. The same session's `ask` rule did not gate an append
redirection to `bunfig.toml`, which landed with no prompt.

So the deny half covers the redirection route and the ask half does not, and
what still passes both is a permission mode such as `acceptEdits` or
`bypassPermissions`, which answers a prompt without the user, and a subprocess,
which writes outside the tool layer entirely. The prose rule in `CLAUDE.md`
keeps its subject for that reason, where a rule fully replaced by a mechanism
is deleted.

The scenarios below describe a tool-layer call under a permission mode that
honours the configured rules. That is the scope the rules have, not a
qualification bolted onto them: the paragraph above names what falls outside
it, and the three content scenarios further down — the ones that fail on a
settled value rather than on a call — are what cover those routes instead.

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
- **AND** a Bash output redirection to that path is blocked too, which is the
  one route the deny half covers and the ask half does not

#### Scenario: The rules use the matched specifier

- **WHEN** `.claude/settings.json` is read
- **THEN** both rules are written as `Edit(...)` and neither as `Write(...)`,
  which Claude Code accepts but never matches

Because the prompt is partial, the two keys it stands in front of SHALL also be
pinned by their settled value. A test that reads the content catches every
route the rules miss — the redirection, the permission mode and the subprocess
alike — after the write rather than before it. This is not the rejected hook:
it parses no edit and registers nothing, it reads two files the repository
already ships.

#### Scenario: A registry reaches bunfig.toml by a route the prompt misses

- **WHEN** `bunfig.toml` carries a `registry` key under `[install]`
- **THEN** `bun test` fails, whichever call wrote it

#### Scenario: A route to a registry the check was not written against

- **WHEN** `[install]` carries any key beyond `exact`, `minimumReleaseAge` and
  `minimumReleaseAgeExcludes` — a scoped override under `[install.scopes]`,
  say
- **THEN** `bun test` fails on the key set, because the check pins what the
  section holds rather than enumerating the routes to a registry, and no
  enumeration stays complete

#### Scenario: A reserved key weakened rather than added

- **WHEN** `exact` is flipped to `false`, or `minimumReleaseAge` wound down
  from `259200`
- **THEN** `bun test` fails, because the section is pinned by value and not
  only by key set — a boundary weakened from inside is not an added key

#### Scenario: The release-age gate is given an exemption

- **WHEN** `minimumReleaseAgeExcludes` holds any entry
- **THEN** `bun test` fails, because the file's own comment reserves that key
  for an explicit user decision

#### Scenario: An .npmrc reaches a clone

- **WHEN** a file named `.npmrc` is tracked at any depth
- **THEN** `bun test` fails, because the deny rule's premise is that this
  repository has none

### Requirement: The tracked allow list holds only what a clone can use

`.claude/settings.json` SHALL carry the allow entries this project's own
documented workflow needs. An entry whose path leaves the repository SHALL NOT
appear in it: such an entry is a fact about one machine, and the tracked file
is read by every clone.

**The entries are not uniformly paths, so the check is two rules over two
forms.** Of the 170 entries as they stand, 145 are `Bash(...)` — a command
string — and 6 are `Read(...)`, a path specifier.

1. **Every entry, whatever its tool**: no absolute path token — nothing
   beginning `/`, `//` or `~/`. A command this project's workflow runs needs
   none: `bun test`, `gh pr view *`, `bunx openspec validate *` are all
   relative or pathless. This is lexical, so it needs no shell parsing, and it
   catches `Bash(cp … /tmp/c.bak)` and `Read(//Users/…/skills/**)` by the same
   sentence.
2. **Path-specifier rules only** — `Read(...)` and `Edit(...)`, whose
   specifier is a path by definition: resolve it against the repository root,
   collapsing `.` and `..`, and require the result to stay inside. This is what
   catches `Edit(../../secrets/**)`, which carries no absolute token.

A `Bash` entry is deliberately **not** parsed for paths inside its command.
Extracting them means handling quoting, globs, redirections and expansions —
a shell parser, to gate a file that a human reads on review. Rule 1 is what
covers that class, and it covers it by forbidding the shape rather than by
understanding the command.

Unset environment references and symlinks are out of scope for both rules: the
check reads a settings file, it does not touch the filesystem, so it never
resolves a symlink and never expands a variable whose value it cannot know.

Two kinds of unwanted entry are separated by what a test can see. The path
criterion above is **pinned by a test**. Whether an entry is a one-off — a
`sed`, `cp` or `mv` against a single named file, repo-relative and so
indistinguishable by path — is a **review criterion**: the curation names its
promotions and the largest dropped group in the pull request body, because no
check can tell a command that is policy from one that was convenient once.

Entries accumulated in the untracked `.claude/settings.local.json` by approving
a prompt are not decisions: at the time of writing it holds 170, of which 19
name a machine-local or `/tmp` path and 8 a one-off `sed`, `cp` or `mv`.

An entry SHALL NOT restate one the `deny` or `ask` list already carries.
Whether `allow` outranks `ask` is not settled here; the entry is refused
either way, because it either re-opens a gate or reads as a grant while doing
nothing.

#### Scenario: An allow entry restates a gated one

- **WHEN** `permissions.allow` carries `Edit(bunfig.toml)`, which `ask`
  already holds
- **THEN** `bun test` fails

#### Scenario: A machine-local entry

- **WHEN** an allow entry names `//Users/<someone>/…`
- **THEN** `bun test` fails, because the tracked file must not carry one
  machine's paths

#### Scenario: A scratch-directory entry

- **WHEN** an allow entry names a path under `/tmp`
- **THEN** `bun test` fails

#### Scenario: An absolute path inside a command

- **WHEN** an allow entry is `Bash(cp src/x.css /tmp/x.bak)`
- **THEN** `bun test` fails on the absolute token, without the command being
  parsed

#### Scenario: A path specifier that escapes by traversal

- **WHEN** an allow entry is `Edit(../../secrets/**)`, which carries no
  absolute token
- **THEN** `bun test` fails, because a path specifier is also resolved against
  the repository root

#### Scenario: A pathless workflow command

- **WHEN** an allow entry is `Bash(bun test)` or `Bash(gh pr view *)`
- **THEN** neither rule fires: there is no absolute token and no path
  specifier to resolve

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
