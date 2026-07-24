# snapshot-delivery Specification

## Purpose

How the client obtains the `SnapshotBundle` it computes from: one fetch of
a stable URL, a last-good cache that keeps the tool usable when the network
is not, the error and retry behaviour when neither is available, and the
snapshot metadata the header shows.

## Requirements
### Requirement: Snapshot is fetched from a URL

The client SHALL obtain its `SnapshotBundle` by fetching one stable URL. It
SHALL NOT import the bundle as a module, so that replacing the producer
(Phase 4) changes nothing on the client but that URL.

#### Scenario: Startup fetch

- **WHEN** the app starts
- **THEN** it SHALL issue exactly one request for the snapshot URL, and
  SHALL NOT issue another except in response to an explicit retry after a
  failure — it SHALL never poll or refetch on its own

#### Scenario: Malformed payload

- **IF** the response is not valid JSON, or lacks any of `snapshotId`,
  `patch.id`, `createdAt`, or a non-empty `heroes` array
- **THEN** the app SHALL treat the fetch as failed and follow the
  cache-fallback rules below rather than rendering a partial snapshot

### Requirement: Last good snapshot is cached

On every successful fetch the client SHALL store the bundle in
`localStorage` under a single key, replacing any previous value.

#### Scenario: Fetch fails with a warm cache

- **IF** the snapshot fetch fails and a cached bundle is present
- **THEN** the app SHALL run on the cached bundle and the header SHALL show
  that bundle's own patch id and snapshot date

#### Scenario: Fetch fails with a cold cache

- **IF** the snapshot fetch fails and no cached bundle is present
- **THEN** the app SHALL show an error state with a retry control, and
  activating retry SHALL re-attempt the fetch without reloading the page

#### Scenario: Cache write is rejected

- **IF** writing the snapshot to `localStorage` throws (quota exceeded or
  storage disabled)
- **THEN** the app SHALL continue on the in-memory bundle and SHALL NOT
  surface an error to the user

### Requirement: Header shows snapshot provenance

The header SHALL show the snapshot's patch id and the calendar date of
`createdAt`, formatted as `patch <id> · snapshot <Mon D>` — for example
`patch 7.41d · snapshot Jul 19`.

#### Scenario: Metadata rendered

- **WHEN** a snapshot with `patch.id = "7.41d"` and
  `createdAt = "2026-07-19T03:00:00Z"` is in use
- **THEN** the header SHALL contain the text `patch 7.41d · snapshot Jul 19`

### Requirement: Stabilizing banner

WHILE the active bundle has `stabilizing: true`, the header SHALL display
the banner `new patch — stats are still stabilizing`; WHILE it is `false`,
the banner SHALL be absent.

#### Scenario: Banner toggles with the flag

- **WHEN** the active bundle has `stabilizing: true`
- **THEN** the banner text SHALL be present in the header
- **WHEN** the active bundle has `stabilizing: false`
- **THEN** the banner SHALL NOT be rendered at all

### Requirement: A newer snapshot never destroys the session

WHEN the fetched snapshot has a different `snapshotId` than the cached one,
the client SHALL adopt the new bundle and SHALL leave the stored session
unchanged.

#### Scenario: Snapshot changes between reloads

- **WHEN** a session exists, and the page is reloaded while the served
  snapshot has been replaced by one with a different `snapshotId`
- **THEN** the restored session SHALL be equal to the one stored before the
  reload, and the header SHALL show the new snapshot's metadata
