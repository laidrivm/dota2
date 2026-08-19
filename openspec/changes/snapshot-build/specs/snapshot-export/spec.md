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

Every key in the exported bundle SHALL be one of two kinds, checked at every
depth. A named key SHALL match `^[a-z][A-Za-z0-9]*$` — which rejects
`patch_id`, `patch-id` and `PatchId` alike, where a test for the underscore
alone catches only the first. An id key — the entries of `matchups`,
`synergies` and a hero's `positions` — SHALL be a decimal integer string. A
key of neither kind SHALL fail the export, so an unknown key cannot ride
along beside the declared ones.

#### Scenario: Renamed at the boundary

- **WHEN** a bundle is exported
- **THEN** it SHALL carry `snapshotId`, `createdAt`, `patch.isMajor` and
  `patch.detectedAt`, and every key at every depth SHALL be a camelCase name
  or a decimal integer string

#### Scenario: A key that is neither

- **IF** a rendered bundle carries `patch-id`, `PatchId` or a `heroes` entry
  with a key `SnapshotBundle` does not declare
- **THEN** the export SHALL fail rather than publish

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
major and fewer whole days have passed from its `detected_at` to the
snapshot's `created_at` than the `t_max` *Patch blending with a decaying
prior* fixes for a major patch, and to `false` otherwise. The window is that
requirement's, not a second copy of it: `stabilizing` is true exactly while
the prior it names still weighs on the blend.

#### Scenario: The day a major patch lands

- **WHEN** the snapshot's patch is major and `created_at` is on its
  `detected_at` day
- **THEN** the bundle's `stabilizing` SHALL be `true`

#### Scenario: The window has passed

- **WHEN** the snapshot's patch is major and `created_at` is `t_max` whole
  UTC days after its `detected_at`
- **THEN** the bundle's `stabilizing` SHALL be `false`

#### Scenario: An offset that crosses the UTC day

- **WHEN** a major patch's `detected_at` is `2026-07-14` and the snapshot's
  `created_at` is `2026-07-18T00:30:00+05:00`, which is
  `2026-07-17T19:30:00Z` — three whole days past the anchor `2026-07-14T00:00:00Z`,
  where reading the offset as a local date would give four — at a `t_max` of 4
- **THEN** the bundle's `stabilizing` SHALL be `true`, because `t` is 3

#### Scenario: A letter patch

- **WHEN** the snapshot's patch is not major
- **THEN** the bundle's `stabilizing` SHALL be `false`

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
`sufficient` — and the two matrices, none of which the client inspects, and a
missing one of which computes as `NaN` in the model rather than being
refused.

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

#### Scenario: A number that is not finite

- **IF** any numeric leaf of a rendered bundle is `NaN`, `Infinity`,
  `-Infinity` or `null`
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
