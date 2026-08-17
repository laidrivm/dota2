# focus-restore-idiom — design

## Context

The two sites, reduced to their shape:

```tsx
// app.tsx focusAfterPick
const position = positionOf(target);           // capture before
setTimeout(() => {                             // wait for the commit
  const next = document.querySelector(`[data-pick="${position}"]:not(:disabled)`)
    ?? last(document.querySelectorAll(`[data-remove="${position}"]`));
  if (next instanceof HTMLElement) next.focus();
}, 0);

// pieces.tsx RemoveButton
const row = event.currentTarget.closest("[data-row]");      // capture before
const region = event.currentTarget.closest("[data-region]");
onClick();
setTimeout(() => {                             // wait for the commit
  const next = (row?.isConnected ? row.querySelector("[data-pick]") : null)
    ?? region?.querySelector("[data-pick]");
  if (next instanceof HTMLElement) next.focus();
}, 0);
```

Identical: the macrotask, the `instanceof HTMLElement` guard before `.focus()`,
and the fact that the capture must precede the mutation. Different: what is
searched and in what order.

## Goals / Non-Goals

**Goals:**

- The wait and the guard in one place, executed rather than commented.
- Both callers keep their finder verbatim.
- One testable criterion for the behaviour the wait exists to produce.

**Non-Goals:**

- One finder, a focus manager, or any change to where focus lands.
- Handling an unmount neither site has: nothing here restores focus after a
  route change or a dialog stack.

## Decisions

### The helper takes a finder and returns nothing

`restoreFocus(find: () => Element | null | undefined): void` — schedules the
macrotask, calls `find`, guards the result and focuses it. The caller runs its
capture before calling, which is where it already runs.

*Alternative considered.* Passing selectors instead of a closure was rejected:
`RemoveButton`'s search depends on a node captured from the event and on
`isConnected`, which no selector expresses.

### It lives in `src/app/`, beside `cx.ts` and `hotkeys.ts`

Those are the precedent for a small shared behaviour module in this tree.
`src/model.ts` and `src/types.ts` are the only files forbidden from importing
`src/app/**`, and neither is involved.

### The new criterion is about the background tab, not about `setTimeout`

A criterion naming `setTimeout` would specify the implementation and could not
fail on the mistake it exists to catch — `rAF` also "waits". What distinguishes
them is observable: a hidden document has no rendering opportunities, so its
`rAF` callbacks are paused or throttled for as long as it stays hidden, while a
macrotask is subject to neither. So the scenario is written as *the document is
hidden when the removal happens, and focus still moves*.

The wording is deliberately not "a frame never comes". The platform guarantees
no rendering opportunity, not a callback that never fires, and a criterion
resting on the stronger claim would be one a conforming browser could satisfy
by accident.

*How the document is hidden.* Not by overriding `document.hidden`, which
changes what a page reads and not how the browser schedules. A second page
opened in the same context and given `bringToFront()` backgrounds the first for
real: `visibilitychange` fires and its frame callbacks stop. That is the
mechanism the case uses, and it is why this is an e2e case rather than a unit
one. `e2e/board.spec.ts` already drives the removal path and is where it goes.

*The assertion is bounded, not instantaneous.* `toBeFocused()` retries to its
timeout, so the case passes as soon as focus lands and fails only if it never
does — which is what "paused or throttled" requires of it.

### The criterion joins `draft-board`, not `hero-picker`

Both paths land focus on a board control, and `draft-board` already owns the
removal half. `hero-picker` §*Focus after the pick* stays as it is and depends
on this the way it already does.

## Risks / Trade-offs

- **A helper hides the reason the wait is a macrotask, and the next reader
  copies the call without it.** → The reason moves into the helper's doc
  comment and leaves both call sites; one home for the fact is the point. The
  `CLAUDE.md` Code rule stays, because it governs sites that do not use the
  helper.
- **Two callers is the minimum that justifies a lift, and the finders differ
  enough that the helper is nearly all signature.** → It is, and what it buys
  is the wait and the guard being executed once instead of written three times.
  If the diff shows the helper is only a `setTimeout` wrapper with no reader
  better off, abandoning it is the right outcome and not a failure — but it is
  a decision, so it carries its own work: `proposal.md`'s *What Changes* and
  this section both name the helper, and both are rewritten in the same pull
  request that drops it. The criterion, its case and the `CLAUDE.md` rule stand
  either way, which is what makes the escape safe to leave open.
- **The hidden-tab case is flaky if the test hides the tab after the
  removal.** → Hide it before, assert focus after; and break-check by
  reverting the helper to `requestAnimationFrame` and watching the case fail.
