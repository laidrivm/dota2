# Hero picker — proposal

## Why

`draft-board` shipped the board with a native `<select>` standing in for hero
entry: it lists every free hero by name, cannot be searched, and says nothing
about the heroes it hides. Entering a draft that way is slower than the draft
itself, which is the one thing this tool cannot be. This change replaces the
stand-in with the picker of screens-spec §3, gives the board the hotkeys that
open it, and closes the two lifecycle gaps `draft-board` left inert — reset and
undo. It is the last of the three sequenced Phase 2 proposals.

## What Changes

- Add the hero picker overlay (screens-spec §3): a modal over the board with
  the target slot named in its header, an autofocused search field filtering
  from the first character, and the full hero grid in alphabetical order.
- Match the query against word prefixes of the canonical name and of every
  entry of `aliases` (US-21): `bone` → Clinkz, `wk` → Wraith King.
- Show banned and picked heroes in the grid, dimmed, unselectable, and labelled
  with where they sit (US-14), instead of omitting them as the `<select>` does.
- Operate the picker fully from the keyboard: typing filters, `Enter` takes the
  first match, arrows move over the grid, `Esc` closes without choosing.
- **BREAKING (internal)**: delete the temporary `PickEntry` `<select>` and
  `availableHeroes`; every empty slot and the bans row becomes a button that
  opens the picker for that position.
- Add the board hotkeys of screens-spec §5: `B` opens the picker for a new ban,
  `E` for the first empty enemy slot, `1`–`5`/`C M O S F` for that role of my
  team, and route keystrokes to the topmost context — dialog, picker, header
  editor, board.
- Make `New` live (screens-spec §4): a confirmation dialog while the draft is
  incomplete, an immediate reset once all ten picks are in.
- Add one level of undo after a reset: a `Draft reset · Undo` toast for a few
  seconds and an `Undo` control in the header that stays until the new session
  is written to.
- Mark a slot whose hero is absent from a newly loaded snapshot as invalid and
  ask for a re-pick, recomputing silently otherwise (screens-spec §6.4).

## Capabilities

### New Capabilities

- `hero-picker`: the picker overlay — what opens it and for which target, how
  the search matches, what the grid shows for free and for used heroes, how it
  is driven from the keyboard, how a choice applies, and why it is never
  persisted.

### Modified Capabilities

- `draft-board`: pick entry becomes a picker trigger rather than a `<select>`;
  a slot holding a hero the snapshot no longer contains is marked invalid.
- `draft-session`: gains reset (with its confirmation rule) and one-level undo
  with its backup key; the hotkey routing table gains the board context and the
  picker/dialog contexts above it.

## Non-goals

- **No hero icons**: the grid uses the same coloured initial tiles the board
  already renders. Real portraits are a snapshot-pipeline concern (Phase 3).
- **No fuzzy or typo-tolerant search** — prefix matching over names and
  aliases only, as specified. No scoring, no ranking beyond alphabetical.
- **No multi-level undo, no redo**: one backup, replaced by each reset
  (US-24).
- **No recently-picked or favourites list**, and no way to assign a role to an
  enemy pick — enemy roles stay inferred by the model.
- **No e2e tests**: Task 4 owns the Playwright suite; the DOM-level scenarios
  this change adds are listed in `tasks.md` as its target.
- **No model or snapshot-contract change**: `src/model.ts`, `src/types.ts`, and
  the bundle stay exactly as archived.
- **No new dependency.**

## Impact

- New files: `src/app/picker/*` (overlay, hero search, grid) and their tests;
  picker, dialog, and toast styles in `src/app/styles/app.css`.
- Changed files: `src/app/board/board.tsx` (triggers replace `PickEntry`),
  `src/app/session.ts` (reset/undo actions, backup, extended hotkey routing),
  `src/app/app.tsx` (picker target state, dialog, toast),
  `src/app/header.tsx` (`New` and `Undo`).
- Removed: `PickEntry`, `availableHeroes`, and the `<select>` scenarios of the
  `draft-board` spec.
- No manifest change, so no `/warm` gate; `/zombies` runs at propose and at
  review as usual.
- Closes Phase 2 and leaves Task 4 a complete UI to smoke-test.
