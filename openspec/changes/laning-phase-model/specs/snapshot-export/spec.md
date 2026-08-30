# snapshot-export delta — laning-phase-model

`Pair statistics are expanded into full matrices` is deliberately **not**
modified here, though a third matrix looks like its business.
`score-calibration` modifies that requirement, and with no order fixed
between the two changes the second to sync would silently drop the first's
edit. The lane matrix is a different shape besides — keyed by position as
well as by hero — so it earns a requirement rather than an amendment.

## ADDED Requirements

### Requirement: The lane matrix is expanded per position

The export SHALL emit `lanes` as `Record<heroId, Record<position,
Record<heroId, number>>>`, keyed by the hero, the position it was counted
at, and the opponent — deriving the orders the database does not store from
the antisymmetry the build guaranteed, as it does for `matchups`.

The outer keys SHALL be hero ids as decimal integer strings and the middle
keys the positions `1` to `5`, so the whole reaches
`src/job/export/contract.ts`'s existing walk as a matrix of matrices rather
than needing a shape it has no rule for.

A hero SHALL carry a row only for the positions the pull covered — those
where its share reached the floor *Lane outcomes are pulled per hero and
position* fixes. A missing position is not a zero: the model reads an absent
one as no contribution, and writing zeros would make a position nobody plays
indistinguishable from one that is genuinely neutral.

#### Scenario: A lane pair the database stores once

- **WHEN** `hero_lanes` holds one row `(a, 1, b)` with `lane_adj = −3.2`
- **THEN** the bundle SHALL carry `lanes[a]["1"][b] = -3.2`, and where `b`'s
  own row at its position exists, that value SHALL be its negation

#### Scenario: A hero at a position the pull did not cover

- **WHEN** a hero's share at a position is below the pull's floor
- **THEN** `lanes[hero]` SHALL carry no key for that position, and SHALL NOT
  carry one holding an empty object or zeros

#### Scenario: A bundle carrying no lane data at all

- **IF** no lane row has been stored, as before the first pull completes
- **THEN** the export SHALL emit `lanes` as an empty object and publish, the
  field being present and the model reading every lookup as no contribution

#### Scenario: A lane value that is not finite

- **IF** any leaf of `lanes` is `NaN`, `Infinity` or `-Infinity`
- **THEN** the export SHALL fail rather than publish, on the same terms as
  every other numeric leaf
