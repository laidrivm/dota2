# smoke-suite Specification

## Purpose

The browser-level verification layer: what it must prove about the running
app, the conditions it runs under — a real instance, parallel workers, no
retries — and the accessibility floor it enforces on every page state it
reaches. It exists so that agentic changes cannot silently break the paths a
user actually walks, which `bun test` cannot reach without a DOM.

## Requirements
### Requirement: The suite runs against a real running app

The smoke suite SHALL exercise the application through a browser against an
instance started by the test runner, never against a mock, a stub renderer,
or a DOM emulation. The runner SHALL start `bun run dev` itself and, outside
CI, reuse an instance already listening on that port.

#### Scenario: No instance is running

- **WHEN** `bunx playwright test` is invoked with nothing listening on the
  app's port
- **THEN** the runner SHALL start the app, wait for it to answer, run the
  suite, and stop the app when the run ends

#### Scenario: A dev server is already running locally

- **WHILE** `bun run dev` is running and `process.env.CI` is unset
- **WHEN** `bunx playwright test` is invoked
- **THEN** the runner SHALL reuse that instance rather than failing on the
  occupied port, and SHALL leave it running afterwards

### Requirement: Setup is completable by keyboard alone

The suite SHALL prove that a user who never touches a pointer can reach the
board: the side and role controls SHALL expose named radio groups to
assistive technology, SHALL be reachable and operable from the keyboard, and
SHALL carry a focus indicator that is visible while focused.

#### Scenario: Side and role are named groups

- **WHEN** the Setup screen is rendered
- **THEN** a radio group named `Side` and a radio group named `Role` SHALL
  each be locatable by role and accessible name, and every option within
  them SHALL be locatable by its own accessible name

#### Scenario: The keyboard reaches and operates the controls

- **WHEN** the side and role options are activated using keyboard input only
- **THEN** each activated option SHALL report itself as checked

#### Scenario: Keyboard focus is visible

- **WHEN** an option receives focus through keyboard interaction — never
  through a scripted `focus()` call, which does not match `:focus-visible`
- **THEN** the label enclosing the focused input SHALL differ in computed
  `outline-style` or `outline-width` from the label of an unfocused sibling
  option

#### Scenario: The document hotkeys drive Setup

- **WHILE** the Setup screen is shown and nothing is focused
- **WHEN** `R` and then `3` are pressed
- **THEN** the Radiant option and the Offlane option SHALL each report
  themselves as checked

### Requirement: Setup collapses and the session survives a reload

The suite SHALL prove that choosing a side and a role replaces the Setup
block with the board in a single update — with no confirm step — and that
reloading the page restores both choices.

#### Scenario: The board replaces Setup

- **WHEN** a side and a role have both been chosen
- **THEN** the Setup block SHALL no longer be present, the board SHALL be,
  and the header SHALL name the chosen side and role

#### Scenario: A reload restores the choices

- **WHEN** the page is reloaded after both choices are made
- **THEN** the board SHALL be rendered, the Setup controls SHALL be absent,
  and the header SHALL still name the same side and role

### Requirement: A cold-cache snapshot failure is recoverable in place

The suite SHALL prove that when the snapshot cannot be fetched and nothing
is cached, the app shows its error state, and that activating retry against
a now-reachable snapshot reaches the app without a page reload.

#### Scenario: The snapshot route is unreachable with no cache

- **WHILE** requests to the snapshot URL fail and `localStorage` holds no
  cached bundle
- **WHEN** the app is loaded
- **THEN** a live region SHALL be present and SHALL contain the error
  message, and a retry control SHALL be present

#### Scenario: Retry recovers without reloading

- **WHEN** the snapshot URL is made reachable again and the retry control is
  activated
- **THEN** the app SHALL reach the Setup screen, and no navigation SHALL
  have occurred — the document loaded at the start of the test SHALL still
  be the current one

### Requirement: Every reached page state passes an accessibility scan

The suite SHALL run an axe scan on every page state it reaches and SHALL
fail the test on any violation. A rule SHALL NOT be disabled or excluded
without a comment at the exclusion site recording the user decision that
allowed it.

#### Scenario: A violation fails the run

- **WHEN** an axe scan of a reached page state returns a non-empty
  violations array
- **THEN** the test SHALL fail, with the same weight as any other assertion
  failure

#### Scenario: A scan never runs against an unrendered page

- **WHILE** the snapshot has not resolved and the app renders nothing
- **THEN** no scan SHALL be taken — every scan SHALL follow an assertion
  that the state it targets is present, so that an empty document cannot
  pass one vacuously

### Requirement: The suite is parallel-safe and never retried

Tests SHALL share no mutable state: each SHALL run in its own browser
context and SHALL set up whatever it needs. CI SHALL run with at least two
workers, and no test SHALL be retried on failure.

#### Scenario: CI configuration

- **WHILE** `process.env.CI` is set
- **THEN** the runner SHALL use `workers: 2` or more, `retries: 0`, and
  SHALL fail the run if any test is marked `.only`

#### Scenario: Repeated runs are stable

- **WHEN** the suite is run with `--repeat-each=3`
- **THEN** every test SHALL pass in every repetition

### Requirement: The browser suite runs on pull requests and only there

A dedicated workflow SHALL run the smoke suite on `pull_request`. The suite
SHALL NOT be attached to the git hooks or to any other workflow. Its HTML
report SHALL be uploaded as an artifact only when the run fails.

#### Scenario: A green run uploads nothing

- **WHEN** the e2e workflow completes with every test passing
- **THEN** no report artifact SHALL be uploaded

#### Scenario: The push path starts no browser

- **WHEN** a branch is pushed
- **THEN** the pre-push hook SHALL NOT start a browser

This scenario names only the browser. Which checks the hook does run is
`commit-gates`'s to say, and enumerating them here contradicts it: the diff
budget runs on the same path, required by `change-slicing`.

### Requirement: Unit coverage is reported on every pull request

A workflow SHALL run Bun's built-in coverage reporter on `pull_request` so
the number is visible in the run log. Coverage SHALL NOT gate the build.

#### Scenario: Coverage is visibility, not a gate

- **WHEN** the coverage workflow runs and the reported percentage is lower
  than the previous run's
- **THEN** the job SHALL still succeed, provided every test passed
