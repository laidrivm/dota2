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

### The criterion names the dependency, not the tab

A criterion naming `setTimeout` would specify the implementation and could not
fail on the mistake it exists to catch — `rAF` also "waits". A criterion naming
a hidden tab would name the motivation but not the dependency, and would rest
on a claim the platform does not make: browsers withhold rendering
opportunities from a backgrounded document, but nothing guarantees a callback
that never fires. So the scenario is written as *no animation frame callback
runs, and focus still moves*. That is the property being bought, it holds
whatever a browser does with a hidden tab, and it is reproducible.

*What was measured, and why the obvious routes are not used.* Playwright
1.62.1 with its bundled Chromium, on this machine:

| attempt | result |
| --- | --- |
| second page in the same context, `bringToFront()` on it | first page stays `visibilityState: "visible"`, `rAF` still fires — headless **and** headed |
| CDP `Emulation.setPageVisibilityOverride` | method does not exist |
| CDP `Page.setWebLifecycleState` `frozen` | `visibilityState: "visible"`, `rAF` still fires |
| `addInitScript` replacing `requestAnimationFrame` | callback never runs; a macrotask still runs and focus lands |

So there is no reliable way to background a page from the harness, and the
last row is the mechanism. It creates the condition the criterion names
directly rather than hoping a browser produces it.

*The stub has to be written one exact way.* `window.requestAnimationFrame = …`
inside `addInitScript`, followed by `setContent` with no navigation, silently
does not take — measured, and it is why the first version of this section was
wrong. `Object.defineProperty(window, "requestAnimationFrame", { … })` plus a
navigation does take, and the task confirms the stub is in place before relying
on it.

*Still an e2e case rather than a unit one.* There is no DOM test environment
here — no `happy-dom`, no `jsdom`, and adding one for this is a dependency the
change does not need. `e2e/board.spec.ts` already drives the removal path.

*The assertion is bounded, not instantaneous.* `toBeFocused()` retries to its
timeout, so the case passes as soon as focus lands and fails only if it never
does.

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
