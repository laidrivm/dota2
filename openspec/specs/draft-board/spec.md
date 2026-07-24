# draft-board Specification

## Purpose

The board screen: which panels exist, what each renders from the session and
the model output, how a pick is entered and removed, how the layout collapses
to one column, and how the hero tile derives its colour and ink from the design
tokens.

## Requirements
### Requirement: Board composition

WHILE `session.side` and `session.myRole` are both non-null, the app SHALL
render, in this order: the header, the bans row, the two team panels, and
either the suggestions panel or the result panel. Each panel SHALL derive its
content from `(snapshot, session, modelOutput)` and SHALL hold no state of its
own.

#### Scenario: Board replaces Setup

- **WHEN** the second of side and role is chosen
- **THEN** the bans row, both team panels, and the suggestions panel SHALL be
  rendered in the same update, with no confirm step

#### Scenario: My team sits on the side the player is on

- **WHEN** `session.side` is `"radiant"`
- **THEN** the my-team panel SHALL precede the enemy panel in visual order
- **WHEN** `session.side` is `"dire"`
- **THEN** the enemy panel SHALL precede the my-team panel

#### Scenario: Panel headers name the sides

- **WHEN** `session.side` is `"dire"`
- **THEN** the my-team panel SHALL be labelled `MY TEAM DIRE` and the enemy
  panel `ENEMY TEAM RADIANT`

### Requirement: Model output is recomputed on every session change

WHEN any field of `session` changes, the app SHALL recompute `computeModel`
synchronously before the next paint and render the new values. It SHALL NOT
show a spinner, a stale-value placeholder, or an intermediate loading state.

#### Scenario: A pick updates every derived readout

- **WHEN** an enemy pick is added
- **THEN** the enemy role probabilities, every suggestion block, and the phase
  indicator SHALL all reflect the new session in the same update

#### Scenario: Editing side with a full board

- **WHEN** all ten picks are entered and `session.side` is changed
- **THEN** every pick SHALL be unchanged and the result block SHALL show the
  recomputed advantage and win probability

### Requirement: Bans row

The bans row SHALL render one 40px hero tile per entry of `session.bans`, in
insertion order, each with a control that removes that ban. It SHALL offer a
pick-entry control that adds a ban, and that control SHALL be available in
every phase.

#### Scenario: Empty bans

- **WHEN** `session.bans` is empty
- **THEN** the bans row SHALL render its label and the pick-entry control and
  no tiles

#### Scenario: Ban removal

- **WHEN** the removal control of the second ban is activated
- **THEN** that hero SHALL be gone from `session.bans`, the other bans SHALL
  keep their order, and the model output SHALL be recomputed

#### Scenario: Ban limit

- **IF** `session.bans.length` equals `snapshot.heroes.length - 10`
- **THEN** the pick-entry control SHALL be disabled and SHALL carry a title
  stating the limit

### Requirement: My-team slots

The my-team panel SHALL render exactly five slots, one per role 1–5, each
labelled with its role number and name. The slot whose role equals
`session.myRole` SHALL be marked with a star and the accent colour. A filled
slot SHALL show a 34px hero tile, the hero name, and a removal control; an
empty slot SHALL show the pick-entry control for that role.

#### Scenario: My role is marked

- **WHEN** `session.myRole` is `3`
- **THEN** the Offlane slot SHALL carry the star marker and SHALL be the only
  slot that does

#### Scenario: Filling a slot

- **WHEN** a hero is chosen for the empty Mid slot
- **THEN** `session.teamPicks["2"]` SHALL be that hero and the slot SHALL show
  its tile, name, and removal control

#### Scenario: Clearing a slot

- **WHEN** the removal control of a filled slot is activated
- **THEN** that slot's `teamPicks` entry SHALL be `null`, every other slot
  SHALL be unchanged, and a suggestion block for that role SHALL appear

#### Scenario: Thin statistics are flagged

- **IF** a picked hero has `sufficient: false`
- **THEN** its slot SHALL show an `insufficient data` badge

### Requirement: Enemy slots with inferred roles

The enemy panel SHALL render five slots without roles. A filled slot SHALL
show a 34px hero tile, the hero name, the two highest role probabilities from
`modelOutput.enemyRoles` for that hero formatted as `p<role> <pct>%` joined by
` · `, and a removal control. An empty slot SHALL show the pick-entry control.

#### Scenario: Probabilities are rendered for a filled slot

