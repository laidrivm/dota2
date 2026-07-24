# hero-picker Specification

## ADDED Requirements

### Requirement: Picker opens for one named target

The app SHALL open the hero picker for exactly one target — a ban, a role of my
team, or an enemy slot — and SHALL name that target in the picker's title:
`Pick for: <Role> (my team)`, `Pick for: enemy`, `Pick for: ban`. The picker
SHALL be a modal overlay over the board, with the rest of the page inert while
it is open.

#### Scenario: Opened from a slot

- **WHEN** the pick-entry control of the empty Offlane slot is activated
- **THEN** the picker SHALL be open with the title `Pick for: Offlane (my team)`
  and no other target

#### Scenario: Background is inert

- **WHILE** the picker is open
- **THEN** controls on the board SHALL NOT be focusable or activatable, and the
  picker SHALL hold focus

#### Scenario: Closed without choosing

- **WHEN** the picker is closed by `Esc`, by its `✕` control, or by activating
  the backdrop
- **THEN** the session SHALL be unchanged and focus SHALL return to the control
  that opened the picker

### Requirement: Board hotkeys open the picker

WHILE the board is shown with no modal open and no field owning the keystroke,
pressing an unmodified `B` SHALL open the picker for a new ban, `E` for the
enemy team, and a digit `1`–`5` or the letter for that role (`C` → 1, `M` → 2,
`O` → 3, `S` → 4, `F` → 5) SHALL open it for that role of my team. Modified
keystrokes SHALL be ignored.

#### Scenario: Ban hotkey

- **WHEN** `B` is pressed on the board with no element focused
- **THEN** the picker SHALL open with target `ban`

#### Scenario: Role hotkey targets a filled slot

- **IF** role 3 already holds a hero and `O` is pressed
- **THEN** the picker SHALL open for role 3, and choosing a hero SHALL replace
  the one in that slot

#### Scenario: Enemy hotkey with a full enemy team

- **IF** `enemyPicks` holds five entries and `E` is pressed
- **THEN** the picker SHALL NOT open and the session SHALL be unchanged

#### Scenario: Ban hotkey at the ban limit

- **IF** `bans.length` equals `snapshot.heroes.length - 10` and `B` is pressed
- **THEN** the picker SHALL NOT open

#### Scenario: Modified keystroke

- **IF** `B` is pressed with Ctrl, Meta, or Alt held
- **THEN** the picker SHALL NOT open and the browser's own shortcut SHALL NOT
  be prevented

### Requirement: Search filters from the first character

The picker SHALL focus its search field when it opens and SHALL filter the grid
on every input event. A hero SHALL match WHEN the lowercased query is a prefix
of any word of its canonical name or of any of its `aliases`. An empty query
SHALL match every hero. Matches SHALL be listed in ascending name order.

#### Scenario: Alias match

- **WHEN** the query is `bone`
- **THEN** Clinkz SHALL be among the matches, through the alias `bone fletcher`

#### Scenario: Abbreviation match

- **WHEN** the query is `wk`
- **THEN** Wraith King SHALL be among the matches

#### Scenario: Word prefix inside a name

- **WHEN** the query is `king`
- **THEN** Wraith King SHALL match, because `king` is a whole word of the name

#### Scenario: Not a substring search

- **WHEN** the query is `ing`
- **THEN** Wraith King SHALL NOT match

#### Scenario: Whitespace-only query

- **WHEN** the query is one or more spaces
- **THEN** every hero SHALL match, as for an empty query

#### Scenario: Search field has focus on open

- **WHEN** the picker opens
- **THEN** the search field SHALL be the focused element and SHALL be empty

### Requirement: Grid shows taken heroes as taken

The grid SHALL render every hero of the snapshot that matches the query, each
as a tile with its name, and SHALL render a hero already placed in the session
dimmed, unselectable, and labelled with where it sits — `ban`, `team`, or
`enemy`.

#### Scenario: A banned hero is visible and refused

- **WHEN** a hero is banned and the picker is opened
- **THEN** that hero SHALL appear in the grid labelled `ban`, SHALL NOT be
  activatable, and activating its position SHALL leave the session unchanged

#### Scenario: Every tile is named

- **WHEN** the grid is rendered
- **THEN** each selectable tile SHALL be a `button` with an accessible name
  containing the hero's name

#### Scenario: No match

- **IF** the query matches no hero
- **THEN** the grid SHALL be empty and the picker SHALL say so in a
  `role="status"` message

### Requirement: Picker is operable from the keyboard alone

WHILE the picker is open, `Enter` SHALL choose the first match, the arrow keys
SHALL move focus within the grid — left and right by one tile, up and down by
one row — `Esc` SHALL close without choosing, and a printable character pressed
while focus is in the grid SHALL be appended to the search query with focus
returning to the search field.

#### Scenario: Enter takes the first match

- **WHEN** the query is `cli` and `Enter` is pressed
- **THEN** Clinkz SHALL be applied to the picker's target and the picker SHALL
  close

#### Scenario: First match is marked

- **WHILE** the grid has at least one match
- **THEN** the first match SHALL be visually distinguished from the rest

#### Scenario: Enter with no match

- **IF** the query matches no hero and `Enter` is pressed
- **THEN** the picker SHALL stay open and the session SHALL be unchanged

#### Scenario: Arrows move by row

- **WHEN** focus is on the first tile of the grid and `ArrowDown` is pressed
- **THEN** focus SHALL move to the tile one full row later in the grid, and
  SHALL stay on the current tile when no such tile exists

#### Scenario: Typing returns to the search field

- **WHEN** focus is on a tile and `s` is pressed
- **THEN** the search field SHALL be focused and its value SHALL end with `s`

### Requirement: A choice applies and closes

WHEN a hero is chosen, the picker SHALL dispatch the action its target names —
a ban, a team pick on that role, or an enemy pick — SHALL close, and the model
SHALL be recomputed in the same update. Focus SHALL move to a control of the
position just filled and SHALL NOT fall back to the document body.

#### Scenario: Team pick applied

- **WHEN** a hero is chosen with target role 4
- **THEN** `teamPicks["4"]` SHALL hold that hero, the picker SHALL be closed,
  and the suggestion blocks and the win estimate SHALL reflect the new pick

#### Scenario: Focus after the pick

- **WHEN** the picker closes after a choice and the control that opened it has
  been replaced by the filled slot
- **THEN** focus SHALL be on a control of that slot

### Requirement: The picker is never persisted

The open state of the picker and its query SHALL NOT be written to the session
or to storage.

#### Scenario: Reload with the picker open

- **WHEN** the page is reloaded while the picker is open
- **THEN** the board SHALL be restored with the picker closed and the session
  SHALL be the one stored before

### Requirement: Full-screen picker on a narrow viewport

WHILE the viewport is 720px wide or less, the picker SHALL fill the viewport,
and its grid SHALL reflow to fewer columns with no hero omitted and no
horizontal page scroll.

#### Scenario: 390px picker

- **WHEN** the picker is opened in a 390px-wide viewport
- **THEN** `document.documentElement.scrollWidth` SHALL NOT exceed its
  `clientWidth`, and the search field SHALL be visible without scrolling
