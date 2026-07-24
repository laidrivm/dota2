# Hero picker — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). Bullets
marked **(e2e)** are the run's `(e2e candidate)` findings: they are specified
here, verified by hand against a running app during apply, and are Task 4's
Playwright target.

## 1. Hero search

- [x] 1.1 Tests for `matchHeroes`: an empty query returns every hero in
      ascending name order; a whitespace-only query does the same. (Req:
      hero-picker — Search filters from the first character / Whitespace-only
      query)
- [x] 1.2 Tests for matching: `cli` → Clinkz first; `bone` → Clinkz through
      the alias `bone fletcher`; `wk` → Wraith King; `king` → Wraith King on a
      word that is not the first; `WK` in upper case matches. (Req:
      hero-picker — Search filters from the first character, alias and word
      scenarios)
- [x] 1.3 Tests for what must not match: `ing` matches no hero (prefix, never
      substring); a query one character longer than a full name matches
      nothing; a query of regex metacharacters (`.`, `*`, `(`) matches
      literally and does not throw. (Req: hero-picker — Search / Not a
      substring search)
- [x] 1.4 Test: `ni` returns two heroes matched by different routes, in name
      order, not in the snapshot's own order. (The fixture has no Nature's
      Prophet, so the pair is Enigma via the alias `nigma` and Night Stalker
      via its name.) (Req: hero-picker — Search, match ordering)
- [x] 1.5 Test: a hero with an empty `aliases` array is matched by name alone.
      (Req: hero-picker — Search filters from the first character)
- [x] 1.6 Implement `matchHeroes(heroes, query)` in `src/app/picker/search.ts`.
      (Req: hero-picker — Search filters from the first character)

## 2. Used-hero lookup

- [x] 2.1 Tests for `usedAs`: `"ban"`, `"team"`, `"enemy"` for a hero in each
      set, `null` for a hero in none. (Req: hero-picker — Grid shows taken
      heroes as taken)
- [x] 2.2 Dropped during apply: `isUsed` is now literally
      `usedAs(...) !== null`, so a test comparing them passes against any
      implementation and guards nothing (docs/testing.md). What it was meant
      to protect — that the label and the reducer's refusal agree — is covered
      by 2.1 sharing the fixture session with the single-occupancy tests.
- [x] 2.3 Replace `isUsed` with `usedAs` in `session.ts` and keep `isUsed` as
      its `!== null` wrapper. (Req: hero-picker — Grid shows taken heroes as
      taken)

## 3. Board hotkeys and routing

- [x] 3.1 Tests for `pickerHotkey`: `B` → `{ kind: "ban" }`; `E` →
      `{ kind: "enemy" }`; `3` and `o` both → `{ kind: "team", role: 3 }`,
      whether or not the slot is filled. (Req: hero-picker — Board hotkeys
      open the picker)
- [x] 3.2 Boundary tests: `B` → `null` at exactly `heroes.length - 10` bans
      and a target one below; `E` → `null` at exactly five enemy picks and a
      target at four. (Req: hero-picker — Board hotkeys / ban limit and full
      enemy team)
- [x] 3.3 Tests for refusals: `B` with Ctrl, Meta, or Alt held → `null`; an
      unmapped key (`6`, `X`) → `null`. (Req: hero-picker — Board hotkeys /
      Modified keystroke)
- [x] 3.4 Tests for `hotkeyContext`: returns `"modal"` while the picker or the
      confirmation dialog is open, including when the header editor is also
      open — the dialog outranks the editor; `hotkeyFor` yields no side/role
      action in that context. (Req: draft-session — Keystrokes route to the
      topmost context)
- [x] 3.5 Implement `pickerHotkey(event, session, banLimit)` and the `"modal"`
      context, and wire `useSession` to pick between the two hotkey functions.
      (Reqs: hero-picker — Board hotkeys open the picker; draft-session —
      Keystrokes route to the topmost context)

## 4. Reset and undo

- [x] 4.1 Tests for `reset`: clears `bans`, `enemyPicks`, and all five
      `teamPicks` entries; keeps `side` and `myRole`. (Req: draft-session —
      Reset clears the draft and keeps the setup / Reset keeps side and role)
- [x] 4.2 Test: confirmation is required at nine picks and not at ten. (Req:
      draft-session — Reset / Complete draft resets immediately)
- [x] 4.3 Tests for `undo`: restores a session deeply equal to the one before
      the reset; with no stored backup it changes nothing. (Req: draft-session
      — One level of undo after a reset / Undo restores the draft)
