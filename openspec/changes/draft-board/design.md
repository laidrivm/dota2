# Draft board — design

## Context

`ui-foundation` left the app at: snapshot resolved, `Session` held and
persisted, side and role chosen, header rendered. `src/model.ts` has been
callable since Phase 1 and has never been called. The board is specified in
`spec-inbox/screens-spec.md` §2, §5, §6 and drawn in the design project's
`Draft Board.dc.html` (desktop, 1220px content) and `Mobile Board.dc.html`
(390×844 preview, 480px content), with the hero tile pinned down in
`guidelines/component-hero-tile.html`.

This is proposal 2 of the three-part Phase 2 sequence recorded in
`ui-foundation/design.md`; proposal 3 (`hero-picker`) follows and is unchanged
by this design.

The api-design response-shape rule does not bite: this change adds no
endpoint. Every value on screen is a pure function of the already-fetched
snapshot and the in-memory session.

## Goals / Non-Goals

**Goals:**
- Every board panel of screens-spec §2 rendered from `(snapshot, session)`
  with no state of its own.
- One pure reducer for every draft mutation, so the picker in 2c adds a
  trigger and not a second write path.
- Hero tiles that take their colour from the token palette without restating
  it in TypeScript.
- A usable, testable board before the picker exists.
- One column at 390px without a horizontal page scroll.

**Non-Goals:**
- The picker overlay, board hotkeys, reset dialog, undo toast (2c).
- Any change to `computeModel` or to the snapshot contract.
- Animation, drag-and-drop, hero icons.

## Decisions

**One reducer for every session mutation.** `applyHotkey` grows into
`applyAction(session, action): Session` over a discriminated union — `side`,
`role`, `banAdd`, `banRemove`, `teamSet`, `teamClear`, `enemyAdd`,
`enemyRemove` — and `useSession` keeps its single write-through `persist`
call. Rejected: per-panel setters on the hook (eight closures to keep in sync
with eight persistence sites) and an action-creator layer over the union
(ceremony for an object literal). The picker in 2c dispatches the same
actions, so its diff is a trigger and a context, not new state.

**`computeModel` in a `useMemo` keyed on the session and snapshot
identities.** The session is replaced wholesale on every change, so identity
comparison is exact and free. No worker, no debounce, no incremental
recompute: screens-spec §2.6 requires the result inside one frame and the
fixture computes in well under it. The upgrade path if a 126-hero snapshot
with full matrices misses the budget is a worker behind the same memo, and it
is marked with a `ponytail:` comment at the call site rather than built now.

**Hero tile colour from the token, ink derived from its luminance.** The tile
sets `background: var(--hero-<short>, var(--hero-fallback))` inline — the only
place a dynamic token name is needed — and its ink is chosen by relative
luminance: below `0.22` the tile takes `--tile-ink-light`, at or above it
`--tile-ink-dark`. Rejected alternatives:
- Restating the palette (hex + light/dark flag) in TypeScript: 51 rows today,
  126 later, drifting from `tokens/colors.css` the moment the design changes.
- CSS `contrast-color()`: Baseline only since April 2026, and it returns pure
  black or white by WCAG ratio — on the palette's mid-tone blues
  (`--hero-storm-spirit: #2e7fd0`) it picks black, which is both harder to
  read at 8–11px and the opposite of the design's own choice.
  The threshold reproduces the design's decision for 50 of its 51 heroes. The
  one divergence is Wraith King (`#2fbf7f`, luminance 0.394): the mock gives
  it light ink, the threshold gives it dark, which measures as the higher
  contrast of the two. The derived value wins and the divergence is recorded
  here rather than special-cased in code.

**Three token additions, pushed back to the design project.**
`tokens/colors.css` gains `--tile-ink-dark: #1b1d12` and
`--tile-ink-light: #f4f3fb` (both already literal in
`guidelines/component-hero-tile.html`) and `--hero-fallback: #3a4250` (the
value the mocks use for a hero with no palette entry — three of the 33
fixture heroes, and every hero the palette has not caught up with). The
app-shell requirement "literal values appear only in the token files" is what
forces them to be tokens. Keeping `src/app/styles/` a verbatim copy is the
standing decision, so the same three lines go back to the design project's
`tokens/colors.css` in the same change.

**The palette hex is read from the document, not imported.**
`getComputedStyle(document.documentElement).getPropertyValue("--hero-" +
short)` resolves each hero's colour once per snapshot, memoized by slug, and
the pure `tileInk(hex)` decides the ink. That keeps `tokens/colors.css` the
single source of the palette. `relativeLuminance` and `tileInk` are plain
functions with unit tests; the lookup is a five-line wrapper around them.

