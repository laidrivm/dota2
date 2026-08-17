# focus-restore-idiom — tasks

One group, so this change's implementation ships whole on the branch
`feat/focus-restore-idiom` — this proposal is on `spec/focus-restore-idiom`, as
`CLAUDE.md` prescribes for the two stages. It closes one acceptance criterion:
`draft-board`'s *Focus survives the removal in a hidden tab*.

## 1. One wait, two finders

- [ ] 1.1 Write the e2e case first, in `e2e/board.spec.ts` beside the existing
      *removing a hero moves focus to the entry control that replaces it*.
      Background the page for real rather than overriding `document.hidden`,
      which changes what the page reads and not how the browser schedules:
      open a second page in the same context and `bringToFront()` it, confirm
      `visibilitychange` fired and `document.visibilityState` is `hidden`, then
      activate a removal control on the backgrounded page and assert
      `toBeFocused()` on the replacing pick-entry control. Background before
      the removal, not after, and let the web-first assertion bound the wait —
      the criterion says focus lands, not that it lands within a frame. Record
      that it passes against today's `setTimeout` (*Focus survives the removal
      in a hidden tab*)
- [ ] 1.2 Break-check it before the helper exists: replace the `setTimeout` in
      `src/app/board/pieces.tsx` with `requestAnimationFrame`, confirm 1.1
      fails, restore. If it does not fail, the case is not pinning the mistake
      and 1.1 is not done — say which of the two the run showed. A hidden
      document is guaranteed no rendering opportunity rather than a callback
      that never fires, so record the Chromium behaviour observed rather than
      asserting it in advance (*Focus survives the removal in a hidden tab*)
- [ ] 1.3 Add the helper — `restoreFocus(find)` in `src/app/focus.ts`, beside
      `cx.ts` and `hotkeys.ts` — owning the macrotask and the `HTMLElement`
      guard. The reason the wait is a macrotask and not a frame moves into its
      doc comment (*Focus survives the removal in a hidden tab*)
- [ ] 1.4 Unit-test the helper on what its guard decides, which no e2e case
      reaches: a finder returning `null`, `undefined`, a non-`HTMLElement` node
      and an `HTMLElement`. Only the last focuses; none of the others throws
      (*Focus survives the removal in a hidden tab*)
- [ ] 1.5 Switch `src/app/app.tsx`'s `focusAfterPick` to it, keeping its
      signature and its finder verbatim: `[data-pick="…"]:not(:disabled)` then
      the last `[data-remove="…"]`. Its comment about the wait leaves with the
      code it explained (*hero-picker/Focus after the pick*)
- [ ] 1.6 Switch `src/app/board/pieces.tsx`'s `RemoveButton` to it, keeping the
      capture of `row` and `region` before `onClick()` — the capture is the
      caller's, not the helper's, and moving it after the dispatch is the way
      this switch breaks. Its comment about the wait leaves too (*Focus
      survives the removal in a hidden tab*)
- [ ] 1.7 Break-check again, now against the shipped arrangement: the wait
      lives in `src/app/focus.ts` after 1.3, so replace it *there* with
      `requestAnimationFrame` and confirm 1.1 fails, then restore. 1.2 proved
      the case pins the mistake in the code as it stood; this proves it still
      does in the code that ships (*Focus survives the removal in a hidden
      tab*)
- [ ] 1.8 Decide the helper's fate. With both call sites switched, read the
      diff: if `restoreFocus` is a bare `setTimeout` wrapper and neither caller
      reads better, abandon the lift — and carry the decision through, because
      `proposal.md`'s *What Changes* and `design.md`'s *One export…* both name
      the helper and both are rewritten in the same pull request that drops it.
      1.1's case, the criterion and the `CLAUDE.md` rule stand either way,
      which is what makes the escape safe to leave open. Record which way it
      went and why (*Focus survives the removal in a hidden tab*)
- [ ] 1.9 Run the full e2e suite and confirm the two focus cases already in it
      still pass — `e2e/board.spec.ts`'s removal case and the picker's focus
      case are this change's controls, and neither is edited by it
      (*hero-picker/Focus after the pick*, *Focus survives the removal*)
- [ ] 1.10 Cite the new criterion with a `// spec:` line and record the uncited
      count before and after, so the criterion does not land on the floor
      (*Focus survives the removal in a hidden tab*)
