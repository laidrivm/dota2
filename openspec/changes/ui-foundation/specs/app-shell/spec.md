## ADDED Requirements

### Requirement: Single screen, state derived from data

The application SHALL present exactly one screen whose visible blocks are
derived from the current session and snapshot. It SHALL NOT navigate, change
the URL path, or require a confirm/save step to move between states.

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

### Requirement: No third-party runtime requests

The running application SHALL issue network requests only to its own origin.
Fonts, styles, scripts, and data SHALL all be served from the deployed
bundle.

#### Scenario: Fonts are self-hosted

- **WHEN** the app's stylesheets are loaded
- **THEN** no `@import` or `url()` SHALL reference a host other than the
  app's own origin, and the IBM Plex Sans and IBM Plex Mono faces SHALL
  resolve to font files inside the build output

#### Scenario: Offline start on a warm cache

- **WHILE** the browser is offline and a previously fetched snapshot is
  present in `localStorage`
- **THEN** the app SHALL render the board shell with that snapshot rather
  than an error screen

### Requirement: Style values come from design tokens

Every colour, font, radius, spacing, row height, and tile size used by the
app SHALL be a `var(--token)` reference resolving to a custom property
declared in the imported token files. Literal values SHALL appear only in
those token files.

#### Scenario: No literal colours outside the token files

- **WHEN** the app's CSS outside `src/app/styles/tokens/` is inspected
- **THEN** it SHALL contain no hex colour, `rgb()`, or `rgba()` literal

### Requirement: Static production build

`bun build ./index.html --outdir=dist` SHALL produce a directory of static
files — HTML, hashed JS/CSS, fonts, and the snapshot JSON — that runs from
any static file host with no server-side code.

#### Scenario: Build output is self-contained

- **WHEN** `dist/` is served by a plain static file server with no other
  process running
- **THEN** the app SHALL load, fetch its snapshot, and reach the Setup
  screen
