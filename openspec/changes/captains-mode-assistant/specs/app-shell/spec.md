# app-shell delta — captains-mode-assistant

## MODIFIED Requirements

### Requirement: Single screen, state derived from data

Each entry point of the application — the All Pick page at `/` and the
Captains Mode page at `/cm` — SHALL present exactly one screen whose visible
blocks are derived from its own session and data. Neither SHALL navigate,
change the URL path, or require a confirm/save step to move between states,
and neither SHALL link to the other.

#### Scenario: No navigation surface

- **WHEN** the app is loaded and the user completes any interaction it
  currently offers
- **THEN** `location.pathname` SHALL be unchanged and no full page load
  SHALL occur

#### Scenario: Screen composition follows the data

- **WHEN** the snapshot has resolved and the session has both `side` and
  `myRole` set
- **THEN** the header (product name, snapshot metadata, session-editor
  strip) SHALL be rendered and the centered Setup block SHALL NOT be

#### Scenario: The All Pick page never reaches the CM API

- **WHEN** `/` is loaded and every interaction it offers is completed
- **THEN** no request SHALL be made to a path under `/api/cm/`

### Requirement: Static production build

`bun build ./index.html ./cm.html --outdir=dist` SHALL produce a directory
of static files — HTML, hashed JS/CSS, fonts, and the snapshot JSON. The All
Pick page SHALL run from any static file host with no server-side code; the
Captains Mode page needs the server for `/api/cm/` and SHALL report itself
unavailable without it rather than fail silently.

#### Scenario: Build output is self-contained

- **WHEN** `dist/` is served by a plain static file server with no other
  process running
- **THEN** the app SHALL load, fetch its snapshot, and reach the Setup
  screen

#### Scenario: The CM page on a static host

- **WHEN** `dist/cm.html` is served by a plain static file server
- **THEN** the page SHALL show that the CM service is unavailable instead
  of the password form