- [x] 4.4 Test: a second reset replaces the backup rather than stacking it —
      undo returns the draft from before the second reset only. (Req:
      draft-session — One level of undo, backup replacement)
- [x] 4.5 Tests: each of `banAdd`, `teamSet`, and `enemyAdd` after a reset
      clears `draft.backup`; a `side` or `role` change does not. (Req:
      draft-session — One level of undo / Entering a hero ends the undo window;
      Editing the setup keeps the undo window)
- [x] 4.6 Test: a `draft.backup` value that is not valid JSON or not a `v: 1`
      session is discarded, no undo is offered, and nothing throws. (Req:
      draft-session — One level of undo / Unreadable backup)
- [x] 4.7 Implement the `reset` and `undo` reducer cases and the
      `draft.backup` read/write in `session.ts`. (Req: draft-session — Reset;
      One level of undo)

## 5. Picker overlay

- [x] 5.1 Build `src/app/picker/picker.tsx` as a native `<dialog>` opened with
      `showModal()`: context title from the `PickTarget`, `✕` control,
      autofocused search field, hero grid, mono hint bar. (Reqs: hero-picker —
      Picker opens for one named target; Search filters from the first
      character)
- [x] 5.2 Render the grid from the design's `component-picker.html`: 40px
      tiles with the hero name under each, taken heroes at `opacity: .35`
      labelled `ban` / `team` / `enemy` in the accent colour and disabled, the
      first match ringed on a `--bg-3` cell. (Req: hero-picker — Grid shows
      taken heroes as taken)
- [x] 5.3 Render a `role="status"` message when the query matches no hero.
      (Req: hero-picker — Grid / No match)
- [x] 5.4 Was a unit test over an extracted `firstSelectable`; the
      ponytail-review pass cut that wrapper back to the `matches.find(...)` it
      always was, and its tests with it. The behaviour is guarded by the
      **(e2e)** bullets 9.1 and 8.4. (Req: hero-picker — Picker is operable
      from the keyboard alone / Enter when every match is taken)
- [x] 5.5 Implement the keyboard layer: `Enter` picks the first selectable
      match (nothing when there is none, whether the grid is empty or every
      match is taken), arrows move by one and by the grid's computed column
      count, a printable key on a tile appends to the query and refocuses the
      field, `Esc` closes. (Req: hero-picker — Picker is operable from the
      keyboard alone)
- [x] 5.6 Close the picker on a `click` whose target is the dialog element
      itself, and give the confirmation dialog no light dismiss. (Req:
      hero-picker — Picker opens for one named target / Closed without
      choosing)
- [x] 5.7 Apply a choice through the existing `applyAction`, close the dialog,
      and redirect focus to the filled position in a macrotask. (Req:
      hero-picker — A choice applies and closes)
- [x] 5.8 Hold the `PickTarget` in `App` state only — never in the session or
      in storage. (Req: hero-picker — The picker is never persisted)

## 6. Board and header wiring

- [x] 6.1 Delete `PickEntry` and `availableHeroes`; every empty slot and the
      bans row becomes a button opening the picker for its position, keeping
      the bans row's disabled-at-the-limit behaviour. (Reqs: draft-board —
      Pick entry; Bans row / Ban limit)
- [x] 6.2 `board.test.ts` deleted with `availableHeroes`, its only subject;
      what replaces it is the `usedAs` coverage of task 2. (Req: draft-board —
      Pick entry)
- [x] 6.3 Make `New` live: the confirmation dialog while fewer than ten picks
      are in, immediate reset at ten. (Req: draft-session — Reset clears the
      draft and keeps the setup)
- [x] 6.4 Add the `Draft reset · Undo` toast (`role="status"`, five seconds)
      and the header `Undo`, both rendered off `backup !== null`. (Req:
      draft-session — One level of undo after a reset)
- [x] 6.5 The recompute half is already guarded — `model.test.ts`'s "unknown
      hero id in session does not crash or poison scores". The marker itself is
      DOM-only, so it is verified as **(e2e)** in 9.12 rather than with a DOM
      environment this project does not carry. (Req: draft-board — A hero the
      snapshot no longer contains is flagged for re-pick)
- [x] 6.6 Implement the `re-pick` marker on team, enemy, and ban entries whose
      hero left the snapshot. (Req: draft-board — A hero the snapshot no
      longer contains is flagged for re-pick)

## 7. Styles

