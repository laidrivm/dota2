# hero-palette Specification

## Purpose

What the hero placeholder palette is keyed on, which heroes it covers, the two
floors every colour in it clears, and how it is regenerated from the mirrored
portraits. It exists because the square is what a tile shows when its portrait
does not load, and a palette maintained by hand drifted from the data it is
looked up with.

## Requirements

### Requirement: The palette is keyed on the slug the ingest writes

Every hero colour SHALL be named `--hero-<short>`, where `<short>` is the value
the snapshot bundle carries in `heroes[].short` — the slug the hero source
publishes, written through unchanged — and SHALL match the same rule that
governs a mirrored file's name, `^[a-z0-9_-]+$`. The palette SHALL hold one
token for every hero the image mirror holds a portrait for, and the fixture
served in place of a bundle SHALL carry the same spelling of `short` as the
mirror names its files with.

#### Scenario: A hero whose slug and display name diverge

- **WHEN** the bundle carries a hero whose `short` is `antimage`
- **THEN** the palette SHALL hold `--hero-antimage`, and no token SHALL be
  named for a spelling the bundle does not carry

#### Scenario: A slug carrying a separator

- **WHEN** the bundle carries a hero whose `short` is `bounty_hunter`
- **THEN** the palette SHALL hold `--hero-bounty_hunter`, and every check that
  reads the palette SHALL match that token

#### Scenario: The fixture agrees with the palette

- **WHEN** the fixture snapshot is read
- **THEN** every `heroes[].short` in it SHALL match `^[a-z0-9_-]+$` and SHALL
  resolve a token in the palette — a check the mirror is absent for, since it
  is written by a job run and carried by no clone

#### Scenario: The fixture's two derived spellings

- **WHEN** a fixture hero's `icon` is read
- **THEN** it SHALL be `/icons/<that hero's short>.png`, rather than a second
  spelling derived from the display name

### Requirement: Every hero colour clears the ink floor

The palette SHALL carry `--hero-fallback` on every run of the generator,
whatever the mirror holds, because it is what `draft-board` §*Hero tile*
resolves for a hero the palette has no token for. Every token in it, that one
included, SHALL reach a contrast ratio of at least 4.5:1 against whichever of `--tile-ink-dark` and
`--tile-ink-light` the luminance threshold in `draft-board` §*Hero tile* picks
for it.

#### Scenario: A mirror holding every hero the palette knows

- **WHEN** the generator runs over a mirror no hero is missing from
- **THEN** the palette SHALL still carry `--hero-fallback`, unchanged in value
  by the run

#### Scenario: A colour that would not clear the floor

- **IF** a colour derived for a hero reaches less than 4.5:1 against the ink its
  own luminance selects
- **THEN** the generator SHALL darken or lighten it until it does, and SHALL
  write no token that does not

### Requirement: No two hero colours read as the same

Any two tokens in the palette, `--hero-fallback` included, SHALL differ by at
least 15 in CIELAB ΔE76.

#### Scenario: Two heroes whose portraits share a dominant colour

- **WHEN** two heroes' portraits yield colours closer than 15 ΔE76
- **THEN** the generator SHALL move one of them — in hue first, then in
  lightness — until the pair clears 15, and SHALL fail rather than write a
  palette in which any pair does not

### Requirement: The palette is generated from the mirrored portraits

The project SHALL provide a script that derives each hero's colour from that
hero's mirrored portrait and writes the palette, and SHALL commit its output.
The same portraits SHALL yield the same palette on every run, and a portrait
the script cannot read SHALL stop it rather than be skipped.

#### Scenario: A portrait the decoder cannot read

- **IF** a file in the mirror is not a PNG the script can decode
- **THEN** the script SHALL exit non-zero naming that file, and SHALL emit no
  palette — leaving whatever is committed untouched

#### Scenario: The same mirror twice

- **WHEN** the script runs twice over an unchanged mirror
- **THEN** it SHALL emit byte-identical palettes, whether to its output or into
  the token file

#### Scenario: A hero the mirror has no portrait for

- **WHEN** the hero source publishes a hero after the last run of the script
- **THEN** the palette SHALL hold no token for that hero, and the board's
  fallback SHALL cover it
