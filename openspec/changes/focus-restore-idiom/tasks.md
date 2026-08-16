# focus-restore-idiom — tasks

One group, so this change ships whole on `feat/focus-restore-idiom`. It closes
one acceptance criterion: `draft-board`'s *Focus survives the removal in a
hidden tab*.

## 1. One wait, two finders

- [ ] 1.1 Write the e2e case first, in `e2e/board.spec.ts` beside the existing
      *removing a hero moves focus to the entry control that replaces it*: hide
      the document, activate a removal control, assert focus landed on the
      replacing pick-entry control. Hide before the removal, not after. Record
      that it passes against today's `setTimeout` — this case exists to fail on
      `requestAnimationFrame`, so 1.2 is where it earns its place
- [ ] 1.2 Break-check it: replace the `setTimeout` in
      `src/app/board/pieces.tsx` with `requestAnimationFrame`, confirm 1.1
      fails, restore. A case that cannot fail on the mistake it names pins
      nothing, and this is the mistake `CLAUDE.md`'s Code rule was written for
- [ ] 1.3 Add the helper — `restoreFocus(find)` in `src/app/focus.ts`, beside
      `cx.ts` and `hotkeys.ts` — owning the macrotask and the `HTMLElement`
      guard. The reason the wait is a macrotask and not a frame moves into its
      doc comment
- [ ] 1.4 Switch `src/app/app.tsx`'s `focusAfterPick` to it, keeping its
      signature and its finder verbatim: `[data-pick="…"]:not(:disabled)` then
      the last `[data-remove="…"]`. Its comment about the wait leaves with the
      code it explained
- [ ] 1.5 Switch `src/app/board/pieces.tsx`'s `RemoveButton` to it, keeping the
      capture of `row` and `region` before `onClick()` — the capture is the
      caller's, not the helper's, and moving it after the dispatch is the way
      this switch breaks. Its comment about the wait leaves too
- [ ] 1.6 Stop if the helper is not worth it. With both call sites switched,
      read the diff: if `restoreFocus` is a bare `setTimeout` wrapper and
      neither caller reads better, abandon the lift, keep 1.1's case and the
      new criterion, and record here why. `design.md` names this as an
      accepted outcome rather than a failure
- [ ] 1.7 Run the full e2e suite and confirm the two focus cases already in it
      still pass — `e2e/board.spec.ts`'s removal case and the picker's focus
      case are this change's controls, and neither is edited by it
- [ ] 1.8 Cite the new criterion with a `// spec:` line and record the uncited
      count before and after, so the criterion does not land on the floor
- [ ] 1.9 Measure `src/app/app.tsx`, `src/app/board/pieces.tsx`,
      `src/app/focus.ts` and `e2e/board.spec.ts` against their caps and record
      the numbers
