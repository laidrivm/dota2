# UI foundation — design

## Context

The repo has one product module (`src/model.ts`) and no browser surface at
all: no HTML entry, no runtime dependency, no CSS, no DOM types in
`tsconfig.json`. The screens are fully specified in
`spec-inbox/screens-spec.md` (§1–§6) and visually in the private Claude
Design project "+ Draft board screen design" (`tokens/`, `styles.css`,
`guidelines/*.html`, `Draft Board.dc.html`, `Mobile Board.dc.html`,
`uploads/design-brief.md`).

Phase 2 is three sequenced proposals, each independently applyable and
testable:

1. **`ui-foundation`** (this change) — entry point, bundling, tokens, fonts,
   snapshot delivery, session store, Setup screen + header strip.
2. **`draft-board`** — the board panels: bans row, my-team slots, enemy
   slots with inferred role probabilities, suggestion blocks, the
   full-draft result block, mobile one-column layout. First `computeModel`
   call.
3. **`hero-picker`** — the modal picker (search over names/aliases,
   grid, keyboard navigation), board hotkeys and their context routing,
   New/reset dialog and the undo toast, screens-spec §6 edge cases.

The api-design response-shape rule does not bite here: this change adds no
endpoint. The snapshot is a static file fetched over HTTP; its shape is the
already-fixed `SnapshotBundle` type.

## Goals / Non-Goals

**Goals:**
- A Preact app that builds and runs with Bun alone — no bundler dependency,
  no framework, and no server code beyond the static routes the bundler
  cannot cover.
- Design tokens imported verbatim, so a design change is a re-copy and not a
  re-interpretation.
- Snapshot obtained through a URL boundary that Phase 4 can take over
  untouched, with a last-good cache so the tool survives a dead network.
- Session state that round-trips a reload exactly, and survives a corrupt or
  unavailable `localStorage`.

**Non-Goals:**
- Board panels, picker, board hotkeys, dialogs (proposals 2 and 3).
- Any call into `computeModel` — nothing is pickable yet.
- E2E coverage (Task 4) and deployment (Task 7).

## Decisions

