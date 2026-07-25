# Agent permissions

## ADDED Requirements

### Requirement: Foreign package managers are denied

The repository's tracked Claude Code settings SHALL deny every package
manager other than `bun`. `.claude/settings.json` MUST carry
`permissions.deny` entries matching `npx`, `npm`, `pnpm` and `yarn` with a
trailing-space wildcard, so each matches the bare command and any invocation
of it.

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

### Requirement: Only bun's install commands prompt

`permissions.ask` in `.claude/settings.json` SHALL list exactly the two bun
commands that mutate the dependency manifest — `bun add` and `bun install` —
and no entry naming a denied package manager, because an `ask` rule for a
denied command can never be reached.

#### Scenario: Adding a dependency

- **WHEN** the agent attempts `bun add preact`
- **THEN** Claude Code prompts the user for approval

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
expressing the policy above, so a later hand-edit cannot drop the boundary
silently. The check MUST read the tracked `.claude/settings.json` and never
`.claude/settings.local.json`, which is gitignored and cannot be relied on.

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

#### Scenario: The settings file stops parsing

- **WHEN** `.claude/settings.json` contains a trailing comma
- **THEN** `bun test` fails rather than passing on an unread file
