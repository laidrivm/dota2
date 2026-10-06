# review-bot-config

## MODIFIED Requirements

### Requirement: Coding guidelines cover the indexed docs only

`knowledge_base.code_guidelines.filePatterns` SHALL match `**/CLAUDE.md`, the
flat `docs/*.md` and the flat `harness/*.md` that holds the tracked copy of the
harness rules and docs, and SHALL NOT be widened to `docs/**/*.md` or
`harness/**/*.md`. Session save-points under `docs/context/` are committed but
never loaded automatically, and `filePatterns` has no negation syntax with
which to exclude them.

#### Scenario: A context save-point exists

- **WHEN** `docs/context/<topic>-<yyyy-mm>.md` is committed
- **THEN** it is not read as a coding guideline

#### Scenario: An indexed doc is added

- **WHEN** a new `docs/<topic>.md` is added per the growth protocol
- **THEN** it is read as a coding guideline with no config change

#### Scenario: A harness rule arrives with a pin bump

- **WHEN** a pin bump adds or changes a file in `harness/`
- **THEN** it is read as a coding guideline with no config change

### Requirement: The bot reports against the rules list

`.coderabbit.yaml` SHALL instruct the bot to quote the rule a defect violates
from `/CLAUDE.md` or from the harness rules it imports, and to say explicitly
when a defect is covered by no rule and could recur. The fix-and-capture loop
is otherwise fed by the user and the local skills alone; this makes the bot a
third source, and the rule it quotes is one `knowledge_base.code_guidelines`
already puts in its context.

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

#### Scenario: A harness rule violated

- **WHEN** a diff restores a probed file with `git checkout`, which a harness
  Process rule forbids
- **THEN** the bot quotes that rule from `harness/rules.md` beside the finding

#### Scenario: A defect no rule covers

- **WHEN** a defect matches no rule and its shape could recur
- **THEN** the bot says so, so the loop can decide whether it becomes a rule

### Requirement: The specification itself is reviewed

`.coderabbit.yaml` SHALL carry a `path_instructions` entry for
`openspec/changes/**` telling the bot to check a change's artefacts against
this project's own authoring rules in `openspec/config.yaml`: acceptance
criteria in EARS form, measurable values rather than adjectives, a Non-goals
section present, and every criterion cited by at least one task.

The same entry SHALL tell the bot to check the change's artefacts **against
each other** — a statement in `proposal.md`, `design.md`, `tasks.md` and the
delta specs that contradicts its siblings is a finding. This is the half no
rule holds: a delta spec corrected by a review finding while its proposal still
states the old thing produced findings on three consecutive pull requests, and
widening the prose rule that forbids it did not stop the fourth.

No local skill reads a delta spec, and a proposal opens as its own pull request
here, so this is the one review that happens where `harness/feature-workflow.md`
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

#### Scenario: A spec corrected without its proposal

- **WHEN** a delta spec is changed and `proposal.md` still describes the
  previous behaviour
- **THEN** the bot flags the contradiction and names both sites

#### Scenario: A count that disagrees between artefacts

- **WHEN** `proposal.md` says a change adds four entries and `tasks.md` adds
  three
- **THEN** the bot flags it

#### Scenario: An archived change

- **WHEN** the diff touches `openspec/changes/archive/**`
- **THEN** the bot says nothing, because `path_filters` excludes settled
  history from review