- **WHEN** an enemy hero's inferred probabilities are `{1: 0.62, 2: 0.31, 3:
  0.04, 4: 0.02, 5: 0.01}`
- **THEN** the slot SHALL read `p1 62% · p2 31%`

#### Scenario: A second term that rounds to zero is dropped

- **IF** the second-highest probability rounds to `0%`
- **THEN** only the highest term SHALL be rendered

#### Scenario: Probabilities follow the draft

- **WHEN** a further enemy pick is added
- **THEN** the probabilities on every already-filled enemy slot SHALL be
  recomputed

### Requirement: Suggestion blocks

WHILE at least one role of `session.teamPicks` is `null`, the app SHALL render
one suggestion block per still-open role, taken from
`modelOutput.suggestions`. The block for `session.myRole` SHALL be first and
carry the star marker and the accent row background. Each block SHALL render
its entries in descending score as chips of a 26px hero tile plus the score,
formatted with a sign and one decimal (`+2.1%`, `-0.4%`). The panel SHALL show
the current pick phase as `1st`, `2nd`, or `last`.

#### Scenario: Suggestions at an empty draft

- **WHEN** side and role are set and no ban or pick has been entered
- **THEN** five suggestion blocks SHALL be rendered, the block for
  `session.myRole` first

#### Scenario: A suggestion is a one-click pick

- **WHEN** a chip in the Offlane block is activated
- **THEN** `session.teamPicks["3"]` SHALL be that hero, the Offlane block
  SHALL disappear, and every remaining block SHALL be recomputed

#### Scenario: Score sign is visible

- **IF** an entry's score is zero or negative
- **THEN** it SHALL be rendered in the muted text colour rather than the
  positive-score colour

#### Scenario: Thin statistics are flagged on a chip

- **IF** a suggested hero has `sufficient: false`
- **THEN** its chip SHALL carry an `insufficient data` badge

### Requirement: Result block

WHEN all five team picks and all five enemy picks are entered, the app SHALL
replace the suggestions panel with the result block, showing
`modelOutput.winEstimate` as `Draft advantage: <±X.X pp> → ~<N>% win`, the
advantage to one decimal with a sign and the win probability to the nearest
whole percent. IF the five team picks are entered while enemy picks are
incomplete, THEN the app SHALL show `Add enemy picks to see win probability`
instead of either panel.

#### Scenario: Full draft

- **WHEN** the tenth pick is entered and `winEstimate` is
  `{advantage: 3.24, winProbability: 0.58}`
- **THEN** the result block SHALL read `Draft advantage: +3.2 pp → ~58% win`
  and no suggestion block SHALL be rendered

#### Scenario: Team complete, enemies not

- **WHEN** all five team picks are set and four enemy picks are set
- **THEN** the hint SHALL be shown and no win probability SHALL be rendered

#### Scenario: Partial draft shows no estimate

- **WHILE** any of the ten picks is missing and at least one team role is open
- **THEN** the suggestions panel SHALL be shown and no win probability SHALL
  be rendered anywhere

### Requirement: Hero tile

A hero tile SHALL be a square carrying the hero's abbreviation — the first
four letters of its name with non-letters removed, uppercased — in the mono
font, at one of three sizes: 40px in the bans row, 34px in a team slot, 26px
on a suggestion chip. Its background SHALL be the `--hero-<short>` token, or
`--hero-fallback` when the palette has no entry for that hero. Its ink SHALL
be `--tile-ink-light` when the background's relative luminance is below 0.22
and `--tile-ink-dark` otherwise. Every tile SHALL either carry an accessible
name naming its hero, or be hidden from assistive technology when the row it
sits in already names that hero.

#### Scenario: Abbreviation

- **WHEN** the hero is `Keeper of the Light`
- **THEN** the tile SHALL read `KEEP`

#### Scenario: Ink follows the background

- **WHEN** the hero is `Bane` (`#4a3d85`, luminance 0.065)
- **THEN** the tile ink SHALL be `--tile-ink-light`
- **WHEN** the hero is `Io` (`#dce8f2`, luminance 0.793)
- **THEN** the tile ink SHALL be `--tile-ink-dark`

#### Scenario: Hero missing from the palette

- **IF** no `--hero-<short>` token exists for the hero
- **THEN** the tile SHALL use `--hero-fallback` and SHALL still render its
  abbreviation

#### Scenario: Hero missing from the snapshot

- **IF** the session holds a hero id that the current snapshot does not
  contain
- **THEN** the board SHALL render the remaining panels without throwing, and
  that slot SHALL render a fallback tile with no name

### Requirement: Pick entry

Every empty team slot, every empty enemy slot, and the bans row SHALL offer a
labelled control that enters a hero into that position. The control SHALL
offer only heroes that are not already banned or picked on either team, in
ascending name order, and choosing one SHALL apply it and recompute the model
in the same update.

#### Scenario: Used heroes are not offered

- **WHEN** a hero is banned
- **THEN** it SHALL NOT be offered by any pick-entry control until the ban is
  removed

#### Scenario: Every control is labelled

- **WHEN** the board is rendered
- **THEN** each pick-entry control SHALL have an accessible name naming the
  position it fills — the role for a team slot, `enemy pick` for an enemy
  slot, `ban` for the bans row

### Requirement: One-column layout on a narrow viewport

WHILE the viewport is 720px wide or less, the app SHALL stack the two team
panels in one column in the order the side determines, place the enemy role
probabilities under the hero name, and render the bans row and each suggestion
row as horizontally scrollable strips with no entry omitted. At 390px the page
SHALL NOT scroll horizontally.

#### Scenario: 390px board

- **WHEN** the board is rendered in a 390px-wide viewport
- **THEN** `document.documentElement.scrollWidth` SHALL NOT exceed its
  `clientWidth`, and both team panels SHALL be full width

#### Scenario: Scroll strips are operable without a pointer

- **WHEN** a suggestion row overflows its strip
- **THEN** the strip SHALL be scrollable by keyboard — through scroll buttons
  or by being focusable — and SHALL render the same number of entries as the
  wide layout

### Requirement: Removal controls are reachable

Every removal control SHALL be a `button` with an accessible name naming the
hero it removes, SHALL be reachable by keyboard, and SHALL be visible whenever
its row has focus within it, not only on pointer hover.

#### Scenario: Keyboard reveal

- **WHEN** the removal control of a filled slot receives focus
- **THEN** it SHALL be visible and SHALL show a focus indicator

#### Scenario: Focus survives the removal

- **WHEN** a removal control is activated and unmounts with the entry it
  removed
- **THEN** focus SHALL move to the pick-entry control that replaces it —
  the same slot's where the slot survives, the region's first otherwise —
  and SHALL NOT fall back to the document body
