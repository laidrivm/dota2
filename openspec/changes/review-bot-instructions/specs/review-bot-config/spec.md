# review-bot-config delta specification

## ADDED Requirements

### Requirement: The specification itself is reviewed

`.coderabbit.yaml` SHALL carry a `path_instructions` entry for
`openspec/changes/**` telling the bot to check a change's artefacts against
this project's own authoring rules in `openspec/config.yaml`: acceptance
criteria in EARS form, measurable values rather than adjectives, a Non-goals
section present, and every criterion cited by at least one task.

No local skill reads a delta spec, and a proposal opens as its own pull request
here, so this is the one review that happens where `docs/feature-workflow.md`
says a fix is still cheap.

#### Scenario: A criterion written with an adjective

- **WHEN** a delta spec says a response is "fast" or a file "reasonably small"
- **THEN** the bot flags it and names the missing measurable value

#### Scenario: A criterion no task closes

- **WHEN** a requirement's scenario is cited by no line of `tasks.md`
- **THEN** the bot flags it

#### Scenario: A proposal without Non-goals

- **WHEN** `proposal.md` carries no Non-goals section
- **THEN** the bot flags it

#### Scenario: An archived change

- **WHEN** the diff touches `openspec/changes/archive/**`
- **THEN** the bot says nothing, because `path_filters` excludes settled
  history from review

### Requirement: An implementation is reviewed against its proposal

`.coderabbit.yaml` SHALL carry a `path_instructions` entry for `src/**`
telling the bot to compare the diff with the active change in both directions:
every acceptance criterion the branch claims is met, and nothing present that
the change never asked for.

The active change SHALL be selected by branch name, not guessed: `CLAUDE.md`
fixes the branch as `feat/<proposal-slug>` or `feat/<proposal-slug>-<step>`, so
the directory is `openspec/changes/<proposal-slug>/`. Five changes can sit
there at once, so a rule that says "the active one" without saying how names
nothing. Where the branch matches no directory, the bot SHALL say the
comparison could not be made rather than pick a candidate.

The direction that matters is the second. `/triage` maps the diff, `/zombies`
finds test gaps and `/ponytail-review` hunts over-engineering; none of them
opens the proposal, so scope creep is currently caught by nobody.

#### Scenario: The diff exceeds the proposal

- **WHEN** a branch adds a module, an option or an endpoint that no artefact of
  the active change mentions
- **THEN** the bot flags it as scope not proposed

#### Scenario: A criterion is claimed but not met

- **WHEN** `tasks.md` ticks an item whose acceptance criterion the diff does
  not satisfy
- **THEN** the bot flags the gap

#### Scenario: The branch names no change

- **WHEN** the branch is `fix/something` with no directory of that name under
  `openspec/changes/`
- **THEN** the bot reports that it could not identify the change, rather than
  comparing against one of the others

### Requirement: The bot reports against the rules list

`.coderabbit.yaml` SHALL instruct the bot to quote the rule from `/CLAUDE.md`
that a defect violates, and to say explicitly when a defect is covered by no
rule and could recur. The fix-and-capture loop is fed by the user and the local
skills today; this makes the bot a third source, and the rule it quotes is one
`knowledge_base.code_guidelines` already puts in its context.

The instruction SHALL be attached to the path `**`. The schema offers no
general review-instruction key — `path_instructions` is the only mechanism and
every entry is path-scoped — so hanging this on `**/*.{ts,tsx}` would exempt
every rule violation in a config, a workflow or a document from being named.

#### Scenario: A defect an existing rule covers

- **WHEN** a diff gates a side effect on the action rather than on the
  reducer's result
- **THEN** the bot quotes that rule from `/CLAUDE.md` beside the finding

#### Scenario: A rule violated outside TypeScript

- **WHEN** a workflow file pins an action by tag rather than by commit SHA,
  which a rule forbids
- **THEN** the bot quotes that rule, because the instruction is scoped to `**`
  and not to a language

#### Scenario: A defect no rule covers

- **WHEN** a defect matches no rule and its shape could recur
- **THEN** the bot says so, so the loop can decide whether it becomes a rule

### Requirement: The bot flags what the linters cannot

`.coderabbit.yaml` SHALL instruct the bot to flag an abstraction with a single
caller, a parameter or option with no current consumer, and any new dependency.
These are the ponytail ladder's rungs, no linter checks them, and
`/ponytail-review` sees only the diffs the agent chooses to run it over.

#### Scenario: An interface with one implementation

- **WHEN** a diff adds an abstraction called from exactly one place
- **THEN** the bot flags it

#### Scenario: A parameter nothing passes

- **WHEN** a diff adds an option with no current consumer
- **THEN** the bot flags it as speculative

### Requirement: MCP is enabled by decision, not by default

`knowledge_base.mcp.usage` SHALL be set to `"enabled"`. The schema's default is
`"auto"`, which **disables** MCP for public repositories, so leaving it unset
would make the API-existence instruction depend on a knowledge source that is
not running — and would flip silently if the repository's visibility changed.

The `**/*.{ts,tsx}` instructions SHALL tell the bot to check calls into Preact,
Bun and Playwright against the documentation for the installed version rather
than assuming they exist, and to treat a non-existent or changed API as Major.

The configuration file cannot allowlist a server: the schema exposes `usage`
and `disabled_servers` only. Which servers are connected is dashboard state and
the user's to set.

#### Scenario: The setting is explicit

- **WHEN** `.coderabbit.yaml` is read
- **THEN** `knowledge_base.mcp.usage` is `"enabled"`, not absent and not
  `"auto"`

#### Scenario: A method that does not exist

- **WHEN** a diff calls a Preact, Bun or Playwright API absent from that
  version's documentation
- **THEN** the bot raises it at 🟠 Major

#### Scenario: The dependency check is unaffected

- **WHEN** a diff adds a dependency
- **THEN** the documentation source says nothing about its age, downloads or
  install scripts, which stay with `/warm` and `bun info`

### Requirement: The walkthrough drops what a solo repository cannot relate

`reviews.related_issues` and `reviews.related_prs` SHALL both be `false`. Both
default to `true`, and every walkthrough spends space on sections that have
nothing to point at here.

#### Scenario: A walkthrough is generated

- **WHEN** the bot posts its walkthrough on a pull request
- **THEN** it carries neither a related-issues nor a related-PRs section