- [x] 7.1 Picker, dialog, and toast styles in `src/app/styles/app.css` from
      the design project's `component-picker.html` and
      `component-dialogs.html`, using existing tokens only. (Reqs: hero-picker
      — Grid shows taken heroes as taken; app-shell — Style values come from
      design tokens)
- [x] 7.2 Full-screen picker below 720px with a reflowed grid, verified at
      390px with no horizontal page scroll. (Req: hero-picker — Full-screen
      picker on a narrow viewport)
- [x] 7.3 Three overlay tokens the dialogs need — `--backdrop`,
      `--shadow-modal`, `--shadow-toast` — added to
      `src/app/styles/tokens/colors.css` and pushed to the design project's
      `tokens/colors.css`, so the copy stays verbatim. (Req: app-shell — Style
      values come from design tokens)

## 8. Accessibility verified during apply

- [x] 8.1 Verify the search field has an accessible label and holds focus when
      the picker opens. **(e2e)** (Req: hero-picker — Search filters from the
      first character / Search field has focus on open)
- [x] 8.2 Verify each selectable tile is a `button` whose accessible name
      contains the hero's name, and that a taken tile is exposed as disabled
      rather than merely dimmed. **(e2e)** (Req: hero-picker — Grid shows
      taken heroes as taken / Every tile is named)
- [x] 8.3 Verify the board is not focusable while the picker is open.
      **(e2e)** (Req: hero-picker — Picker opens for one named target /
      Background is inert)
- [x] 8.4 Verify Space on a focused hero tile picks that hero rather than
      typing a space into the search field. **(e2e)** (Req: hero-picker —
      Picker is operable from the keyboard alone)
- [x] 8.5 Verify the toast is announced and does not move focus. **(e2e)**
      (Req: draft-session — One level of undo / Toast does not steal focus)

## 9. Journeys verified during apply

- [x] 9.1 Verify `3` on the board → type `cli` → `Enter` lands Clinkz on
      Offlane with the picker closed. **(e2e)** (Reqs: hero-picker — Board
      hotkeys open the picker; A choice applies and closes)
- [x] 9.2 Verify `Esc` closes the picker with the session unchanged and focus
      back on the trigger. **(e2e)** (Req: hero-picker — Picker opens for one
      named target / Closed without choosing)
- [x] 9.3 Verify a click on the backdrop closes the picker while a click inside
      it does not, and that the confirmation dialog ignores backdrop clicks
      altogether. **(e2e)** (Req: hero-picker — Picker opens for one named
      target / Closed without choosing)
- [x] 9.4 Verify focus lands on the filled slot's control after a pick and not
      on `document.body`. **(e2e)** (Req: hero-picker — A choice applies and
      closes / Focus after the pick)
- [x] 9.5 Verify `ArrowDown` from the first tile moves focus one full row down
      at eight columns and at four. **(e2e)** (Req: hero-picker — Picker is
      operable from the keyboard alone / Arrows move by row)
- [x] 9.6 Verify typing a letter while a tile has focus appends it to the
      query and returns focus to the field. **(e2e)** (Req: hero-picker —
      Picker is operable from the keyboard alone / Typing returns to the
      search field)
- [x] 9.7 Verify `B` while the picker is open opens no second picker and types
      into the search field. **(e2e)** (Req: draft-session — Keystrokes route
      to the topmost context)
- [x] 9.8 Verify a reload with the picker open restores the board with the
      picker closed. **(e2e)** (Req: hero-picker — The picker is never
      persisted)
- [x] 9.9 Verify a reset on an incomplete draft asks first, and that `Esc` on
      that dialog changes nothing. **(e2e)** (Req: draft-session — Reset /
      Incomplete draft asks first)
- [x] 9.10 Verify reset → reload inside the toast window → the header `Undo`
      still restores the draft. **(e2e)** (Req: draft-session — One level of
      undo / Undo survives a reload inside the window)
- [x] 9.11 Verified at 500px, the narrowest window Chrome will open on macOS:
      one column, a four-column full-screen picker, `scrollWidth ===
      clientWidth`. The literal 390px viewport needs a device-emulated context,
      so it stays Task 4's to assert. **(e2e)** (Req: hero-picker — Full-screen
      picker on a narrow viewport)
- [x] 9.12 Verify a stored session holding a hero the snapshot does not carry
      renders that slot with the `re-pick` marker and a working removal
      control. **(e2e)** (Req: draft-board — A hero the snapshot no longer
      contains is flagged for re-pick)

## 10. Findings from the diff-mode /zombies run

