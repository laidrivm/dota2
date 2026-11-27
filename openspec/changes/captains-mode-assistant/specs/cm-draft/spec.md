# cm-draft delta — captains-mode-assistant

## Purpose

The Captains Mode page at `/cm`: signing in, the setup and rosters a captain
enters, the fixed order of bans and picks the draft follows, and how the
draft is entered, undone and kept across reloads.

## ADDED Requirements

### Requirement: The page asks for the password before the draft

WHEN `/cm` loads and `GET /api/cm/session` answers 401, the page SHALL show
only a password form. A successful sign-in SHALL show the setup or the
board without reloading the page. A 503 SHALL show that the CM page is not
configured, and a wrong password or a 429 SHALL be reported beside the form
from the response's `code`.

#### Scenario: Signing in from the page

- **WHEN** `/cm` is opened with no session, fewer than nine wrong passwords
  in the sign-in window, and a wrong password is entered
- **THEN** the form SHALL stay, announce the error through `role="alert"`,
  and keep focus in the password field
- **AND WHEN** the right password is then entered, the form SHALL be
  replaced by the setup with `location.pathname` still `/cm` and no full
  page load

### Requirement: Setup takes the side and the pick order

The board SHALL appear only once both the side (`radiant` or `dire`) and
the pick order (`first` or `second`) are set. They SHALL be two independent
choices, and either SHALL remain editable on the board while no step has
been entered.

#### Scenario: Setup collapses into the board

- **WHEN** the captain sets the side to `dire` and the pick order to `first`
- **THEN** the board SHALL appear with step 1 marked as the captain's ban

### Requirement: Rosters describe both teams

Each team SHALL have five players, each with a nickname of 1 to 24
characters, a position 1–5 or unknown, a rank tier from 1 (Herald) to 8
(Immortal) or unknown, and up to 10 signature heroes. Each team's known
positions SHALL be distinct at all times. The captain's roster SHALL count as
complete once it holds each position exactly once, and the board SHALL say
when it is not.

#### Scenario: Editing the captain's roster

- **WHEN** the captain sets position 3 on a second player of their own team
- **THEN** the first player's position SHALL become unknown, and the board
  SHALL report the team's positions as incomplete until each is held once
- **AND WHEN** a player already has ten signature heroes, the control adding
  another SHALL be disabled and name the limit

### Requirement: The draft follows the Captains Mode order

The draft SHALL be the 24 steps below, A being the team that picks first. The
page SHALL mark the step in progress — its team and whether it bans or picks
— and a hero entered SHALL fill that step only. After step 24 the draft
SHALL be complete and accept no hero.

| Steps | Order |
| --- | --- |
| 1–7 | ban A, A, B, B, A, B, B |
| 8–9 | pick A, B |
| 10–12 | ban A, A, B |
| 13–18 | pick B, A, A, B, B, A |
| 19–22 | ban A, B, A, B |
| 23–24 | pick A, B |

#### Scenario: The order from the second pick

- **WHEN** the pick order is `second` and steps 1 and 2 have been entered
- **THEN** step 3 SHALL be marked as the captain's ban, and steps 1, 2, 5 as
  the enemy's
- **AND WHEN** step 24 has been entered, each team SHALL hold five picks and
  seven bans, and no control entering a hero SHALL be enabled

### Requirement: A hero is taken at most once

A hero banned or picked at any step SHALL NOT be enterable at a later step,
and the picker SHALL show it as taken.

#### Scenario: A banned hero offered again

- **WHEN** Pudge was banned at step 2 and the picker opens at step 8
- **THEN** Pudge SHALL be shown as taken and choosing it SHALL change nothing

### Requirement: The last step can be undone

The page SHALL undo the most recent entered step, repeatedly back to step 1,
leaving the setup and rosters as they are.

#### Scenario: Undoing a pick

- **WHEN** step 9 holds Lion and the captain undoes
- **THEN** step 9 SHALL be the step in progress again and Lion SHALL be
  enterable

### Requirement: The draft survives a reload

The setup, both rosters and the entered steps SHALL persist in the browser
under a key of their own, apart from the All Pick session, and be restored
on reload. Resetting the draft SHALL clear the steps and keep the setup and
rosters.

#### Scenario: Reloading mid-draft

- **WHEN** steps 1–11 are entered and the page is reloaded
- **THEN** the same eleven steps, setup and rosters SHALL be shown with step
  12 in progress, and the All Pick page's session SHALL be unchanged

#### Scenario: Resetting the draft

- **WHEN** the captain resets the draft
- **THEN** no step SHALL be entered, step 1 SHALL be in progress, and both
  rosters, the side and the pick order SHALL be as before
