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
a stored row of its own. Unlike `matchups`, both directions of a lane pair
are pulled and stored separately, so there is no order the database lacks and
none is derived by negation.

The outer keys SHALL be hero ids as decimal integer strings and the middle
keys the positions `1` to `5`.

`src/job/export/contract.ts` cannot check that as it stands, and the export
SHALL NOT publish a shape it does not check. Its walk is exactly two levels
deep — `contract.ts:122-131` requires a root's values to be objects and
*their* values to be numbers — so `lanes[44]["1"]` holding `{"6": -3.2}` is
refused for not holding the declared type. The walk SHALL gain a depth for
this root rather than the matrix being flattened to a composite key: a key
like `"44:1"` would pass the existing rule and read as an id to a scan that
never learned otherwise, which is the failure that list of exemptions exists
to make loud.

A hero SHALL carry a row only for the positions the pull covered — those
where its share reached the floor *Lane outcomes are pulled per hero and
position* fixes. A missing position is not a zero: the model reads an absent
one as no contribution, and writing zeros would make a position nobody plays
indistinguishable from one that is genuinely neutral.

#### Scenario: A lane pair, each direction from its own row

- **WHEN** `hero_lanes` holds one row `(a, 1, b)` with `lane_adj = −3.2`
- **THEN** the bundle SHALL carry `lanes[a]["1"][b] = -3.2`; and where `b`
  has its own row at its own position, that value SHALL be rendered from that
  row rather than from this one's negation

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
