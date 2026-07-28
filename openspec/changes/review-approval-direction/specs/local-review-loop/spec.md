# local-review-loop delta specification

## RENAMED Requirements

- FROM: `### Requirement: Major and above are fixed without asking`
- TO: `### Requirement: A verified finding is fixed without asking`

## MODIFIED Requirements

### Requirement: A verified finding is fixed without asking

A finding that survives verification against the current code SHALL be applied
without pausing for approval, **whatever its severity**, overriding the skills'
"No fixes before approval" rule. The override is not scoped by severity,
because the cost it prices is the cost of being wrong about a fix, and that
cost — a `git checkout` on a branch nobody has pulled — does not vary with the
label on the finding. Every applied fix MUST appear in the final report.

#### Scenario: A verified Major finding

- **WHEN** a 🟠 Major finding is confirmed by reading the file at the cited
  path and line
- **THEN** the agent applies the smallest correct fix without asking
- **AND** the fix is listed in the final report

#### Scenario: A correct Minor finding

- **WHEN** a 🟡 Minor finding is read and judged correct, and its fix is small
  and self-contained
- **THEN** the agent applies it without asking, exactly as it would a Major

#### Scenario: A Major finding the bot got wrong

- **WHEN** verification shows the finding does not hold against the current
  code
- **THEN** the agent states concretely what the bot missed and puts the
  dismissal to the user rather than closing it

## ADDED Requirements

### Requirement: Dismissing a Major or above is the user's call

Rejecting a 🟠 Major or 🔴 Critical finding as wrong, or skipping it as not
worth fixing, SHALL be put to the user with what the bot missed, and the run's
gate line SHALL read `OPEN` until they settle it. A pending fix SHALL NOT hold
the gate; a pending dismissal always does. The asymmetry is deliberate: a fix
applied wrongly to an unpushed branch is reverted in one command, while a
finding dismissed wrongly reaches the merge.

🟡 Minor and 🔵 Trivial keep their existing treatment — the agent skips them on
its own reasoning, and the report carries the reason.

#### Scenario: A Major the agent believes is wrong

- **WHEN** verification shows a 🟠 Major does not hold, and the agent has a
  concrete statement of what the bot missed
- **THEN** the report names it as a proposed dismissal, and the gate line reads
  `OPEN` with the dismissal counted, not the fixes

#### Scenario: Every finding fixed

- **WHEN** a run fixes every finding it verified and dismisses none above Minor
- **THEN** the gate line reads `PASS`, because no fix ever needed approval

#### Scenario: A skipped Minor

- **WHEN** a 🟡 Minor is skipped because it is taste, or a settled convention
  the bot does not know
- **THEN** the reason goes in the report and the user is not asked

#### Scenario: The user accepts a dismissal

- **WHEN** the user agrees with the agent's reasoning on a proposed dismissal
  and no other finding is pending
- **THEN** the dismissal is recorded as settled with its reason, and the gate
  line moves from `OPEN` to `PASS`

#### Scenario: The user disagrees with a dismissal

- **WHEN** the user rejects the agent's reasoning on a proposed dismissal
- **THEN** the finding is fixed, and the gate closes on the fix