**Formatting is a set of pure functions, one per readout.** `heroAbbr(name)`
(letters only, first four, uppercased — the mock's rule), `formatScore(pp)`
(`+2.1%` / `-0.4%`, one decimal, always signed), `formatAdvantage(pp)`
(`+3.2 pp`), `formatWinProbability(p)` (`~58% win`, nearest whole percent),
`formatPhase(phase)` (`p1 → 1st`, `p2 → 2nd`, `last → last`) and
`topRoles(inference)` (the two highest role probabilities as `p1 62% · p2
31%`, dropping any term that rounds to `0%`, ties broken by ascending role).
These carry every branch worth testing, which is why the components below
have none.

**Panels are markup over the model output.** `board/` holds one component per
panel — bans row, team panel, enemy panel, suggestions, result — each taking
its slice of `(session, model, heroesById)` and the dispatch function. No
component holds state except the header's editor-open flag. Which panel comes
first is `order` on the two-column grid, driven by side, so Radiant reads
my-team-left and Dire reads my-team-right exactly as the game client does.

**Score colour follows the sign.** `--score-pos` for a positive score,
`--text-4` for zero or negative, so a board where every suggestion is bad does
not read as a board full of good ones. The design only drew the positive case.

**One column below 720px, with two horizontal scrollers.** A single
`@media (max-width: 720px)` block stacks the two team panels, moves the enemy
role probabilities under the hero name, and turns the bans row and each
suggestion row into `overflow-x: auto` strips (screens-spec §2.8 keeps N
unreduced). Per the accessibility rules those strips get `::scroll-button`s, so
they are operable without a pointer or a trackpad gesture. Verified at 390px:
no page-level horizontal scroll.

**Removal controls stay in the DOM and appear on focus as well as hover.** The
mock fades each `✕` in on row hover; hiding it from keyboard users is not an
option, so the reveal is `:hover, :focus-within` on the row, and on the
one-column layout the `✕` is the always-visible corner badge the mobile mock
draws. Each is a real `button` with an accessible name naming its hero.

**The pick-entry control is a native `<select>` until 2c.** Every empty slot
and the bans row render a labelled `<select>` listing the heroes not already
banned or picked, sorted by name, which dispatches the same
`applyAction` the picker will. Chosen over disabled placeholder buttons
because it makes the whole board — enemy inference, the result block, the
recompute loop — exercisable and e2e-able in this cycle, and over building the
picker early because that overlay is a reviewable cycle of its own. It is
~15 lines of markup with keyboard behaviour, labelling and mobile pickers
supplied by the platform, and 2c deletes it in the same commit that lands the
overlay.

**Side and role hotkeys become context-scoped.** They fire only while the
Setup block is up or the header editor is open, which is screens-spec §5's
routing rule and a prerequisite for 2c reusing `1`–`5` on the board. Without
this, typing `3` on a finished board would silently move the user's role.

## Risks / Trade-offs

- **The `<select>` is throwaway code in a shipped state** → it is deleted by
  the next proposal in this sequence, and it is the only entry path that
  exists in between; the alternative ships a board with dead controls.
- **The ink threshold is a tuned constant** → it is the design's own
  judgement, reproduced. A contrast floor cannot police it: with two fixed
  inks the worst case is fixed at the threshold itself (≈3.5:1), so any such
  test passes by construction and guards nothing. What the suite does guard is
  the input — every `--hero-*` and `--tile-ink-*` token in
  `tokens/colors.css` must parse to a luminance, so a malformed or renamed
  entry fails the suite instead of silently lettering a tile in the wrong ink.
  The palette maxes out at 3.76:1 for its darkest mid-tones whichever ink is
  chosen; moving the threshold to the contrast-optimal 0.192 would buy 0.22
  of ratio and diverge from the design on five more heroes, so it was not
  taken.
- **`getComputedStyle` runs on the render path** → once per hero per snapshot
  behind a `Map`; if a profile ever objects, the map is built eagerly when the
  snapshot resolves.
- **No DOM-level test until Task 4** → same boundary as `ui-foundation`: every
  branch lives in a pure function, and the DOM scenarios are enumerated in
  `tasks.md` as **(e2e)**.
- **`New` renders inert** → it is in the header because the header is being
  rebuilt now and moving it later would touch the same markup twice; it
  carries no handler and is disabled, so it cannot mislead a user into
  thinking a reset happened.
- **Three token files diverge from the design project until the push lands**
  → the push is a task in this change, not a follow-up.

## Migration Plan

Additive apart from four edits: `session.ts` (hotkey mapping folds into the
action union, hotkeys gain a context argument), `session-controls.tsx` (same
controls, now also rendered inside the header editor), `header.tsx` (collapsed
side · role display, `edit` toggle, `New`), and `app.tsx` (board composition).
A stored `v: 1` session from `ui-foundation` restores unchanged — the fields
this change starts writing are the ones `EMPTY_SESSION()` already has.
Rollback is reverting those four files plus the two stylesheets
(`styles/app.css`, `styles/tokens/colors.css`) and deleting `src/app/board/`.

## Open Questions

- Whether the `insufficient data` badge belongs on enemy slots too. The
  design draws it on team slots and suggestion chips only; US-33 says "on a
  hero without sufficient statistics". Rendered on team slots and chips for
  now, which is what the mocks show.
