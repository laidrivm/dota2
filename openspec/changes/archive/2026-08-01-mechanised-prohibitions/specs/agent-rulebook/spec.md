# agent-rulebook delta specification

## ADDED Requirements

### Requirement: The rules list is partitioned into three sublists

`CLAUDE.md`'s rules list SHALL be split into **Code**, **Process** and
**Safety** sublists, each under its own heading. A code rule is one that ages
with the code it describes and is evictable once that code changes; process
and safety rules do not age. The ~20-rule maintenance trigger SHALL apply per
sublist, not to the list as a whole, so the count that fires names a sublist
where eviction is actually possible.

#### Scenario: A rule about a Preact effect

- **WHEN** a rule describes how a listener must read state in this
  application's components
- **THEN** it belongs under Code, and becomes evictable when that component
  is rewritten

#### Scenario: A rule about British English

- **WHEN** a rule governs how every repository artefact is written
- **THEN** it belongs under Process and is not a candidate for eviction

#### Scenario: The trigger fires

- **WHEN** one sublist reaches about twenty rules
- **THEN** the maintenance proposal names that sublist, and does not count the
  other two against it

### Requirement: A mechanised prohibition leaves its prose home

WHEN a prohibition becomes a `deny` entry, a hook or a CI check, the prose
stating it SHALL be deleted from `CLAUDE.md` — from whichever section holds
it, not only from the rules list. A prohibition SHALL NOT be stated in both
places, because the prose then reads as the boundary while the mechanism is
the boundary, and the two can drift apart.

#### Scenario: A rule fully covered by a mechanism

- **WHEN** committing on `main` becomes a hook
- **THEN** the sentence forbidding it is deleted from the Git & PRs section

#### Scenario: A rule only partly covered

- **WHEN** the secret scanner covers tokens and keys but not machine-local
  paths or internal identifiers
- **THEN** the prose is shortened to what the scanner cannot see, rather than
  deleted whole

#### Scenario: A prohibition that resists mechanisation

- **WHEN** no mechanism can express a prohibition without a far broader block
  than the rule intends
- **THEN** it stays prose, and the proposal that considered it records why

### Requirement: The pre-PR sequence has one home

`docs/review-toolkit.md` SHALL be the only place stating the pre-PR gate
sequence. `PLAN.md` SHALL NOT restate it. Other documents MAY reference the
sequence by name and link, which is not a restatement.

#### Scenario: The duplicate is removed

- **WHEN** `PLAN.md` carries a "Gates (reminder)" section listing the same
  sequence
- **THEN** the section is deleted, and nothing replaces it

#### Scenario: A reference is kept

- **WHEN** `docs/feature-workflow.md` Stage 3 says to run the sequence the
  Review toolkit sets out
- **THEN** it stays, because it names the owner instead of repeating the list

#### Scenario: The rule that treated the symptom

- **WHEN** the duplication is removed
- **THEN** the grep rule is narrowed to the sites that still restate things —
  the OpenSpec specs and the README ownership map — rather than deleted,
  because those restatements remain
