# snapshot-export delta — hero-aliases-seed

## MODIFIED Requirements

### Requirement: The exported bundle is what the client accepts

An exported bundle SHALL satisfy the validation the client applies to a
fetched snapshot, so that publishing can never produce a payload the client
rejects as malformed. That validation reaches further than the four fields
`snapshot-delivery` names — it also requires `createdAt` to be a real calendar
date and every hero to carry a numeric `id` and a string `name` — but it stops
at the hero's identity. The export SHALL therefore assert the whole payload
against `SnapshotBundle` at runtime: every declared key present at every
depth, holding a value of the declared type — and, where that type is
`number`, a finite one, because `NaN` and the infinities are numbers to
`typeof` and arithmetic on them is what a delta of `0/0` becomes. What that adds over the client's
own check is the rest of each hero — `side`, `phase`, `positions`, `contest`,
`sufficient`, `aliases`, `abbreviations` — and the two matrices, none of which
the client inspects, and a missing one of which computes as `NaN` in the model
rather than being refused.

A hero entry SHALL carry its aliases in two arrays, both of strings, split by
the `kind` the schema constrains: `aliases` holds every row of kind `legacy`
and `abbreviations` every row of kind `abbrev`. Either MAY be empty and both
SHALL be present. One array of alias strings would not do: the picker orders
a match by which of the two matched, and a rendered array that has forgotten
which is which cannot be ordered by anything the client can recover.

#### Scenario: The client's own check

- **WHEN** an exported bundle is passed to the validation
  `snapshot-delivery` specifies for a fetched payload
- **THEN** it SHALL be accepted, carrying `snapshotId`, `patch.id`,
  `createdAt` and a non-empty `heroes` array

#### Scenario: A hero entry missing a field the client never checks

- **IF** a rendered hero entry lacks `side`, `phase`, `contest`,
  `sufficient`, `aliases` or `abbreviations`
- **THEN** the export SHALL fail rather than publish, although the client's
  own validation would have accepted the payload

#### Scenario: A component rendered as zeros throughout

- **WHEN** every hero's `side` and `phase` hold zeros because staging
  measured neither
- **THEN** the export SHALL render both and publish, the fields being present
  with the value the model reads as no contribution

#### Scenario: A hero with no alias of one kind

- **WHEN** a hero's alias rows are all of kind `abbrev`
- **THEN** the export SHALL render `aliases` as an empty array and publish —
  an empty array is the answer, and omitting the key is not

#### Scenario: An alias rendered under the wrong kind

- **WHEN** a hero holds one `legacy` row and one `abbrev` row
- **THEN** the `legacy` row SHALL appear in `aliases` and the `abbrev` row in
  `abbreviations`, and neither array SHALL carry the other's row

#### Scenario: A field of the wrong type

- **IF** a rendered hero's `contest` is the string `"0.13"` rather than the
  number `0.13`, or a member of its `aliases` is not a string
- **THEN** the export SHALL fail rather than publish

#### Scenario: A number that is not finite

- **IF** any numeric leaf of a rendered bundle is `NaN`, `Infinity`,
  `-Infinity` or `null`
- **THEN** the export SHALL fail rather than publish
