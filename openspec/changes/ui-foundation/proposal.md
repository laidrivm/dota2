# UI foundation — proposal

## Why

`computeModel` exists but nothing renders it: the repo has no browser
entry point, no runtime dependency, no styling, and no way to hold a draft
session. Phase 2 is too large for one reviewable cycle, so it is split into
three sequenced proposals; this is the first — the shell every later screen
is mounted into, plus the two things that must be right before any board
pixel is drawn: where the snapshot comes from, and where the session lives.

## What Changes

- Add a browser entry point built by Bun's native bundler: `index.html` +
  a Preact app under `src/app/`. `bun build ./index.html --outdir=dist` for
  production; `bun run dev` runs `server.ts`, which composes the bundled
  entry point with routes for the files the bundler cannot serve (see
  design.md). No Vite, no build framework.
- Add `preact` as the first runtime dependency; JSX via tsconfig
  `jsxImportSource`.
- Import the design system's `tokens/{colors,typography,spacing}.css` and
  `styles.css` into `src/app/styles/` verbatim, with one deliberate
  deviation: the Google Fonts `@import` is replaced by self-hosted IBM Plex
  Sans/Mono `@font-face` rules (accepted decision — offline operation).
- Add snapshot delivery: fetch the bundle at startup, keep the last good
  one in `localStorage`, and surface patch id / snapshot date / the
  stabilizing banner in the header. Until Phase 4 ships a pipeline, the
  served bundle is `src/fixtures/snapshot.json` copied to the build output —
  the client sees a URL, not an import, so Phase 4 swaps the producer only.
- Add the draft session store: `Session` state per `src/types.ts`, side and
  role selection with their desktop hotkeys, persistence to
  `localStorage["draft.session"]`, and restore on reload.
- Add the Setup screen (screens-spec §1) and the inline session-editor strip
  it collapses into once side and role are both chosen.

## Capabilities

### New Capabilities

- `app-shell`: the single-page browser application — one screen whose state
  is derived from data, styled only from design tokens, and operating with
  no third-party network requests at runtime.
- `snapshot-delivery`: how the client obtains a `SnapshotBundle`, what it
  does when the network fails, how a snapshot swap mid-session is handled,
  and what snapshot metadata the header shows.
- `draft-session`: the client-side draft state — side and role selection
  (pointer and hotkey), persistence across reloads, and the screen state
  derived from whether the session is set up.

### Modified Capabilities
<!-- none: draft-model is consumed unchanged -->

## Non-goals

- **No board panels**: bans, team slots, enemy slots, suggestions, and the
  win-probability block are the second proposal. This change renders the
  header and the setup/session-editor strip only.
- **No hero picker, no board hotkeys, no New/undo** — the third proposal.
- **No `computeModel` call yet**: nothing can be picked, so there is nothing
  to compute. The model module is untouched.
- **No pipeline**: the snapshot is the in-repo fixture, served at a fixed
  URL by `server.ts` (which also serves the font files, because Bun's
  bundler cannot — see design.md) and copied into `dist/` by the build.
  Phase 4 owns the producer; Task 7 owns the host.
- **No e2e tests**: the Playwright smoke suite is Task 4, unblocked by this
  change but not part of it.
- **No mobile board layout** beyond what the setup strip needs — the mobile
  board is specified with the board itself.

## Impact

- First runtime dependency (`preact`) → `/warm` gate before this change is
  reviewable.
- New files: `index.html`, `src/app/**`, `src/app/styles/**`, self-hosted
  font files, and the snapshot copied into the build output.
- Changed files: `package.json` (dev/build scripts), `tsconfig.json` (JSX
  keys, DOM lib), `biome.json` (the app's CSS/JSX now exist), `.gitignore`
  (`dist/`).
- Unblocks Task 4 (a UI exists to smoke-test) and Task 7 (there is something
  to containerise), and the two remaining Phase 2 proposals.
