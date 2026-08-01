# agent-permissions Specification

## Purpose

Which tool permissions this repository's checked-in Claude Code settings
grant, deny and prompt for, and how a vendored skill's own frontmatter
claims — what it may run, and who may invoke it — are reconciled against
this project's policy. It exists because permission rules are enforced by
Claude Code and prose is not: a supply-chain rule written only in
`CLAUDE.md` shapes what the agent attempts and stops nothing.

## Requirements
### Requirement: Foreign package managers are denied

The repository's tracked Claude Code settings SHALL deny the package managers
this project can reach other than `bun`. `.claude/settings.json` MUST carry
`permissions.deny` entries matching `npx`, `npm`, `pnpm` and `yarn` with a
trailing-space wildcard, so each matches the bare command and any invocation
of it. That enumeration is the policy; a manager absent from it is not denied.

#### Scenario: Denied manager in a plain command

- **WHEN** the agent attempts `npx playwright install`
- **THEN** Claude Code blocks the call without prompting, because `deny` is
  evaluated before `ask` and `allow`

#### Scenario: Denied manager hidden in a compound command

- **WHEN** the agent attempts `bun run build && npx some-tool`
- **THEN** Claude Code blocks the call, because a permission rule is matched
  against each subcommand independently across `&&`, `||`, `;`, `|`, `|&`,
  `&` and newlines

#### Scenario: A command that merely starts with a denied name

- **WHEN** the agent attempts `npmlog --version`
- **THEN** the call is not blocked by these rules, because the trailing-space
  wildcard enforces a word boundary

### Requirement: Deny overrides grants from any other source

A denied command SHALL stay blocked regardless of which source pre-approved
it — a vendored skill's `allowed-tools` frontmatter, the untracked
`.claude/settings.local.json`, or a user-level settings file. Permission
rules merge across scopes and are evaluated deny-first, so no allow entry
can re-open a denied command.

#### Scenario: A vendored skill pre-approves a denied command

- **WHEN** `/playwright-cli` is invoked, whose frontmatter reads
  `allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`
- **AND** the agent attempts `npx playwright test`
- **THEN** Claude Code blocks the call, and the skill's `playwright-cli` grant
  keeps working

#### Scenario: A stale local allow entry names a denied command

- **WHEN** `.claude/settings.local.json` carries `Bash(npm view *)` under
  `permissions.allow`
- **AND** the agent attempts `npm view preact`
- **THEN** Claude Code blocks the call

### Requirement: GitHub write commands are denied

`permissions.deny` in `.claude/settings.json` SHALL carry entries for the
GitHub CLI commands that publish text on the user's behalf: `gh pr comment`,
`gh issue comment` and `gh pr review`, each with a trailing-space wildcard.
`gh pr create` SHALL NOT be denied: opening the pull request is the last step
of the feature workflow, offered by the agent and taken only after the user
says go. The prose rule *Never post to a PR, issue, or any external service on
the user's behalf* SHALL be narrowed to name what it forbids — replying,
commenting and reviewing — so that it no longer reads as covering the PR the
user asked for.

A deny entry matches the command word literally, so `/opt/homebrew/bin/gh pr
comment` reaches none of them. The deny entries are therefore the cheap first
pass and not the boundary: the same three writes SHALL also be blocked by the
guard below, which resolves the command to its base name and so sees the
wrapped spellings. The two are not a rule stated twice — the guard is a
superset, and a deny entry can only ever be redundant, never wrong.

#### Scenario: The agent tries to reply to a review

- **WHEN** the agent attempts `gh pr comment 37 --body "fixed"`
- **THEN** Claude Code blocks the call without prompting

#### Scenario: A denied command hidden in a compound command

- **WHEN** the agent attempts `git push && gh pr review 37 --approve`
- **THEN** Claude Code blocks the call, because each subcommand is matched
  independently

#### Scenario: Opening a pull request still works

- **WHEN** the agent attempts `gh pr create --title … --body …`
- **THEN** the call is not blocked by these rules

