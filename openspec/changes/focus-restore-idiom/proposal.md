# focus-restore-idiom

## Why

Two controls restore focus after the element holding it unmounts, and both
implement the same four steps: capture what the search needs **before** the
mutation, dispatch it, wait a macrotask so Preact has committed, then focus the
first element a fallback chain finds.

- `src/app/app.tsx` `focusAfterPick` — after the picker closes on a choice.
- `src/app/board/pieces.tsx` `RemoveButton`'s click handler — after a removal.

`PLAN.md` has carried this as a rule-of-two candidate since `file-size-cap`
step 6, which left it where it was because the second consumer predated it.

The step that is easy to get wrong is the third. `requestAnimationFrame` looks
like the right wait and is not: it runs before the commit, and its callback is
tied to a rendering opportunity, which browsers withhold from a backgrounded
document — so focus can be left on the document body for as long as the tab
stays hidden. A macrotask is tied to neither. Both sites carry a comment saying
so, and `CLAUDE.md` carries the Code rule — three statements of one fact, none
of them executable. The next site will be a fourth statement or a bug.

The criterion below is written as *no animation frame callback runs* rather
than *the tab is hidden*, because that is the dependency being removed and,
unlike tab visibility, it is a condition a test can create — see `design.md`
for what was measured.

## What Changes

- The idiom moves into one helper taking a finder: it owns the macrotask and
  the `HTMLElement` guard, and the caller supplies the search — unless the diff
  shows the helper to be a bare `setTimeout` wrapper with no reader better off,
  which `design.md` admits as an outcome and `tasks.md` makes a decision with
  its own artefact updates. The criterion and its case land either way.
- `focusAfterPick` and `RemoveButton` call it. Their finders stay as they are —
  the document by position with a `[data-pick]` → last `[data-remove]`
  fallback, and the captured row then region — because the strategies differ
  and only the idiom repeats.
- `draft-board` gains the criterion neither existing one states: focus
  restoration happens after the commit and does not depend on a frame, so it
  still happens in a background tab. That is the fact the helper encodes and
  the reason it exists.

## Non-goals

- **Unifying the two finders.** They search different things for different
  reasons. `PLAN.md` is explicit that what lifts is the idiom taking a finder,
  not the strategy.
- **The rule of two itself.** `scan-lift` writes that rule into `CLAUDE.md`.
- **Changing where focus lands** in either path. `hero-picker` §*Focus after
  the pick* and `draft-board` §*Focus survives the removal* both stand
  unchanged, and their e2e tests are the control.
- **A focus-management layer.** One helper and two callers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `draft-board`: the removal requirement gains a scenario for the wait, so the
  behaviour both focus criteria depend on is stated once where it can be
  tested rather than three times in comments.

## Impact

- A helper in `src/app/`, and a unit test covering what its guard decides:
  a finder returning `null`, `undefined`, a non-`HTMLElement` node, and an
  `HTMLElement`.
- `src/app/app.tsx` — `focusAfterPick`'s body, keeping its signature.
- `src/app/board/pieces.tsx` — `RemoveButton`'s handler.
- `e2e/board.spec.ts` §*removing a hero moves focus to the entry control that
  replaces it* is the existing control on the removal path.
- No dependency changes. This is user-visible accessibility behaviour, so the
  new criterion is written to be observable rather than to describe the code.