**Bun's native bundler, not Vite.** `bun build ./index.html --outdir=dist
--minify` is the production build, plus a copy step each for the fonts and
the snapshot. Vite/Rspack/Parcel were rejected at ladder rung 4: they add a
dependency and a config file to do what the runtime already does natively,
and this project's whole hardening posture argues against a build-tool
dependency tree.

**A server after all — `server.ts` under `--hot` for dev, and the thing Task
7 containerises.** The intended design was `bun ./index.html` alone, with no
server code. Two measured facts killed it: Bun's CSS bundler inlines every
`url()` asset as base64 with no threshold or loader override (four woff2
faces became a 108 KB render-blocking stylesheet), and its HTML dev server
answers every path with the HTML, so no static file can be served beside it.
`server.ts` therefore composes `staticRoutes()` — the font files and the
snapshot, each with its own content type and cache policy — with the bundled
homepage. The font faces live in `src/app/styles/fonts/fonts.css`, which
never enters the bundler; `index.html` pulls it in with an inline `<style>
@import`, the one construct Bun passes through untouched.

**Preact with `useState`, no state library.** One `useSession()` hook owns
the session value, its setters, and its persistence; the app is a handful of
components with props. `@preact/signals`, Zustand, and a context+reducer
layer are all rejected: a single session object re-rendering a ten-element
tree needs no machinery. JSX is configured in `tsconfig.json` with
`"jsx": "react-jsx"` and `"jsxImportSource": "preact"`; `lib` gains `DOM`
and `DOM.Iterable`.

**Snapshot at a fixed URL, not a bundler asset.** `src/app/snapshot.ts`
fetches the constant `/snapshot.json`; `server.ts` serves the fixture there
and the build copies it into `dist/`. Importing the JSON as a module was
rejected — it erases the network boundary, inlines ~50 KB into the bundle,
and makes the offline and error requirements untestable. Bun's file loader
(`with { type: "file" }`) was tried and rejected too: it emits a
content-hashed filename, so publishing a new snapshot would mean rebuilding
the client, which is the opposite of what the Phase 4 pipeline needs — and
the dev server does not serve the emitted asset at all. A plain constant is
also the smaller change for Phase 4: one string, no cast, no bundler.

**Last-good cache in `localStorage`, not a service worker.** One key holds
the last successfully fetched bundle. A service worker is the "correct"
offline answer and is rejected as premature: it is a second cache with its
own lifecycle and update bugs, for a single 50 KB document. Cache writes are
wrapped so a quota rejection degrades to in-memory operation instead of
breaking startup — the same wrapper the session store uses.

**Self-hosted IBM Plex, replacing the design system's Google Fonts
`@import`.** This is the one deliberate deviation from the imported token
files (accepted decision: offline operation). IBM Plex Mono has no variable
release — neither `@fontsource-variable/ibm-plex-mono` (does not exist) nor
IBM's own `@ibm/plex-mono` ships one — so the faces are static Latin1
`woff2` files, one per weight actually used: Sans 400/600 and Mono 400/600.
They come from IBM's own packages rather than a repackager, and sit under
`src/app/styles/fonts/` next to their OFL licence, declared with
`@font-face` + `font-display: swap`. A font package was rejected at ladder
rung 5: four `@font-face` rules are fewer moving parts than two
dependencies.

**Native radios styled as buttons for side and role.** Each group is a
`fieldset` + `legend` with `input[type=radio]` and a `label`, styled with
`appearance: none` to match the design's button chips. This gets the
selected state, the group semantics, arrow-key navigation, and label
association from the platform rather than from `aria-pressed` on divs.
Hotkeys are a single document-level `keydown` listener that ignores events
carrying Ctrl/Meta/Alt, so `Cmd+R` still reloads the page.

**Tests are on the pure modules; the DOM goes to Playwright.** `bun:test`
covers the storage wrapper, the session reducer/hotkey mapping, the snapshot
fetch-and-cache logic, and the header metadata formatter — all plain
functions with no DOM. Adding a DOM environment (`happy-dom` registrator)
was rejected: a dev dependency and a second test mode to assert on four
components. The DOM-level spec scenarios (banner present/absent, Setup
collapsing into the strip, restore after reload) are listed in `tasks.md` as
the e2e set that Task 4's Playwright smoke suite picks up first.

## Risks / Trade-offs

- **The app ships with no DOM-level test until Task 4** → the pure-module
  boundary is drawn deliberately wide (formatting, persistence, hotkey
  mapping, fetch/cache are all testable functions), leaving components as
  markup with no branching logic; the e2e set is enumerated in tasks so
  Task 4 has a written target rather than a blank page.
- **The font arrangement rests on undocumented bundler behaviour** → Bun
  leaving an inline `<style>` untouched is observed, not promised, so a Bun
  upgrade could start rewriting it and silently inline the faces again;
  `build.test.ts` asserts the `@import` survives and that no `data:font`
  appears in the built CSS, so the regression fails the suite rather than
  the page.
- **`server.ts` is now on the deployment path** → Task 7 containerises a
  process instead of shipping a directory. `bun run build` still emits a
  fully static `dist/` (fonts and snapshot copied in), so a static host
  remains a working fallback.
- **Committed binary font files in a public repo** → four `woff2` files under
  OFL 1.1 with the licence committed beside them; the alternative (a CDN)
  breaks the no-third-party-requests requirement.
- **Design tokens are copied, not linked** → they drift if the design
  project changes. Mitigated by copying the files verbatim (a re-copy is a
  clean diff) and by the "no literal values outside the token files"
  requirement, which makes drift visible.
- **`localStorage` writes on every keystroke-driven change** → the session
  is a few hundred bytes and changes at human speed; no debounce, and none
  until a profile says otherwise.

## Migration Plan

Purely additive. `src/types.ts`, `src/model.ts`, and their tests are
untouched; `src/fixtures/snapshot.json` gains a second consumer (the app)
beside the existing one (the model tests). Rollback is deleting the new
files and reverting the four config edits.

## Open Questions

- The design project has no logo asset (its readme flags it as absent); the
  header renders the product name in plain type until one exists.
- Hero tile colours (`--hero-*`) and the tile component arrive with proposal
  2; this change imports the tokens but uses none of them.