#### Scenario: Reading a pull request still works

- **WHEN** the agent attempts `gh pr view 37 --json state`
- **THEN** the call is not blocked, because the deny list names write commands
  only

### Requirement: The git prohibitions are enforced by a hook

Two git prohibitions cannot be expressed as prefix-matched permission entries,
because their trigger is repository state or an argument in any position. They
SHALL be enforced by a single `PreToolUse` hook registered in the tracked
`.claude/settings.json`. The hook SHALL read the invoked command
from the event JSON on stdin rather than pattern-matching the raw payload, so
a `--force` appearing in a command's description cannot trigger it. It SHALL
block by exiting **2** with the reason on stderr — the only code Claude Code
treats as blocking — and SHALL exit 2 for an event it cannot decide as well: a
malformed payload, an absent command field or a git call that fails. Every
other non-zero code lets the command run, so the undecidable case fails closed
or it does not fail at all. It SHALL depend on nothing beyond git and bun, both
of which the repository already requires.

A guard that never starts is the undecidable case too, and the script cannot
answer for it: an unresolved path or an absent `bun` exits **1**, which lets the
command run. The registered command SHALL therefore carry an `|| exit 2`
fallback, so every failure to launch blocks as well.

The hook SHALL carry no `if` field, and SHALL therefore run on every Bash call.
The `if` field takes a permission pattern, and a permission pattern matches the
command word literally: `/usr/bin/git commit` and `command gh pr comment` reach
no hook narrowed that way, which was demonstrated against the registered guard
before this requirement was written. Narrowing by `if` would mean the boundary
is whatever spelling the pattern anticipates. Deciding in the script instead
costs one bun start per Bash call, measured at 16-22 ms — negligible beside the
call it precedes — and the script SHALL resolve each command to its base name,
past a leading assignment, past a wrapper word such as `command`, `builtin`,
`exec` or `env`, and into a shell's `-c` argument.

The residual ceiling is a command whose text does not contain the guarded name
at all — `python -c` spawning a subprocess, or anything encoded. That is
accepted: the guard exists for an agent that writes `git` and `gh` because the
documentation and this repository's prose do, not for an adversary.

The hook SHALL block a commit while `HEAD` is on `main`, and SHALL block any
force-push, whether written as `--force`, `--force-with-lease`, `-f` or bundled
into a short-flag group such as `-uf`, which git reads as `-u -f`, and wherever
the flag sits in the command. This is stricter than the prose it replaces, which
forbade force-pushing only after a pull request was open: the agent loses
force-push entirely, and the user keeps it.

The script SHALL find the git command inside a compound one by splitting only
on separators outside quotes. A split that ignores quoting cuts both ways: it
severs a force flag from its command, and it turns a quoted `;` inside a
`--grep` argument into a fragment that reads as a commit. Quoting SHALL be
removed from the words it yields as well, so a value containing a space —
`GIT_AUTHOR_NAME="Jane Doe" git commit`, `git -C "some path" commit` — does not
break the command's resolution. A command substitution SHALL start a command
even inside double quotes, in **both** POSIX spellings, `$(…)` and backticks:
the shell expands them there alike, so honouring one and not the other leaves
the guard walked around by the other.

The branch SHALL be read from the repository the commit would land in — the
`-C` target when the command names one — and not from the guard's own working
directory, which is a different repository in exactly that case.

The long force flags SHALL be matched by the `--force` prefix rather than by
their full spellings. Git accepts any unambiguous abbreviation, so `--force-w`
and `--force-i` reach the force-push path while `--forc` and `--fo` are
rejected as ambiguous — every spelling git honours therefore begins with
`--force`.

#### Scenario: A commit attempted on main

- **WHEN** `HEAD` is on `main` and the agent attempts `git commit -m "fix"`
- **THEN** the hook blocks the call and the reason names branching first

#### Scenario: A commit on a feature branch

