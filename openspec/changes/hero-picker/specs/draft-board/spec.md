# draft-board Specification

## MODIFIED Requirements

### Requirement: Pick entry

Every empty team slot, every empty enemy slot, and the bans row SHALL offer a
labelled control that opens the hero picker for that position. Entering a hero
SHALL go through the picker only; the board SHALL NOT offer a second entry
path.

#### Scenario: Control opens the picker for its own position

- **WHEN** the pick-entry control of the empty Carry slot is activated
- **THEN** the picker SHALL open with target role 1, and no other position
  SHALL be affected by the hero then chosen

#### Scenario: Every control is labelled

- **WHEN** the board is rendered
- **THEN** each pick-entry control SHALL have an accessible name naming the
  position it fills — the role for a team slot, `enemy pick` for an enemy
  slot, `ban` for the bans row

## ADDED Requirements

### Requirement: A hero the snapshot no longer contains is flagged for re-pick

WHEN a restored session holds a hero id absent from the loaded snapshot, the
board SHALL keep that entry in place, render it with a visible `re-pick`
marker, and keep its removal control operable. The rest of the board SHALL
render and recompute without throwing.

#### Scenario: Stale team pick

- **WHEN** the stored session holds a hero on role 2 that the loaded snapshot
  does not contain
- **THEN** the role 2 slot SHALL show the fallback tile with a `re-pick`
  marker, its removal control SHALL work, and the other panels SHALL render

#### Scenario: Re-picking clears the marker

- **WHEN** the flagged slot is filled from the picker with a hero the snapshot
  contains
- **THEN** the marker SHALL be gone and the model SHALL be recomputed
