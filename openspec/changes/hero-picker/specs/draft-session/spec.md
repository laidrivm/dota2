# draft-session Specification

## ADDED Requirements

### Requirement: Reset clears the draft and keeps the setup

The header SHALL offer a `New` control that clears `bans`, `teamPicks`, and
`enemyPicks` while leaving `session.side` and `session.myRole` as they are.
WHILE fewer than ten picks are entered, activating it SHALL first open a
confirmation dialog offering `Reset` and `Cancel`, where `Enter` confirms and
`Esc` cancels. WHEN all ten picks are entered, it SHALL reset without
confirmation.

#### Scenario: Incomplete draft asks first

- **WHEN** `New` is activated with three team picks entered
- **THEN** the confirmation dialog SHALL be shown and the session SHALL be
  unchanged until `Reset` is chosen

#### Scenario: Cancel changes nothing

- **WHEN** the confirmation dialog is open and `Esc` is pressed or `Cancel` is
  activated
- **THEN** the dialog SHALL close and the session SHALL be unchanged

#### Scenario: Reset keeps side and role

- **WHEN** a reset is confirmed on a session with `side = "dire"` and
  `myRole = 2`
- **THEN** `bans`, `enemyPicks`, and every entry of `teamPicks` SHALL be empty,
  `side` SHALL still be `"dire"`, `myRole` SHALL still be `2`, and the board
  SHALL stay shown

#### Scenario: Complete draft resets immediately

- **IF** all five team picks and all five enemy picks are entered and `New` is
  activated
- **THEN** the draft SHALL be cleared with no dialog

### Requirement: One level of undo after a reset

WHEN a reset is applied, the client SHALL store the outgoing session under the
`localStorage` key `draft.backup` and SHALL offer an `Undo` control in the
header and in a `role="status"` toast reading `Draft reset · Undo` that appears
for five seconds. Activating `Undo` SHALL restore the stored session whole.
The backup SHALL be discarded by the first ban or pick entered after the reset,
and SHALL be replaced by the next reset. A change of side or role SHALL NOT
discard it — a reset keeps the setup, so editing it does not start a new draft.

#### Scenario: Undo restores the draft

- **WHEN** a session with four bans and two picks is reset and `Undo` is
  activated
- **THEN** the session SHALL be deeply equal to the one before the reset apart
  from nothing, and the backup SHALL be gone

#### Scenario: Undo survives a reload inside the window

- **WHEN** the page is reloaded after a reset and before any new draft action
- **THEN** the header `Undo` SHALL still be offered and SHALL still restore the
  previous session

#### Scenario: Entering a hero ends the undo window

- **WHEN** a hero is banned or picked after a reset
- **THEN** the `Undo` control SHALL be gone and `draft.backup` SHALL be cleared

#### Scenario: Editing the setup keeps the undo window

- **WHEN** the side or the role is changed after a reset and before any hero is
  entered
- **THEN** the `Undo` control SHALL still be offered

#### Scenario: Unreadable backup

- **IF** the value under `draft.backup` is not valid JSON or is not a `v: 1`
  session
- **THEN** it SHALL be discarded, no `Undo` SHALL be offered, and the app SHALL
  NOT throw

#### Scenario: Toast does not steal focus

- **WHEN** the toast appears
- **THEN** focus SHALL stay where it was, and the toast SHALL disappear after
  five seconds while the header `Undo` remains

### Requirement: Keystrokes route to the topmost context

The client SHALL route an unmodified keystroke to exactly one context, in the
order dialog → picker → header editor → board. WHILE either the confirmation
dialog or the picker is open, no keystroke SHALL reach the header-editor or
board hotkeys.

#### Scenario: Board hotkeys are dead while the picker is open

- **IF** the picker is open and `B` is pressed
- **THEN** no second picker SHALL open, the session SHALL be unchanged, and the
  character SHALL go to the search field

#### Scenario: Editor hotkeys are dead while a dialog is open

- **IF** the confirmation dialog is open and `3` is pressed
- **THEN** `session.myRole` SHALL be unchanged