- **WHEN** `HEAD` is on `feat/something` and the agent attempts `git commit`
- **THEN** the hook allows the call

#### Scenario: A commit reached through a compound command

- **WHEN** `HEAD` is on `main` and the agent attempts `git add -A && git
  commit -m "fix"`
- **THEN** the hook blocks the call

#### Scenario: A commit reached through a command that does not start with git

- **WHEN** `HEAD` is on `main` and the agent attempts `bun test && git commit
  -m "fix"`
- **THEN** the hook blocks the call, because the script scans every subcommand
  and not the command string's prefix

#### Scenario: A guarded command reached by another spelling

- **WHEN** the agent attempts `/usr/bin/git commit` on `main`, `command gh pr
  comment 37 --body x`, or `bash -c "git commit"` on `main`
- **THEN** the hook blocks each one, because the script resolves the command to
  its base name rather than matching the word as written

#### Scenario: A guarded command behind a quoted value containing a space

- **WHEN** `HEAD` is on `main` and the agent attempts
  `GIT_AUTHOR_NAME="Jane Doe" git commit -m "fix"`
- **THEN** the hook blocks the call — splitting on whitespace alone would
  resolve the invocation to the tail of the quoted value instead of to `git`

#### Scenario: A guarded command inside a backtick substitution

- **WHEN** `HEAD` is on `main` and the agent attempts
  ``echo "`git commit -m fix`"``
- **THEN** the hook blocks the call, as it does for the `$(…)` spelling

#### Scenario: A forbidden command appearing only as text

- **WHEN** the agent attempts `printf 'git push --force'`
- **THEN** the hook allows the call — the guard reads invocations, and a quoted
  argument is data

#### Scenario: A command that merely ends in a guarded name

- **WHEN** the agent attempts `mygit commit -m "fix"` on `main`
- **THEN** the hook allows the call — the base name is `mygit`, not `git`

#### Scenario: A gh write reached by an absolute path

- **WHEN** the agent attempts `/opt/homebrew/bin/gh pr comment 37 --body x`
- **THEN** the hook blocks the call, which is the case the deny entry cannot see

#### Scenario: A gh write behind a global flag

- **WHEN** the agent attempts `gh --repo owner/name pr comment 37 --body x`
- **THEN** the hook blocks the call, because the pair is matched wherever it
  sits and not as the first two words

#### Scenario: A force-push with the flag last

- **WHEN** the agent attempts `git push origin feat/x --force`
- **THEN** the hook blocks the call, although no command-prefix pattern would
  have matched it

#### Scenario: A force flag bundled with another short flag

- **WHEN** the agent attempts `git push -uf origin feat/x`
- **THEN** the hook blocks the call, because git reads the group as `-u -f`

#### Scenario: A separator inside a quoted argument

- **WHEN** the agent attempts `git push origin "a;b" --force`
- **THEN** the hook blocks the call, because the `;` is inside quotes and does
  not start a second command that the flag would fall outside of

#### Scenario: An abbreviated force flag

- **WHEN** the agent attempts `git push --force-w origin feat/x`
- **THEN** the hook blocks the call, because git resolves the abbreviation to
  `--force-with-lease`

#### Scenario: A git command hidden in a command substitution

- **WHEN** the agent attempts `echo "$(git push --force origin feat/x)"`
- **THEN** the hook blocks the call

#### Scenario: A commit aimed at another repository

- **WHEN** `HEAD` here is on `feat/x` and the agent attempts `git -C ../other
  commit -m "fix"` where `../other` is on `main`
- **THEN** the hook blocks the call, because `-C` names where the commit lands

#### Scenario: A lease-guarded force-push

- **WHEN** the agent attempts `git push --force-with-lease`
- **THEN** the hook blocks the call — the boundary is the rewrite, not how
  carefully it is guarded

#### Scenario: An ordinary push

- **WHEN** the agent attempts `git push -u origin feat/x`
- **THEN** the hook allows the call

#### Scenario: The word force appears only in the description

