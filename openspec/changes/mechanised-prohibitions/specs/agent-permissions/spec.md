# agent-permissions delta specification

## ADDED Requirements

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
`.claude/settings.json`, narrowed to git commands by the hook's `if` field so
it does not run on every Bash call. The hook SHALL read the invoked command
from the event JSON on stdin rather than pattern-matching the raw payload, so
a `--force` appearing in a command's description cannot trigger it. It SHALL
block by exiting **2** with the reason on stderr — the only code Claude Code
treats as blocking — and SHALL exit 2 for an event it cannot decide as well: a
malformed payload, an absent command field or a git call that fails. Every
other non-zero code lets the command run, so the undecidable case fails closed
or it does not fail at all. It SHALL depend on nothing beyond git and bun, both
of which the repository already requires.

The `if` field matches each subcommand of a compound command independently, so
one entry covers a git command in any position, including one reached through
`&&` after a non-git command. It matches the command word literally, so
`/usr/bin/git commit` and `command git commit` do not reach the hook at all.
That ceiling is accepted rather than closed: the hook guards an agent that
writes `git` because that is what the documentation and this repository's own
prose say, not an adversary looking for a spelling the matcher misses.

The hook SHALL block a commit while `HEAD` is on `main`, and SHALL block any
force-push, whether written as `--force`, `--force-with-lease` or `-f`, and
wherever the flag sits in the command. This is stricter than the prose it
replaces, which forbade force-pushing only after a pull request was open: the
agent loses force-push entirely, and the user keeps it.

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
- **THEN** the hook blocks the call, because the `if` field matches each
  subcommand and not the command string's prefix

#### Scenario: A force-push with the flag last

- **WHEN** the agent attempts `git push origin feat/x --force`
- **THEN** the hook blocks the call, although no command-prefix pattern would
  have matched it

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

## MODIFIED Requirements

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

#### Scenario: A GitHub write entry is dropped

- **WHEN** `Bash(gh pr comment *)` is deleted from `permissions.deny`
- **THEN** `bun test` fails

#### Scenario: The hook loses its registration

- **WHEN** the `PreToolUse` entry is removed from `.claude/settings.json`, or
  its command no longer points at the tracked script
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
