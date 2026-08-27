# hero-reference Specification

## Purpose

What the hero reference holds and where it comes from: the rows a run
upserts and never removes, the images it mirrors onto this application's own
origin, and how both are served.

## Requirements

### Requirement: A hero is upserted and never removed

The ingest SHALL insert a hero the reference tables lack and update the names
of one they hold, and SHALL delete none. A hero's `first_seen_at` SHALL be
written once and never rewritten. Removal is refused for two reasons that hold
independently: a session the client is holding may name a hero the next
response omits, and `snapshot-build` fails a snapshot whose hero count falls
below the previous one, so a hero dropped for a single bad response would end
the run at `failed` rather than merely narrowing the grid.

These rows are written outside the staging transaction and are not undone by a
later failure. That is safe precisely because the only operations here are an
insert and a name update, both of which a repeat performs identically and
neither of which any later step depends on having been rolled back.

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

#### Scenario: A run that fails after the upsert

- **IF** the run fails after the hero upsert and before staging commits
- **THEN** the upserted rows SHALL remain, and a repeat of the run SHALL leave
  them unchanged

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

The run SHALL fail rather than proceed on a patch list it could not read whole:
a response that cannot be fetched, one that parses to no patch at all, and one
whose newest entry lacks a name or a release instant are each a failure, and
none SHALL leave the ingest running against the patch `patches` happens to hold.
Proceeding would blend under a `detected_at` no source confirmed this run.

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

### Requirement: The hero reference is read whole or the run fails

The ingest SHALL read every hero from the statistics API — the id Valve mints,
the display name and the slug — and SHALL derive each hero's image location
from that slug rather than from a second vendor. The statistics API publishes
no image field at all, but the slug it publishes is the name Valve's own
content delivery network serves each hero's image under, over every hero the
source returns. A vendor republishing that location would be one more source to
be unavailable, bought for a path this one already determines; and a derived
location that is wrong is not silent, because a hero whose image cannot be
fetched already fails the run.

The reference SHALL be read whole before any of it is upserted. A hero source
unreadable after its retries, and one that parses to no hero, are each a
failure of the run, and neither SHALL leave the ingest running against the
heroes `heroes` happens to hold — the reference is what every staging row is
keyed to. What the upsert then does with a run that fails part-way is
*A hero is upserted and never removed*'s, which keeps those rows on purpose;
this requirement fixes only that a failed read reaches no upsert at all.

#### Scenario: A hero source that cannot be reached

- **IF** the hero request fails after its retries
- **THEN** the run SHALL fail, and no hero SHALL be upserted

#### Scenario: A hero source that lists no hero

- **IF** the response parses to no hero at all
- **THEN** the run SHALL fail naming that, and SHALL NOT proceed on the heroes
  the reference tables already hold

#### Scenario: A hero the source describes incompletely

- **IF** an entry the source returns carries no id or no slug
- **THEN** the run SHALL fail naming that entry, and no hero SHALL be upserted

#### Scenario: A derived image location

- **WHEN** the source returns a hero
- **THEN** its image SHALL be fetched from the location its slug names, and no
  request SHALL be made to a vendor for that location

### Requirement: Hero images are mirrored to the application's own origin

The ingest SHALL fetch each hero's image once and store it under a directory
the application serves, and the `icon` a hero carries SHALL be a path on the
application's own origin. `app-shell` forbids the running application any
request off its origin, so an image URL carried through from its source would
be a bundle the client cannot render without breaking that requirement.

Each image SHALL be written to a temporary name and moved to its final one only
once the whole file is on disk. The serving route resolves the directory per
request while the job is writing it, so a file appearing under its final name
before it is complete would be served truncated; the move is what makes the
appearance and the completeness the same event. The temporary name SHALL be one
the route cannot serve.

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

#### Scenario: A read taken while a file is being written

- **WHEN** requests for a hero's image are taken repeatedly across the ingest
  writing it
- **THEN** each SHALL answer either the complete file or a `404`, and never
  part of one

#### Scenario: A new hero whose image cannot be fetched

- **IF** a hero the reference tables lack has no mirrored file and its image
  request fails
- **THEN** the run SHALL fail, and no `icon` SHALL be stored naming an absent
  file

### Requirement: The mirrored images are served from the application's origin

A request for a hero's `icon` path SHALL be answered `200` with
`content-type: image/png` and `cache-control: public, max-age=31536000,
immutable`. The filename carries the hero, and the bytes under a given name
never change, which is the same reason the font routes are cached forever.

A request naming a file the mirror does not hold SHALL be answered `404` with
an empty body. There is no error envelope to shape: `docs/api-design.md`'s
RFC 9457 rule reaches a response that carries a body, and this one carries
none.

The route SHALL resolve the directory's contents per request rather than at
startup, because the job writes that directory while the server is running, and
SHALL serve no path outside it.

#### Scenario: A mirrored image

- **WHEN** a request names the `icon` path a hero carries
- **THEN** the response SHALL be `200` carrying the mirrored bytes,
  `content-type: image/png` and the immutable cache header

#### Scenario: A name the mirror does not hold

- **WHEN** a request names an image file absent from the mirror
- **THEN** the response SHALL be `404` with an empty body

#### Scenario: A path that climbs out

- **IF** a request names a path that resolves outside the mirror directory
- **THEN** no file outside it SHALL be served

#### Scenario: A file written after the server started

- **WHEN** the ingest adds a hero's image while the server is running
- **THEN** the next request for it SHALL be answered from that file, with no
  restart
