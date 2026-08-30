# snapshot-export delta — beta-refit

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
`typeof` and arithmetic on them is what a delta of `0/0` becomes. What that
adds over the client's own check is the rest of each hero — `side`, `phase`,
`positions`, `contest`, `sufficient` — and the two matrices, none of which the
client inspects, and a missing one of which computes as `NaN` in the model
rather than being refused.

The bundle SHALL carry `calibration` holding `alpha` and `beta`, both finite,
taken from the newest calibration run that published a pair. WHERE no run has
published one, the field SHALL be omitted rather than rendered from
`MODEL_CONSTANTS`: an omitted field is what makes the model fall back, and a
rendered fallback is a fitted pair as far as anything downstream can tell.
Omission is therefore the one exception to "every declared key present" above,
and it is why the key is optional in `SnapshotBundle` rather than required.

#### Scenario: The client's own check

- **WHEN** an exported bundle is passed to the validation
  `snapshot-delivery` specifies for a fetched payload
- **THEN** it SHALL be accepted, carrying `snapshotId`, `patch.id`,
  `createdAt` and a non-empty `heroes` array

#### Scenario: A hero entry missing a field the client never checks

- **IF** a rendered hero entry lacks `side`, `phase`, `contest` or
  `sufficient`
- **THEN** the export SHALL fail rather than publish, although the client's
  own validation would have accepted the payload

#### Scenario: A component rendered as zeros throughout

- **WHEN** every hero's `side` and `phase` hold zeros because staging
  measured neither
- **THEN** the export SHALL render both and publish, the fields being present
  with the value the model reads as no contribution

#### Scenario: A field of the wrong type

- **IF** a rendered hero's `contest` is the string `"0.13"` rather than the
  number `0.13`
- **THEN** the export SHALL fail rather than publish

#### Scenario: A number that is not finite

- **IF** any numeric leaf of a rendered bundle is `NaN`, `Infinity`,
  `-Infinity` or `null`
- **THEN** the export SHALL fail rather than publish

#### Scenario: A calibration pair exists

- **WHEN** a calibration run has published `alpha` and `beta` and the export
  runs
- **THEN** the bundle SHALL carry both under `calibration`, and the export
  SHALL fail rather than publish if either is not finite

#### Scenario: No calibration run has published a pair

- **IF** no run has published one, as before the first fit or after every
  fit was refused
- **THEN** the bundle SHALL omit `calibration` entirely and SHALL publish,
  rather than rendering the constants under a name that says fitted
