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
  no framework, no dev-server code.
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

**Bun's native bundler, not Vite.** `bun ./index.html` is the dev server
(bundles the referenced TS/JSX/CSS, hot reload); `bun build ./index.html
--outdir=dist --minify` is the production build. Vite/Rspack/Parcel were
rejected at ladder rung 4: they add a dependency and a config file to do
what the runtime already does natively, and this project's whole hardening
posture argues against a build-tool dependency tree.

**Preact with `useState`, no state library.** One `useSession()` hook owns
the session value, its setters, and its persistence; the app is a handful of
components with props. `@preact/signals`, Zustand, and a context+reducer
layer are all rejected: a single session object re-rendering a ten-element
tree needs no machinery. JSX is configured in `tsconfig.json` with
`"jsx": "react-jsx"` and `"jsxImportSource": "preact"`; `lib` gains `DOM`
and `DOM.Iterable`.

**Snapshot as a bundled file URL, not an import.** `src/app/snapshot.ts`
does `import snapshotUrl from "../fixtures/snapshot.json" with { type:
"file" }` — Bun's file loader copies the JSON into the output and resolves
the import to its URL — then `fetch(snapshotUrl)`. This keeps the client on
a network boundary (so Phase 4 replaces one constant with the pipeline's
URL) while costing zero server code and zero copy step in the build.
Alternatives rejected: importing the JSON as a module (erases the boundary,
inlines ~50 KB into the bundle, and makes the offline/error requirements
untestable); a `Bun.serve` dev server with a `/snapshot.json` route (real
code to maintain, and a second serving path that production would not use).

**Last-good cache in `localStorage`, not a service worker.** One key holds
the last successfully fetched bundle. A service worker is the "correct"
offline answer and is rejected as premature: it is a second cache with its
own lifecycle and update bugs, for a single 50 KB document. Cache writes are
wrapped so a quota rejection degrades to in-memory operation instead of
breaking startup — the same wrapper the session store uses.

**Self-hosted IBM Plex, replacing the design system's Google Fonts
`@import`.** This is the one deliberate deviation from the imported token
files (accepted decision: offline operation). The variable `woff2` files for
IBM Plex Sans and IBM Plex Mono are committed under
`src/app/styles/fonts/` next to their OFL licence, and `typography.css`
declares them with `@font-face` + `font-display: swap`. `url()` references
let the bundler hash and emit them. A font package (`@fontsource-variable/*`)
was rejected at ladder rung 5: two `@font-face` rules are fewer moving parts
than two dependencies.

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
- **Content-hashed snapshot URL means a new snapshot needs a rebuild** →
  acceptable while the fixture *is* the snapshot; Phase 4 changes
  `snapshot.ts` to a stable pipeline URL, which is exactly the boundary this
  design preserves.
- **Committed binary font files in a public repo** → two `woff2` files under
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
