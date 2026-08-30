# hero-reference delta — letter-patch-detection

## MODIFIED Requirements

### Requirement: Patches are detected from a source that is current

The ingest SHALL read the patch list from Valve's own Steam news feed for
Dota 2 (`ISteamNews/GetNewsForApp`, appid 570), not from the statistics API
and not from OpenDota. The statistics API's version list stopped roughly
eight months before this change was written while its match data did not
(`docs/context/stratz-probe-2026-08.md`); OpenDota's list carries majors
only, which left every letter patch invisible.

A news item SHALL be read as a patch WHEN its feed is Valve's own
(`feedname` of `steam_community_announcements`) AND its title carries a
version matching `\d+\.\d+[a-z]?`. That version SHALL be the patch's name
and the item's post instant its release instant. Press coverage carries a
version in its title too and posts it a day late, so the feed test is what
separates a patch from an article about one; a Valve post with no version —
a client update, a tournament announcement — is not a patch.

A patch the `patches` table lacks SHALL be inserted with `detected_at` set to
the release instant the source states, not the run instant, so that the decay
a blend applies is measured from when players met the patch rather than from
when this project first looked. A patch already held SHALL NOT have its
`detected_at` rewritten.

`is_major` SHALL be true where the patch's name carries no trailing letter.
Letter patches are now detected, which is what this change exists for: the
previous source could not see them, so the spec recorded them as folded into
their base version, and that reading is withdrawn. A version with no letter
SHALL order **before** the same version with one — `7.41` precedes `7.41a`,
which precedes `7.41b` — and the current patch is the newest by that order
whose release instant is not after the run instant.

The run SHALL fail rather than proceed on a patch list it could not read whole:
a response that cannot be fetched, one that parses to no patch at all, and one
whose newest entry lacks a name or a release instant are each a failure, and
none SHALL leave the ingest running against the patch `patches` happens to hold.
Proceeding would blend under a `detected_at` no source confirmed this run.

#### Scenario: Valve's own post names a patch

- **WHEN** the feed holds an item with `feedname`
  `steam_community_announcements` and a title carrying a version, as
  `7.41d Gameplay Patch` and `Gameplay Patch 7.41e and Summer Scrub` both do
- **THEN** the version SHALL be the patch's name and the item's post instant
  its release instant

#### Scenario: Press coverage is not a patch

- **IF** an item carrying a version in its title comes from any feed but
  Valve's own, as `Dota 2 patch 7.41c is awful news for Batrider` does
- **THEN** it SHALL NOT be read as a patch, its date being the article's and
  not the release's

#### Scenario: A Valve post with no version

- **IF** a Valve post carries no version in its title, as
  `Dota 2 Update - 7/1/2026` and `The International Main Event` do
- **THEN** it SHALL NOT be read as a patch

#### Scenario: A version with no letter precedes its `a`

- **WHEN** `7.41` and `7.41a` are both held
- **THEN** `7.41a` SHALL be the later of the two, and a run between their
  release instants SHALL take `7.41` as current

#### Scenario: A patch the table lacks

- **WHEN** the source lists a patch `patches` does not hold
- **THEN** a row SHALL be inserted whose `detected_at` is the release instant
  the source states

#### Scenario: A patch already recorded

- **WHEN** a later run reads a patch already in `patches`
- **THEN** its `detected_at` SHALL be the value the first run wrote

#### Scenario: A name with a trailing letter

- **IF** a detected patch's name ends in a letter
- **THEN** its `is_major` SHALL be false and its `base_version` SHALL be the
  name without that letter

#### Scenario: The current patch

- **WHEN** the ingest asks which patch is current
- **THEN** it SHALL be the held patch with the latest `detected_at` not after
  the run instant

#### Scenario: The source cannot be reached

- **IF** the patch list request fails after its retries
- **THEN** the run SHALL fail, and no staging row SHALL be written

#### Scenario: The source answers with nothing usable

- **IF** the patch list parses to no patch, or its newest entry carries no name
  or no release instant
- **THEN** the run SHALL fail naming which, and SHALL NOT fall back to the
  patch `patches` already holds

## ADDED Requirements

### Requirement: The run reports how long detection has been silent

The run's report SHALL state how many whole days have passed since the
release instant of the newest patch `patches` holds, and SHALL say so as a
failure once that exceeds a stated bound.

A source read through the text of a title is one that can stop matching
without failing: the request succeeds, the parse finds nothing, and
`detected_at` simply stops moving — which is exactly how the previous source
went five patches without anyone noticing. Nothing else in the run would
report it. Over the hundred posts measured, no gap between gameplay patches
reached ninety days.

#### Scenario: Detection has gone quiet

- **WHEN** the newest held patch was released more days ago than the bound
- **THEN** the run SHALL report that as a failure naming the patch and the
  gap, rather than completing silently

#### Scenario: A gap inside the bound

- **WHEN** the newest held patch is younger than the bound
- **THEN** the run SHALL report the gap and continue
