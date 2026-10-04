# agent-rulebook — delta

## MODIFIED Requirements

### Requirement: The pre-PR sequence has one home

`docs/review-toolkit.md` SHALL be the only place stating the pre-PR gate
sequence. Other documents MAY reference the sequence by name and link, which
is not a restatement.

#### Scenario: The duplicate is removed

- **WHEN** another document carries a list of the same sequence, as `PLAN.md`
  once did under "Gates (reminder)"
- **THEN** the list is deleted, and at most a reference by name and link
  replaces it

#### Scenario: A reference is kept

- **WHEN** `docs/feature-workflow.md` Stage 3 says to run the sequence the
  Review toolkit sets out
- **THEN** it stays, because it names the owner instead of repeating the list

#### Scenario: The rule that treated the symptom

- **WHEN** the duplication is removed
- **THEN** the grep rule is narrowed to the sites that still restate things —
  the OpenSpec specs and the README ownership map — rather than deleted,
  because those restatements remain