- **WHEN** the agent attempts `git push origin feat/x` with the description
  "force the branch up to date"
- **THEN** the hook allows the call, because it reads the command field and
  not the whole payload

### Requirement: Every manifest-mutating invocation prompts

`permissions.ask` in `.claude/settings.json` SHALL cover every invocation form
that changes the project's dependency record — `package.json` or the lockfile.
That is bun's install family, `bun add`, `bun install` and `bun remove`, with
each alias `bun` documents for them; `bun update`, `bun patch` and its
undocumented equivalent `bun patch-commit`; and the `bun pm` subcommands that
edit `package.json` directly — `pkg`, `version` and `trust`. It SHALL carry no
entry naming a denied package manager, because an `ask` rule for a denied
command can never be reached, and no entry broad enough to capture a read-only
command — save `bun pm pkg get`, which the single `bun pm pkg` entry prompts for
by design. Claude Code matches a permission pattern against the literal command
string, so an alias is a separate entry and not a variant of one.

Unlike `deny`, an `ask` entry does not override a grant from another source: a
broader `allow` pattern in `.claude/settings.local.json` or a user-level
settings file suppresses the prompt. This repository cannot test that, because
the local file is gitignored, so the requirement holds only where no broader
grant exists.

#### Scenario: A broader local allow entry suppresses the prompt

- **WHEN** `.claude/settings.local.json` carries `Bash(bun *)` under
  `permissions.allow`
- **AND** the agent attempts `bun add preact`
- **THEN** Claude Code does not prompt, and no test in this repository detects
  it

#### Scenario: Adding a dependency

- **WHEN** the agent attempts `bun add preact`
- **THEN** Claude Code prompts the user for approval

#### Scenario: The same command through its alias

- **WHEN** the agent attempts `bun a preact`, `bun i`, or any of `bun rm`,
  `bun r` and `bun uninstall`
- **THEN** Claude Code prompts, because each alias carries its own `ask` entry

#### Scenario: Removing a dependency

- **WHEN** the agent attempts `bun remove preact`
- **THEN** Claude Code prompts, because removal writes `package.json` and the
  lockfile

#### Scenario: A subcommand that edits the manifest directly

- **WHEN** the agent attempts `bun pm pkg set sideEffects=false`,
  `bun pm version patch`, `bun update --latest` or `bun patch --commit`
- **THEN** Claude Code prompts, because each rewrites `package.json` without
  going through the install family

#### Scenario: trustedDependencies is never granted silently

- **WHEN** the agent attempts `bun pm trust some-package`
- **THEN** Claude Code prompts, because `CLAUDE.md` reserves that decision for
  the user

#### Scenario: A read-only sibling is not captured

- **WHEN** the agent attempts `bun pm untrusted` or `bun pm why preact`
- **THEN** Claude Code does not prompt, because surfacing that output is how
  the user reaches the `trustedDependencies` decision

#### Scenario: Settings carry no unreachable ask rule

- **WHEN** `.claude/settings.json` is read
- **THEN** no string under `permissions.ask` names `npx`, `npm`, `pnpm` or
  `yarn`

### Requirement: Who may invoke a skill is enforced, not narrated

Where this project restricts who may invoke a vendored skill, the restriction
SHALL be carried by that skill's `disable-model-invocation` frontmatter.
`CLAUDE.md` MUST NOT be the only thing preventing an invocation, and MUST NOT
restate an instruction the skill's own `description` already carries.

#### Scenario: A skill reserved for the user

- **WHEN** `CLAUDE.md` reserves `/coderabbit` for the user
- **THEN** `coderabbit/SKILL.md` carries `disable-model-invocation: true`
- **AND** `CLAUDE.md` states the reason rather than the instruction

#### Scenario: A skill the agent is meant to run itself

- **WHEN** a skill's `description` already says to run it proactively, as
  `/zombies` and `/warm` do
- **THEN** `CLAUDE.md` carries no "invoke it yourself" clause for it

