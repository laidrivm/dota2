# Hero picker — design

## Context

`draft-board` left the board complete except for how heroes get into it: a
native `<select>` per empty slot, listing only free heroes, chosen explicitly
as a stand-in. Everything the picker needs is already in place — `applyAction`
is the single write path, `HeroEntry.aliases` is populated in the snapshot, and
`hotkeyContext` already refuses side/role keys on the board so `1`–`5` are free
here.

Sources: `spec-inbox/screens-spec.md` §3 (overlay), §4 (reset/undo), §5 (the
hotkey routing table), §6.4 (snapshot swap); the design project's
`guidelines/component-picker.html` (640px modal, 8-column grid, 40px tiles with
the hero name under each, taken heroes at `opacity: .35` labelled `ban` /
`team` / `enemy` in the accent colour, first match ringed with `0 0 0 2px
var(--accent)` on a `--bg-3` cell, and a mono hint bar along the bottom) and
`guidelines/component-dialogs.html` (the 320px `Reset draft?` confirm and the
`Draft reset · Undo` toast).

This is proposal 3 of the three-part Phase 2 sequence set out in
`ui-foundation/design.md`. It adds no endpoint, so the api-design response-shape
rule does not apply.

## Goals / Non-Goals

**Goals:**
- Entering a hero costs a keystroke and three letters, from anywhere on the
  board.
- One target type describes every position the picker can fill, so opening it
  from a click and from a hotkey is the same call.
- Keyboard parity with the pointer, and the platform's modal semantics rather
  than a hand-built one.
- Reset that cannot destroy a draft silently, and one undo that actually
  restores it.

**Non-Goals:**
- Fuzzy matching, ranking, recents, favourites.
- Hero portraits — the grid uses the existing tile.
- Any change to `computeModel`, `Session`, or the snapshot contract.

## Decisions

**Both overlays are native `<dialog>` opened with `showModal()`.** The platform
supplies the focus trap, the inert background, the backdrop, `Esc` (as a
`cancel` event), and focus restoration to the element that opened it — every
one of which is a hand-written bug otherwise. The picker's search input carries
`autofocus`, which `showModal()` honours, and which raises the keyboard on
mobile because the dialog always opens from a tap or a keystroke. Rejected: a
positioned `div` with `role="dialog"` and manual focus management, which is the
ARIA-patched-div pattern the accessibility rules exclude.

**Light dismiss is the picker's only extra handler, and the confirm dialog has
none.** A modal `<dialog>` does not close on a backdrop click by itself; the
backdrop is the dialog element's own box, so a `click` whose `target` is the
dialog element itself — never a child — closes the picker, and nothing else
does. The
`closedby="any"` attribute would replace the handler but is too young to rely
on here. The confirmation dialog deliberately keeps no light dismiss: a stray
click next to a destructive `Reset` must not answer it.

**One `PickTarget` for every position.** `{ kind: "ban" } | { kind: "team";
role: Role } | { kind: "enemy" }` is what opens the picker, names it in the
title (`Pick for: Offlane (my team)`), and decides which existing action a
choice dispatches — `banAdd`, `teamSet`, `enemyAdd`. Held in `App` as
`useState<PickTarget | null>`, never written to the session: the picker is
ephemeral, so a reload with it open restores the board (screens-spec §3).

**Matching is one pure function over words.** `matchHeroes(heroes, query)`
trims and lowercases the query and keeps a hero when any word of its name or
any of its `aliases` starts with it — `bone` reaches Clinkz through `bone
fletcher`, `wk` through the alias itself, `ni` reaches Night Stalker and
Nature's Prophet. A query that is empty after trimming keeps everything. Order
stays alphabetical, so the first *selectable* match — the first the grid does
not disable — is positional and needs no scoring. Rejected: substring matching (`ar` would hit
half the pool), and Levenshtein/fuzzy ranking (a scoring function to tune, for
a 126-item list the user can see).

**The grid shows every hero, taken ones disabled.** `isUsed` becomes `usedAs
(session, hero): "ban" | "team" | "enemy" | null`, with `isUsed` its `!== null`
wrapper, so the same lookup answers both the reducer's guard and the grid's
label. US-14 wants "where it is taken" visible; filtering them out — what the
`<select>` did — answers the question by hiding it.

**Board hotkeys are a second pure function, not a wider action union.**
`hotkeyFor(event, context)` keeps returning side/role actions for Setup and the
editor; `pickerHotkey(event, session, banLimit): PickTarget | null` covers the
board — `B` → ban (null at the ban limit), `E` → enemy (null at five picks),
`1`–`5`/`C M O S F` → that role of my team, filled or not, since `teamSet`
already replaces. Two small functions with obvious tests beat one union that
mixes a session mutation with a UI intent, and `useSession` picks between them
on the context it already tracks.

