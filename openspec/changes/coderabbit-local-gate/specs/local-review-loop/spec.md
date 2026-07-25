# Local review loop

## ADDED Requirements

### Requirement: The gate runs after triage and before the push

The agent SHALL invoke `/coderabbit-local` against the branch after `/triage`
and before pushing. A branch of documentation, rules or config SHALL get one
review pass rather than the full loop.

#### Scenario: A code branch reaches the end of the sequence

- **WHEN** `/triage` has been run over the final diff of a code branch
- **THEN** the agent invokes `/coderabbit-local` before pushing

#### Scenario: The CLI is unavailable

- **WHEN** `cr doctor` exits non-zero, or `cr` is not on PATH
- **THEN** the agent reports which check failed and what fixes it
- **AND** pushes without the gate rather than blocking the branch

#### Scenario: A documentation branch

- **WHEN** the branch changes only documentation, rules or config
- **THEN** the agent runs one review pass, not three

### Requirement: Major and above are fixed without asking

Findings at 🟠 Major or 🔴 Critical that survive verification against the
current code SHALL be applied without pausing for approval, overriding the
skill's "No fixes before approval" rule. Every applied fix MUST appear in the
final report.

#### Scenario: A verified Major finding

- **WHEN** a 🟠 Major finding is confirmed by reading the file at the cited
  path and line
- **THEN** the agent applies the smallest correct fix without asking
- **AND** the fix is listed in the final report

#### Scenario: A Major finding the bot got wrong

- **WHEN** verification shows the finding does not hold against the current
  code
- **THEN** the agent rejects it and states concretely what the bot missed

### Requirement: Minor findings are reported once, at the end

🟡 Minor findings SHALL be collected across every pass and reported in a
single list when the loop ends, each marked fixed or skipped with a reason.
`below severity threshold` MUST NOT be given as a reason.

#### Scenario: Minor findings across two passes

- **WHEN** pass 1 raises two Minor findings and pass 2 raises one more
- **THEN** all three appear in one list at the end of the loop, not in three
  separate reports

#### Scenario: A skipped Minor

- **WHEN** a Minor finding is skipped
- **THEN** the report gives the reason — taste, a settled convention the bot
  does not know, or a fix costing more than the defect is worth

### Requirement: The loop terminates

The loop SHALL run at most three reviews with fix rounds between them, and
SHALL stop early when a review returns nothing above Minor. When 🟠 Major or
above survives the third review, the agent SHALL report what remains and stop
rather than start a fourth pass.

#### Scenario: The second review is clean

- **WHEN** the second review returns no finding above Minor
- **THEN** the loop ends without a third review

#### Scenario: Findings survive the third review

- **WHEN** a 🟠 Major finding is still reported after the third review
- **THEN** the agent reports it and stops, leaving the decision to push to
  the user

### Requirement: The local reviewer is aligned with the PR bot

Before the gate is written into `CLAUDE.md`, it SHALL be established whether
`cr` reads the repository's `.coderabbit.yaml` unprompted. Where it does not,
the prescribed invocation MUST pass the config explicitly with
`--config .coderabbit.yaml CLAUDE.md`, so the local review applies the same
`path_instructions` and `code_guidelines` as the PR bot.

#### Scenario: The saved prompts carry this repo's instructions

- **WHEN** `cr review --show-prompts` is run after one local review
- **AND** the output contains the `path_instructions` from `.coderabbit.yaml`
- **THEN** the gate prescribes a plain `cr review`

#### Scenario: The saved prompts do not carry them

- **WHEN** that output shows none of this repo's configured instructions
- **THEN** the gate prescribes `cr review --config .coderabbit.yaml CLAUDE.md`

#### Scenario: The question is unanswered

- **WHEN** neither check has been run
- **THEN** no rule prescribing the gate is written

### Requirement: A justification survives only when it is a convention

Where a skipped Minor reflects a settled convention of this project, the
agent SHALL capture it as a rule in the `CLAUDE.md` "Rules" list, which
`.coderabbit.yaml` already names under
`knowledge_base.code_guidelines.filePatterns` so the next review reads it. A
one-off SHALL NOT become a rule.

#### Scenario: A convention the bot does not know

- **WHEN** a Minor finding is skipped because the project has a settled
  convention the bot keeps re-raising
- **THEN** the convention is captured as a one-line rule meeting the
  `CLAUDE.md` rule quality bar

#### Scenario: A one-off skip

- **WHEN** a Minor finding is skipped for a reason specific to this branch
- **THEN** the reason stays in the report and no rule is added