#### Scenario: A clause that adds information

- **WHEN** this project's trigger or ordering differs from the skill's own
  description, as for `/triage`, or inverts it, as for `/ponytail-review`
- **THEN** the `CLAUDE.md` clause stays

### Requirement: The permission policy is pinned by a test

The repository's test run SHALL fail when `.claude/settings.json` stops
expressing this spec's `deny`, `ask` and hook requirements, so a later
hand-edit cannot drop the boundary silently. The check MUST read the tracked
`.claude/settings.json` and never `.claude/settings.local.json`, which is
gitignored and cannot be relied on. The requirement *Who may invoke a skill is
enforced, not narrated* is outside what this test covers: `.claude/skills/*`
are symlinks into a separate repository and are untracked here, so an assertion
on a skill's frontmatter would pass for the author and fail in a clone.

The hook is pinned on two levels: that it is registered in the settings file,
and that the script it points at behaves. Registration is a settings
assertion like the others; behaviour is asserted by running the script against
fabricated repository states, because a test that ran it against the live
repository would change its verdict with the branch.

#### Scenario: A deny entry is removed

- **WHEN** `Bash(pnpm *)` is deleted from `permissions.deny`
- **THEN** `bun test` fails

#### Scenario: A deny entry loses its word boundary

- **WHEN** a deny entry is written as `Bash(npm*)` without the space before
  the wildcard
- **THEN** `bun test` fails, because that form also blocks unrelated commands
  such as `npmlog`

#### Scenario: A deny entry uses the ignored field form

- **WHEN** a deny entry is written as `Bash(command:npm *)`
- **THEN** `bun test` fails, because Claude Code ignores that form and warns
  at startup

#### Scenario: An unreachable ask entry is reintroduced

- **WHEN** `Bash(npm install *)` is added back under `permissions.ask`
- **THEN** `bun test` fails, because deny is evaluated first and the entry can
  never be reached

#### Scenario: An ask entry is dropped

- **WHEN** `Bash(bun a *)` is deleted from `permissions.ask`
- **THEN** `bun test` fails, because an uncovered alias reaches a manifest
  write without prompting

#### Scenario: A listed form stops being a manifest write

- **WHEN** a top-level `ask` entry names a form that `bun <form> --help` no
  longer reports as one of the manifest-writing commands
- **THEN** `bun test` fails, so the list is checked against the installed
  binary in both directions rather than against a literal alone

#### Scenario: The settings file stops parsing

- **WHEN** `.claude/settings.json` contains a trailing comma
- **THEN** `bun test` fails rather than passing on an unread file

#### Scenario: A skill's frontmatter changes

- **WHEN** `disable-model-invocation` is removed from a vendored skill
- **THEN** no test in this repository fails, and the spec says so rather than
  promising a check it cannot carry

#### Scenario: A GitHub write entry is dropped

- **WHEN** `Bash(gh pr comment *)` is deleted from `permissions.deny`
- **THEN** `bun test` fails

#### Scenario: The hook loses its registration

- **WHEN** the `PreToolUse` entry is removed from `.claude/settings.json`, or
  its command no longer runs the tracked script, or it loses its `|| exit 2`
  fallback
- **THEN** `bun test` fails

#### Scenario: The hook stops blocking

- **WHEN** the script is run against a fabricated repository whose `HEAD` is
  on `main`, with a commit command on stdin
- **THEN** it exits `2`, and `bun test` fails on any other code

#### Scenario: An event the hook cannot read

- **WHEN** the script is given a payload with no `tool_input.command`
- **THEN** it exits `2` — a non-blocking code here would let an unread git
  command run, which is the case the hook is for

#### Scenario: The hook stops catching a force-push

- **WHEN** the script is run on a feature branch with `git push origin feat/x
  --force` on stdin
- **THEN** it exits `2`, and `bun test` fails if it does not — the flag scan is
  a separate path from the branch check and the reordered flag is the form no
  permission entry could have caught
