# hero-reference — delta spec

## ADDED Requirements

### Requirement: A hero is upserted and never removed

The ingest SHALL insert a hero the reference tables lack and update the names
of one they hold, and SHALL delete none. A hero's `first_seen_at` SHALL be
written once and never rewritten. Removal is refused for two reasons that hold
independently: a session the client is holding may name a hero the next
response omits, and `snapshot-build` fails a snapshot whose hero count falls
below the previous one, so a hero dropped for a single bad response would end
the run at `failed` rather than merely narrowing the grid.

#### Scenario: A hero the response omits

- **WHEN** a later response omits a hero the reference tables hold
- **THEN** that hero SHALL still be present afterwards, with its original
  `first_seen_at`

#### Scenario: A hero that was renamed

- **WHEN** a response carries a different display name for a hero already held
- **THEN** the stored name SHALL be the one just returned and `first_seen_at`
  SHALL be unchanged

#### Scenario: A hero that is new

- **WHEN** a response carries a hero the reference tables lack
- **THEN** a row SHALL be inserted with `first_seen_at` set to the run instant

### Requirement: Patches are detected from a source that is current

The ingest SHALL read the patch list from a source outside the statistics API,
because that API's own version list stopped roughly eight months before this
change was written while its match data did not — a patch released since is
absent from it, and a run reading it would date every blend from a patch two
releases old (`docs/context/stratz-probe-2026-08.md`). A patch the `patches`
table lacks SHALL be inserted with `detected_at` set to the release instant the
source states, not the run instant, so that the decay a blend applies is
measured from when players met the patch rather than from when this project
first looked. A patch already held SHALL NOT have its `detected_at` rewritten.

`is_major` SHALL be true where the patch's name carries no trailing letter.
The source lists majors only, so in practice every detected patch is major and
a letter patch is folded into its base version — a coarser prior than
`snapshot-build` provides for, and the reason this change's proposal names
letter patches as a non-goal rather than leaving them unmentioned.

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

### Requirement: Hero images are mirrored to the application's own origin

The ingest SHALL fetch each hero's image once and store it under a directory
the application serves, and the `icon` a hero carries SHALL be a path on the
application's own origin. `app-shell` forbids the running application any
request off its origin, so an image URL carried through from its source would
be a bundle the client cannot render without breaking that requirement.

An image already mirrored SHALL NOT be fetched again — the files are immutable
under their names, and refetching 127 of them nightly would be the run's
largest transfer for no change. IF a hero has no mirrored image and its fetch
fails, the run SHALL fail rather than write a path to a file that is not there:
a hero tile with a broken image is worse than a run that retries tomorrow. A
hero whose image is already mirrored SHALL survive a failed refetch, there
being nothing to refetch.

Exactly one size is mirrored. A screen needing a second is the change that adds
it, not a second download this one performs speculatively.

#### Scenario: The first run

- **WHEN** the ingest runs against an empty mirror directory
- **THEN** every hero SHALL have a file in it, and every hero's `icon` SHALL be
  a path beginning with `/`

#### Scenario: A file already mirrored

- **WHEN** the ingest runs with every hero's file already present
- **THEN** no image request SHALL be issued

#### Scenario: A new hero whose image cannot be fetched

- **IF** a hero the reference tables lack has no mirrored file and its image
  request fails
- **THEN** the run SHALL fail, and no `icon` SHALL be stored naming an absent
  file

#### Scenario: The mirrored image is served

- **WHEN** a request names the `icon` path a hero carries
- **THEN** the response SHALL carry the mirrored bytes and an image
  content type
