# draft-board — delta spec

## MODIFIED Requirements

### Requirement: Removal controls are reachable

Every removal control SHALL be a `button` with an accessible name naming the
hero it removes, SHALL be reachable by keyboard, and SHALL be visible whenever
its row has focus within it, not only on pointer hover.

#### Scenario: Keyboard reveal

- **WHEN** the removal control of a filled slot receives focus
- **THEN** it SHALL be visible and SHALL show a focus indicator

#### Scenario: Focus survives the removal

- **WHEN** a removal control is activated and unmounts with the entry it
  removed
- **THEN** focus SHALL move to the pick-entry control that replaces it —
  the same slot's where the slot survives, the region's first otherwise —
  and SHALL NOT fall back to the document body

#### Scenario: Focus survives the removal with no animation frame

- **WHEN** a removal control is activated in a document whose animation frame
  callbacks never run
- **THEN** focus SHALL move to the replacing pick-entry control exactly as it
  does otherwise, so the restore depends on no rendering opportunity
