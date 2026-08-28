# draft-board — delta

## MODIFIED Requirements

### Requirement: Hero tile

A hero tile SHALL be a square in the mono font, at one of three sizes: 40px in
the bans row, 34px in a team slot, 26px on a suggestion chip. It SHALL draw the
hero's mirrored image, requested from this origin at the path the hero entry's
`icon` field names, scaled to cover the square and cropped about its centre.
WHERE the tile draws no image — the hero entry carries no `icon`, or the request
for it does not resolve — the tile SHALL show the hero's abbreviation, the first
four letters of its name with non-letters removed and uppercased, over the
`--hero-<short>` token, or over `--hero-fallback` when the palette has no entry
for that hero. That fallback's ink SHALL be `--tile-ink-light` when its
background's relative luminance is below 0.18 and `--tile-ink-dark` otherwise.
Every tile SHALL either carry an accessible name naming its hero, or be hidden
from assistive technology when the row it sits in already names that hero; the
image SHALL contribute no name beside it.

#### Scenario: The image is drawn

- **WHEN** the hero entry carries `icon` and the request for that path resolves
- **THEN** the tile SHALL show that image filling the square, and no
  abbreviation SHALL be visible

#### Scenario: The image does not resolve

- **IF** the hero entry carries no `icon`, or the request for the path it names
  answers a status other than 200
- **THEN** the tile SHALL show the abbreviation over its palette background, and
  SHALL present no broken-image affordance

#### Scenario: Abbreviation

- **WHEN** the hero is `Keeper of the Light` and the tile draws no image
- **THEN** the tile SHALL read `KEEP`

#### Scenario: Ink follows the background

- **WHILE** the tile draws no image
- **WHEN** the hero is `Bane` (`#4a3d85`, luminance 0.065)
- **THEN** the tile ink SHALL be `--tile-ink-light`
- **WHEN** the hero is `Io` (`#dce8f2`, luminance 0.793)
- **THEN** the tile ink SHALL be `--tile-ink-dark`

#### Scenario: Hero missing from the palette

- **IF** no `--hero-<short>` token exists for the hero and the tile draws no
  image
- **THEN** the tile SHALL use `--hero-fallback` and SHALL still render its
  abbreviation

#### Scenario: Hero missing from the snapshot

- **IF** the session holds a hero id that the current snapshot does not
  contain
- **THEN** the board SHALL render the remaining panels without throwing, and
  that slot SHALL render a fallback tile with no name
