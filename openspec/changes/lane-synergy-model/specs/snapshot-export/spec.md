# snapshot-export delta — lane-synergy-model

**Written against the version `laning-phase-model` leaves behind.**

## MODIFIED Requirements

### Requirement: The lane matrix is expanded per position

The export SHALL emit **two** roots of the same shape,
`Record<heroId, Record<position, Record<heroId, number>>>`: `lanes` for the
heroes a candidate stands against and `laneAllies` for the one it stands
beside. Both are keyed by the hero, the position it was counted at, and the
other hero. Every value SHALL come from a stored row of its own; neither
direction is derived from another by negation or by copying.

The outer keys SHALL be hero ids as decimal integer strings and the middle
keys the positions `1` to `5`. `src/job/export/contract.ts` gains a depth for
these roots rather than the matrices being flattened to a composite key: a
key like `"44:1"` would pass its existing two-level rule and read as a hero
id to a scan that never learned otherwise, which `contract.ts:118-121` names
as the exact failure its exemption list is written to make loud.

A hero SHALL carry a row only for the positions the pull covered, and in each
root only where that root's pull returned rows. A missing position is not a
zero: the model reads an absent one as no contribution, and writing zeros
would make a position nobody plays indistinguishable from one that is
genuinely neutral.

#### Scenario: A lane pair, each direction from its own row

- **WHEN** `hero_lanes` holds one row `(a, 1, b)` with `lane_adj = −3.2`
- **THEN** the bundle SHALL carry `lanes[a]["1"][b] = -3.2`; and where `b`
  has its own row at its own position, that value SHALL be rendered from that
  row rather than from this one's negation

#### Scenario: An ally pair, rendered into its own root

- **WHEN** `hero_lane_allies` holds a row `(a, 1, b)` with `lane_adj = +5.8`
- **THEN** the bundle SHALL carry `laneAllies[a]["1"][b] = 5.8`, and `lanes`
  SHALL NOT carry it

#### Scenario: A hero at a position the pull did not cover

- **WHEN** a hero's share at a position is below the pull's floor
- **THEN** neither root SHALL carry a key for that position, and neither
  SHALL carry one holding an empty object or zeros

#### Scenario: One statistic covered and the other not

- **IF** the opponent pull completed and the ally pull did not, as a run cut
  short by the daily window leaves it
- **THEN** `lanes` SHALL carry its rows and `laneAllies` SHALL be an empty
  object, and the export SHALL publish rather than hold the bundle back for
  the half that is missing

#### Scenario: A bundle carrying no lane data at all

- **IF** no lane row has been stored in either statistic
- **THEN** both roots SHALL be emitted as empty objects and the export SHALL
  publish, the fields being present and the model reading every lookup as no
  contribution

#### Scenario: A lane value that is not finite

- **IF** any leaf of either root is `NaN`, `Infinity` or `-Infinity`
- **THEN** the export SHALL fail rather than publish, on the same terms as
  every other numeric leaf
