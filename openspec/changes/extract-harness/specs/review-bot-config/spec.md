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
