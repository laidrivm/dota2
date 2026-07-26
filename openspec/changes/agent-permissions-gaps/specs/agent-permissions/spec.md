# Agent permissions — delta

## RENAMED Requirements

- FROM: `### Requirement: Only bun's install commands prompt`
- TO: `### Requirement: Every manifest-mutating invocation prompts`

## MODIFIED Requirements

### Requirement: Every manifest-mutating invocation prompts

`permissions.ask` in `.claude/settings.json` SHALL cover every invocation form
that writes `package.json` — the commands `bun add`, `bun install` and
`bun remove`, together with each alias `bun` documents for them — and no entry
naming a denied package manager, because an `ask` rule for a denied command can
never be reached. Claude Code matches a permission pattern against the literal
command string, so an alias is a separate entry and not a variant of one.

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

#### Scenario: Settings carry no unreachable ask rule

- **WHEN** `.claude/settings.json` is read
- **THEN** no string under `permissions.ask` names `npx`, `npm`, `pnpm` or
  `yarn`

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

### Requirement: The permission policy is pinned by a test

The repository's test run SHALL fail when `.claude/settings.json` stops
expressing this spec's `deny` and `ask` requirements, so a later hand-edit
cannot drop the boundary silently. The check MUST read the tracked
`.claude/settings.json` and never `.claude/settings.local.json`, which is
gitignored and cannot be relied on. The requirement *Who may invoke a skill is
enforced, not narrated* is outside what this test covers: `.claude/skills/*`
are symlinks into a separate repository and are untracked here, so an assertion
on a skill's frontmatter would pass for the author and fail in a clone.

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

#### Scenario: The settings file stops parsing

- **WHEN** `.claude/settings.json` contains a trailing comma
- **THEN** `bun test` fails rather than passing on an unread file

#### Scenario: A skill's frontmatter changes

- **WHEN** `disable-model-invocation` is removed from a vendored skill
- **THEN** no test in this repository fails, and the spec says so rather than
  promising a check it cannot carry