**`hotkeyContext` gains one value, `"modal"`, above the rest.** WHILE either
dialog is open the document listener produces nothing: a modal `<dialog>` still
bubbles keystrokes to the document, and screens-spec §5 routes every keystroke
to the topmost context. The picker's own keys are handled inside the dialog,
which is where `ownsKeystroke` already lets the search field type.

**Typing anywhere in the picker goes to the search field.** Arrow keys move
focus into the grid; a printable key pressed there focuses the input and
appends the character (the keystroke that moved focus cannot land in it by
itself). Three lines, and it is what §5's "all input goes to the search field"
means in practice.

**Arrow navigation reads its column count from the grid.**
`getComputedStyle(grid).gridTemplateColumns.split(" ").length` — left/right
move by one, up/down by that count — so the same handler is correct at eight
columns on the desktop and at four on the phone, with no breakpoint constant
duplicated in TypeScript. Every tile stays a real tabbable `button`; a roving
tabindex would buy a shorter Tab sequence at the cost of state this does not
otherwise need.

**Reset keeps side and role.** `{ kind: "reset" }` returns `EMPTY_SESSION()`
carrying `side` and `myRole` over — what the dialog itself promises ("Bans and
all picks will be cleared. Side and role stay."), and what the next game
actually needs. Confirmation is required WHILE fewer than ten picks are
entered; a complete draft resets straight away (screens-spec §4).

**Undo is the previous session under `draft.backup`.** The key `types.ts`
already documents. `reset` writes the outgoing session there, `undo` restores it
whole, and the backup is dropped by the first action that puts a hero on the
board again — `banAdd`, `teamSet`, or `enemyAdd`, whichever comes first. Side
and role changes do not drop it: they are the setup a reset deliberately keeps,
so editing them is not "input on the new session" (US-24). It is persisted rather than kept in memory so a
reload inside the toast window does not strand the draft.

**The toast is a `role="status"` strip on a five-second timer; the header
`Undo` lives as long as the backup does.** They are two conditions, not one:
the header reads `backup !== null`, the toast a `toastVisible` flag the reset
raises and the timer lowers. Collapsing them into one flag would either kill
the header control after five seconds or leave the toast up for the whole undo
window. Both are cleared by an undo and re-raised by a second reset, so the
toast can never outlive the backup it offers.

**A hero the snapshot no longer knows marks its slot.** At load, any id in the
session missing from `bundle.heroes` renders the fallback tile with a `re-pick`
marker and its removal control, rather than being dropped — the user decides
what replaces it (screens-spec §6.4). Recomputing "silently at the next action"
needs no code: the model is recomputed on every change already.

**Focus after a pick goes where the trigger went.** Closing the dialog restores
focus to the trigger, which no longer exists once the slot is filled, so the
restore is redirected to the removal control of the slot just filled, in a
macrotask — the framework has not committed before that, and `rAF` never fires
in a hidden tab. This is the same rule `RemoveButton` already follows.

## Risks / Trade-offs

- **Every keystroke re-renders the whole grid** → 126 buttons of static markup,
  well inside a frame; if a profile ever objects, the filtered list gets a
  `useMemo` behind the same call. Marked with a `ponytail:` comment at the
  call site rather than pre-optimised.
- **`<dialog>` focus restoration fights the redirect** → the redirect runs in
  the macrotask after `close()`, so it lands last; the test for it is an e2e
  scenario, listed in `tasks.md`.
- **Two surfaces for one undo** (toast and header button) → both are specified;
  the toast's timer only hides the toast, and neither surface can offer an undo
  the backup no longer holds.
- **The backup outlives the tab** → one extra `localStorage` key holding one
  session; it is replaced by the next reset and cleared by the first hero
  entered after one.
- **Column count via `getComputedStyle` on a key press** → one read per arrow
  key on an element already in layout.
- **No DOM-level test until Task 4** → the same boundary the two previous
  proposals set: every branch lives in a pure function (`matchHeroes`,
  `usedAs`, `pickerHotkey`, `hotkeyContext`, the reset/undo reducer cases), and
  the DOM scenarios are enumerated in `tasks.md` as **(e2e)**.

## Migration Plan

`Session` and its `v: 1` shape are unchanged, so a stored session from either
earlier proposal restores untouched. One new storage key, `draft.backup`, whose
absence simply means no undo is offered. Rollback is reverting
`board/board.tsx`, `session.ts`, `app.tsx`, `header.tsx` and the stylesheet,
and deleting `src/app/picker/`.

## Open Questions

- Whether `Ctrl+Z` should also undo a reset. Not in screens-spec §5, not
  implemented; the toast and the header button are the two paths.
