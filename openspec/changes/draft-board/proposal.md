# Draft board — proposal

## Why

`ui-foundation` shipped the shell: a snapshot arrives, a session is held and
persisted, and side plus role can be chosen. Nothing yet draws a draft or
calls `computeModel`, so the product still answers no question a player has.
This change turns the shell into the working board — the screen the whole tool
exists to show — and is the second of the three sequenced Phase 2 proposals.

## What Changes

- Add the board panels of screens-spec §2: the bans row, my-team slots by role
  1–5 with my role marked, enemy slots with inferred role probabilities,
  per-open-role suggestion blocks, and the result block that replaces
  suggestions once all ten picks are in.
- Add the draft mutations the board needs to the session: add/remove a ban,
  set/clear a team pick on a role, add/remove/replace an enemy pick — each
  persisted the same way side and role already are.
- Wire the first `computeModel` call: the model output is recomputed
  synchronously from `(snapshot, session)` on every session change, with no
  spinner and no intermediate loading state.
- Add the hero tile — the coloured, initialled square the design uses in place
  of hero icons — in its three sizes (bans 40px, slots 34px, chips 26px), with
  its `insufficient data` badge.
- Collapse the always-open session strip into the design's header: side · role
  as text with an `edit` affordance that toggles the editor panel; the `New`
  button gets its place in the header but stays inert until proposal 2c owns
  reset.
- Restrict the `R`/`D` and `1`–`5`/`C M O S F` hotkeys to the Setup screen and
  the open header editor, per screens-spec §5 — on the board those keys are
  reserved for the picker that proposal 2c adds.
- Add the one-column layout for narrow viewports (screens-spec §2.8), verified
  down to 390px, with the bans row and each suggestion row scrolling
  horizontally.
- Add a temporary native `<select>` of heroes as the pick-entry control on
  empty slots and the bans row, so the board is usable and testable before the
  picker exists. Proposal 2c deletes it and points the same
  `applyDraftAction` seam at the picker overlay.

## Capabilities

### New Capabilities

- `draft-board`: the board screen — which panels exist, what each renders from
  the session and the model output, how a pick is entered and removed, how the
  layout collapses to one column, and how the hero tile derives its colour and
  ink from the design tokens.

### Modified Capabilities

- `draft-session`: gains the draft mutations (bans, team picks, enemy picks)
  with their limits and their persistence; the session-editor strip becomes a
  collapsed display plus a toggled editor; side and role hotkeys become
  context-scoped instead of always active.

## Non-goals

- **No hero picker** — the search/alias/grid/keyboard overlay is proposal 2c.
  This change ships the `<select>` stand-in and the action seam the picker
  plugs into.
- **No board hotkeys**: `B`, `E`, and the digit/letter keys opening a picker
  for a slot are 2c, together with the full context-routing table of
  screens-spec §5. This change only stops those keys from silently changing
  the session while the board is up.
- **No reset, dialog, or undo**: `New` renders but does nothing; the confirm
  dialog and the `Draft reset · Undo` toast are 2c (screens-spec §4).
- **No snapshot-swap invalidation** (screens-spec §6.4) — marking a slot whose
  hero left the snapshot is 2c.
- **No e2e tests**: Task 4 owns the Playwright suite; the DOM-level scenarios
  this change adds are enumerated in `tasks.md` as its target.
- **No model change**: `src/model.ts` and `src/types.ts` are consumed exactly
  as archived in Phase 1.
- **No new dependency.**

## Impact

- New files: `src/app/board/*` (panels, hero tile, pick actions) and their
  tests; new component styles in `src/app/styles/app.css`.
- Changed files: `src/app/app.tsx` (board composition, `computeModel` call),
  `src/app/session.ts` (draft mutations, hotkey context), `src/app/header.tsx`
  and `src/app/session-controls.tsx` (collapsed strip + toggled editor),
  `src/app/styles/tokens/colors.css` (three additions — see design.md).
- No manifest change, so no `/warm` gate; `/zombies` runs at propose and at
  review as usual.
- Unblocks proposal 2c (`hero-picker`) and gives Task 4 a board to smoke-test.
