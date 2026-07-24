# draft-session Specification

## Purpose

The client-side draft state: the `Session` value the user builds up, the
side and role selection that starts it (by pointer and by hotkey), its
persistence across reloads, and the screen state derived from whether it is
set up yet.

## Requirements
### Requirement: Session state shape

The client SHALL hold exactly one `Session` value as defined in
`src/types.ts`, and SHALL start from `EMPTY_SESSION()` when no valid stored
session exists.

#### Scenario: Cold start

- **WHEN** the app starts with no stored session
- **THEN** the in-memory session SHALL equal `EMPTY_SESSION()` apart from
  `createdAt`, and the Setup block SHALL be shown

### Requirement: Side selection

The user SHALL be able to set `session.side` to `"radiant"` or `"dire"` by
activating the corresponding control, or by pressing `R` or `D` respectively
with no modifier key held WHILE the Setup block is shown or the header editor
is open. Selecting the already-selected side SHALL leave it selected.

#### Scenario: Hotkey without focus

- **WHEN** the Setup block is shown, no element has focus, and `R` is pressed
- **THEN** `session.side` SHALL equal `"radiant"` and the Radiant control
  SHALL be marked selected

#### Scenario: Case does not matter

- **WHEN** the Setup block is shown and `d` is pressed
- **THEN** `session.side` SHALL equal `"dire"`

#### Scenario: Modified keystrokes are ignored

- **IF** `R` is pressed while Ctrl, Meta, or Alt is held
- **THEN** `session.side` SHALL be unchanged and the browser's own shortcut
  SHALL NOT be prevented

#### Scenario: Re-selecting the current side

- **WHEN** `session.side` is `"radiant"` and `R` is pressed again in an active
  context
- **THEN** `session.side` SHALL still equal `"radiant"`

#### Scenario: Board is not an active context

- **IF** the board is shown with the header editor closed and `R` or `D` is
  pressed
- **THEN** the session SHALL be unchanged

### Requirement: Role selection

The user SHALL be able to set `session.myRole` by activating the
corresponding control, or — WHILE the Setup block is shown or the header
editor is open — by pressing the digit `1`–`5`, or the letter for that role:
`C` → 1, `M` → 2, `O` → 3, `S` → 4, `F` → 5. Modifier-held keystrokes SHALL be
ignored as for side selection.

#### Scenario: Digit hotkey

- **WHEN** the header editor is open and `3` is pressed with no modifier
- **THEN** `session.myRole` SHALL equal `3`

#### Scenario: Letter hotkey

- **WHEN** the header editor is open and `f` is pressed with no modifier
- **THEN** `session.myRole` SHALL equal `5`

#### Scenario: Unmapped key

- **WHEN** `6` or `X` is pressed
- **THEN** the session SHALL be unchanged

#### Scenario: Board is not an active context

- **IF** the board is shown with the header editor closed and `3` is pressed
- **THEN** `session.myRole` SHALL be unchanged

### Requirement: Ban list

The user SHALL be able to append a hero to `session.bans` and to remove any
entry of it. A ban SHALL NOT be appended when the hero already appears in
`bans`, `teamPicks`, or `enemyPicks`, or when `bans.length` has reached
`snapshot.heroes.length - 10`.

#### Scenario: Ban is appended

- **WHEN** a hero is banned
- **THEN** it SHALL be the last entry of `session.bans` and every other field
  SHALL be unchanged

#### Scenario: Ban is removed by position

- **WHEN** the ban at index 1 of three bans is removed
- **THEN** `session.bans` SHALL hold the other two in their original order

#### Scenario: Limit reached

- **IF** `bans.length` equals `snapshot.heroes.length - 10` and a ban is
  attempted
- **THEN** the session SHALL be unchanged

### Requirement: Team picks

The user SHALL be able to set `session.teamPicks[role]` for any role 1–5 to a
hero, replacing whatever it held, and to clear it back to `null`. Setting a
pick SHALL leave the other four roles, the bans, and the enemy picks
unchanged.

#### Scenario: Pick and replace

- **WHEN** role 2 holds a hero and another is set on role 2
- **THEN** `teamPicks["2"]` SHALL be the new hero and the previous one SHALL
  no longer appear anywhere in the session

#### Scenario: Clear

- **WHEN** role 4 is cleared
- **THEN** `teamPicks["4"]` SHALL be `null` and the other four entries SHALL
  be unchanged

### Requirement: Enemy picks

The user SHALL be able to append a hero to `session.enemyPicks` and to remove
any entry. `enemyPicks` SHALL never exceed five entries.

#### Scenario: Append

- **WHEN** a hero is added as an enemy pick with three already entered
- **THEN** `session.enemyPicks` SHALL have four entries, the new one last

#### Scenario: Remove keeps order

- **WHEN** the enemy pick at index 0 of three is removed
- **THEN** the remaining two SHALL keep their relative order

#### Scenario: Sixth pick refused

- **IF** `enemyPicks` already holds five entries and another is appended
- **THEN** the session SHALL be unchanged

### Requirement: A hero occupies at most one position

The session SHALL NOT hold the same hero in more than one of `bans`,
`teamPicks`, and `enemyPicks`. An action that would place an already-used hero
SHALL leave the session unchanged.

#### Scenario: Already-picked hero cannot be banned

- **IF** a hero sits in `teamPicks["1"]` and a ban for that hero is attempted
- **THEN** the session SHALL be unchanged

### Requirement: Setup collapses into the session-editor strip

WHILE either `session.side` or `session.myRole` is `null`, the app SHALL show
the centered Setup block. WHEN both become non-null, the app SHALL replace it
with the header, which shows the chosen side and role as text beside an `edit`
affordance, with no confirm step. Activating that affordance SHALL toggle the
editor panel holding the same side and role controls as Setup; pressing `Esc`
while it is open SHALL close it.

#### Scenario: Second choice expands the board shell

- **WHEN** `session.side` is already set and a role is then chosen
- **THEN** the centered Setup block SHALL be removed and the header showing
  the chosen side and role SHALL be rendered in the same update

#### Scenario: Side and role stay editable

- **WHEN** both are set and the user opens the header editor and chooses the
  other side
- **THEN** `session.side` SHALL be the newly chosen value and every other
  field of the session SHALL be unchanged

#### Scenario: Editor closes on Esc

- **WHEN** the header editor is open and `Esc` is pressed
- **THEN** the editor SHALL be closed and the session SHALL be unchanged

### Requirement: Session persists across reloads

WHEN any field of the session changes, the client SHALL write the whole
session to `localStorage` under the key `draft.session` before the next
user interaction can occur. WHEN the page loads, it SHALL restore that
value as the current session.

#### Scenario: Restore after reload

- **WHEN** a session with `side = "dire"` and `myRole = 2` is stored and the
  page is reloaded
- **THEN** the restored session SHALL be deeply equal to the stored one and
  the header strip SHALL show Dire and Mid

#### Scenario: Corrupt stored value

- **IF** the value under `draft.session` is not valid JSON, is not an
  object, or has `v !== 1`
- **THEN** the app SHALL discard it, start from `EMPTY_SESSION()`, and SHALL
  NOT throw

#### Scenario: Storage unavailable

- **IF** reading or writing `localStorage` throws (private mode, storage
  disabled)
- **THEN** the app SHALL run with an in-memory session for the lifetime of
  the page and SHALL NOT surface an error to the user