- [x] 10.0 Fixed: `apply` closed the undo window on the action's kind, so a ban
      refused at the limit — or a pick of an already-used hero — dropped
      `draft.backup` without entering anything. The decision now reads the
      reducer's result (`closesUndoWindow`), guarded by four tests. (Req:
      draft-session — One level of undo / Entering a hero ends the undo window)
- [x] 10.0a Fixed: Space on a focused grid tile was swallowed by the
      printable-key branch and typed into the search field instead of pressing
      the tile. (Req: hero-picker — Picker is operable from the keyboard alone)
- [x] 10.0b Fixed: after the fifth enemy pick no trigger survives, and the
      focus redirect landed on the *first* enemy's removal control — one Enter
      away from deleting the wrong hero. It now takes the last. (Req:
      hero-picker — A choice applies and closes / Focus after the pick)
- [x] 10.0c Added: `remove` swallowing a throwing `removeItem`, the third door
      into storage. (Req: draft-session — Session persists across reloads /
      Storage unavailable)
- [x] 10.0d Skipped: `columns()` returning 1 when `grid-template-columns`
      resolves to `none`. It cannot resolve to `none` while the grid is laid
      out inside an open dialog, and the degradation is `ArrowDown` behaving as
      `ArrowRight`.
- [x] 10.0e Skipped: a reset on an already-empty draft still writes a backup
      and offers an `Undo` that restores an identical draft. Harmless, and the
      alternative is a second emptiness rule to keep in sync with
      `confirmsReset`.

## 10a. Findings from reading the high-risk files after /triage

- [x] 10a.1 Fixed: the picker dialog had no accessible name — the confirmation
      dialog carries `aria-labelledby`, the picker did not, so it announced as
      an unnamed dialog. Its `<h2>` is now its label. (Req: hero-picker —
      Picker opens for one named target)
- [x] 10a.2 Fixed: the search field was `type="search"`, whose native `Esc`
      Chrome spends on clearing the text — after typing, the first `Esc` did
      not close the picker the hint bar promises. It is a `type="text"` field
      now; verified in Chrome that one `Esc` closes it with a query typed.
      (Req: hero-picker — Picker is operable from the keyboard alone)
- [x] 10a.3 Noted, not fixed: a picker opened by hotkey with nothing focused
      returns focus to `body` on close, because there was no trigger to return
      it to. The board's hotkeys work from `body`, which is where they were
      pressed.

## 10b. CodeRabbit findings on the implementation PR

- [x] 10b.1 The DOM position contract lived in two spellings — the board wrote
      `team-3`, `focusAfterPick` rebuilt it. `Position` and `positionOf` now
      sit beside `PickTarget` in `session.ts`, and a template-literal type
      fails the build on a typo.
- [x] 10b.2 The bans trigger at the limit announced only `Add ban`: a disabled
      control's `title` is not read out. The reason is in the accessible name.
- [x] 10b.3 `New` and `Undo` carry accessible names (`New draft`, `Undo the
      reset`) that keep their visible labels as a prefix.
- [x] 10b.4 Roving tab stops in the grid: the first selectable tile is the one
      tab stop, the rest are `tabIndex={-1}`, and where nothing is selectable
      the first tile keeps the stop so the grid is never unreachable. This
      reverses design.md's "every tile stays tabbable" — the cost it named was
      state the picker does not need, and the stop is derived from the `first`
      it already computes. Verified: Tab enters at Anti-Mage, `ArrowDown`
      moves a full row.
- [x] 10b.5 A taken tile faded its own label to 0.35, which is the one thing
      it has to say. Only the artwork dims now; the name drops to `--text-5`
      and the `ban`/`team`/`enemy` label keeps the accent. Diverges from the
      mock, which fades the whole cell.
- [x] 10b.6 Real bug on a phone: the full-screen picker clipped its own hint
      bar and the last rows of heroes, because the dialog is `overflow: hidden`
      and the grid grew past the viewport. The dialog is a flex column with
      `min-height: 0` on the grid, so the heroes scroll and the hints stay put.
      Verified at 390px.

## 10. Gates

- [x] 10.1 `bun test` green; `tsc --noEmit` clean; `biome check` clean.
- [x] 10.2 `/zombies` in diff mode over the branch: three findings became
      fixes with tests, one became a test, two were skipped with reasons — all
      recorded in section 10 above.
- [x] 10.3 No `/warm` gate — this change adds no dependency; state that in the
      PR rather than running it.
- [x] 10.4 `/triage` suggested to the user before the PR is opened.
- [x] 10.5 `PLAN.md` updated: 2c marked done, Phase 2 closed, any decision
      taken during apply recorded.
