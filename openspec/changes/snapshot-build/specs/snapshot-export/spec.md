# snapshot-export — delta spec

## ADDED Requirements

### Requirement: The bundle is rendered from the newest published snapshot

The export SHALL render the snapshot with the greatest `snapshot_id` whose
`status` is `published`, and SHALL ignore snapshots in any other status
however recent they are.

#### Scenario: A newer snapshot is still building

- **WHEN** the newest snapshot has `status = 'building'` and the one before
  it is `published`
- **THEN** the exported bundle's `snapshotId` SHALL be the published one's

#### Scenario: Nothing has ever been published

- **IF** no snapshot has `status = 'published'`
- **THEN** the export SHALL write no file and SHALL exit non-zero

### Requirement: Publication is atomic

The export SHALL write the bundle to a temporary file in the directory it
publishes into and SHALL then rename that file over the published name, so
that a concurrent reader sees either the previous bundle whole or the new
one whole.

#### Scenario: A read during publication

- **WHEN** the published name is read repeatedly while an export runs
- **THEN** every read SHALL yield a complete bundle that parses as JSON, and
  no read SHALL yield a truncated or empty file

### Requirement: The bundle's keys are camelCase

Every key in the exported bundle SHALL be camelCase, so that the column
names the database uses never reach the client. The check SHALL walk the
bundle to every depth and SHALL reject any key containing an underscore at
all — `patch_id`, `hero_ID` and `phase_1` are the same defect, and a pattern
matching only an underscore before a lower-case letter admits two of them.

#### Scenario: Renamed at the boundary

- **WHEN** a bundle is exported
- **THEN** it SHALL carry `snapshotId`, `createdAt`, `patch.isMajor` and
  `patch.detectedAt`, and no key at any depth SHALL contain `_`

### Requirement: Pair statistics are expanded into full matrices

The export SHALL emit `matchups` and `synergies` as full matrices keyed by
hero id, deriving the orders the database does not store from the symmetry
the build guaranteed.

#### Scenario: A synergy stored once

- **WHEN** `hero_synergies` holds one row `(a, b)` with `synergy_adj = 1.4`
- **THEN** the bundle SHALL carry `synergies[a][b] = 1.4` and
  `synergies[b][a] = 1.4`

#### Scenario: A matchup's mirror

- **WHEN** the bundle carries `matchups[a][b] = -2.1`
- **THEN** it SHALL carry `matchups[b][a] = 2.1`

### Requirement: The stabilizing flag marks a settling major patch

The export SHALL set `stabilizing` to `true` while the snapshot's patch is
major and fewer than 4 whole days have passed from its `detected_at` to the
snapshot's `created_at`, and to `false` otherwise — the same window past
which a major patch's prior reaches zero.

#### Scenario: The day a major patch lands

- **WHEN** the snapshot's patch is major and `created_at` is on its
  `detected_at` day
- **THEN** the bundle's `stabilizing` SHALL be `true`

#### Scenario: The window has passed

- **WHEN** the snapshot's patch is major and `created_at` is 4 whole days
  after its `detected_at`
- **THEN** the bundle's `stabilizing` SHALL be `false`

#### Scenario: A letter patch

- **WHEN** the snapshot's patch is not major
- **THEN** the bundle's `stabilizing` SHALL be `false`

### Requirement: The exported bundle is what the client accepts

An exported bundle SHALL satisfy the validation the client applies to a
fetched snapshot, so that publishing can never produce a payload the client
rejects as malformed. Because that validation reads four fields, the export
SHALL additionally assert the whole payload against `SnapshotBundle` at
runtime: every key that interface declares is present, at every depth, and
holds a value of the declared type — a number where a number is declared, a
boolean where a boolean is. A field the client never checks still reaches the
model, where a missing one computes as `NaN` and a string one compares as
neither greater nor less, rather than either being refused.

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

#### Scenario: A field of the wrong type

- **IF** a rendered hero's `contest` is the string `"0.13"` rather than the
  number `0.13`
- **THEN** the export SHALL fail rather than publish

### Requirement: The served URL answers from the published bundle

`/snapshot.json` SHALL be served from the directory the export publishes
into, and SHALL fall back to the committed fixture when that directory holds
no bundle, so that development and both test suites run without a database.

#### Scenario: A bundle has been published

- **WHEN** the publication directory holds a bundle and `/snapshot.json` is
  requested
- **THEN** the response SHALL be that bundle

#### Scenario: Nothing published yet

- **WHEN** the publication directory is absent or holds no bundle and
  `/snapshot.json` is requested
- **THEN** the response SHALL be the committed fixture

### Requirement: The served snapshot is revalidated by ETag

The response for `/snapshot.json` SHALL carry `cache-control: no-cache` and
an `ETag` derived from the served bytes, so that it changes whenever the
payload changes and holds while it does not — including across a re-export
that rewrites the file with identical content. A request whose
`If-None-Match` matches SHALL be answered `304` with no body.

#### Scenario: A returning client

- **WHEN** `/snapshot.json` is requested with an `If-None-Match` equal to
  the ETag of the bundle currently served
- **THEN** the response status SHALL be 304 and its body SHALL be empty

#### Scenario: A byte-identical re-export

- **WHEN** the export republishes a bundle whose bytes equal the served
  one's, and `/snapshot.json` is requested with the previous ETag
- **THEN** the response status SHALL be 304, although the file was rewritten

#### Scenario: A new bundle has been published

- **WHEN** a different bundle is published and `/snapshot.json` is requested
  with the previous ETag in `If-None-Match`
- **THEN** the response status SHALL be 200, its ETag SHALL differ from the
  one sent, and its body SHALL be the new bundle
