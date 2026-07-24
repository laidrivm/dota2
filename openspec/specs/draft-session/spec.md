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
with no modifier key held. Selecting the already-selected side SHALL leave
it selected.

#### Scenario: Hotkey without focus

- **WHEN** no element has focus and `R` is pressed
- **THEN** `session.side` SHALL equal `"radiant"` and the Radiant control
  SHALL be marked selected

#### Scenario: Case does not matter

- **WHEN** `d` is pressed
- **THEN** `session.side` SHALL equal `"dire"`

#### Scenario: Modified keystrokes are ignored

- **IF** `R` is pressed while Ctrl, Meta, or Alt is held
- **THEN** `session.side` SHALL be unchanged and the browser's own shortcut
  SHALL NOT be prevented

#### Scenario: Re-selecting the current side

- **WHEN** `session.side` is `"radiant"` and `R` is pressed again
- **THEN** `session.side` SHALL still equal `"radiant"`

### Requirement: Role selection

The user SHALL be able to set `session.myRole` by activating the
corresponding control, or by pressing the digit `1`–`5`, or the letter for
that role: `C` → 1, `M` → 2, `O` → 3, `S` → 4, `F` → 5. Modifier-held
keystrokes SHALL be ignored as for side selection.

#### Scenario: Digit hotkey

- **WHEN** `3` is pressed with no modifier
- **THEN** `session.myRole` SHALL equal `3`

#### Scenario: Letter hotkey

- **WHEN** `f` is pressed with no modifier
- **THEN** `session.myRole` SHALL equal `5`

#### Scenario: Unmapped key

- **WHEN** `6` or `X` is pressed
- **THEN** the session SHALL be unchanged

### Requirement: Setup collapses into the session-editor strip

WHILE either `session.side` or `session.myRole` is `null`, the app SHALL
show the centered Setup block. WHEN both become non-null, the app SHALL
replace it with the inline session-editor strip in the header, with no
confirm step.

#### Scenario: Second choice expands the board shell

- **WHEN** `session.side` is already set and a role is then chosen
- **THEN** the centered Setup block SHALL be removed and the header strip
  showing the chosen side and role SHALL be rendered in the same update

#### Scenario: Side and role stay editable

- **WHEN** both are set and the user activates the side control in the
  header strip and chooses the other side
- **THEN** `session.side` SHALL be the newly chosen value and every other
  field of the session SHALL be unchanged

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
