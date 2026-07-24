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

- [ ] 4.1 Tests for `reset`: clears `bans`, `enemyPicks`, and all five
      `teamPicks` entries; keeps `side` and `myRole`. (Req: draft-session —
      Reset clears the draft and keeps the setup / Reset keeps side and role)
- [ ] 4.2 Test: confirmation is required at nine picks and not at ten. (Req:
      draft-session — Reset / Complete draft resets immediately)
- [ ] 4.3 Tests for `undo`: restores a session deeply equal to the one before
      the reset; with no stored backup it changes nothing. (Req: draft-session
      — One level of undo after a reset / Undo restores the draft)
- [ ] 4.4 Test: a second reset replaces the backup rather than stacking it —
      undo returns the draft from before the second reset only. (Req:
      draft-session — One level of undo, backup replacement)
- [ ] 4.5 Tests: each of `banAdd`, `teamSet`, and `enemyAdd` after a reset
      clears `draft.backup`; a `side` or `role` change does not. (Req:
      draft-session — One level of undo / Entering a hero ends the undo window;
      Editing the setup keeps the undo window)
- [ ] 4.6 Test: a `draft.backup` value that is not valid JSON or not a `v: 1`
      session is discarded, no undo is offered, and nothing throws. (Req:
      draft-session — One level of undo / Unreadable backup)
- [ ] 4.7 Implement the `reset` and `undo` reducer cases and the
      `draft.backup` read/write in `session.ts`. (Req: draft-session — Reset;
      One level of undo)

## 5. Picker overlay

- [ ] 5.1 Build `src/app/picker/picker.tsx` as a native `<dialog>` opened with
      `showModal()`: context title from the `PickTarget`, `✕` control,
      autofocused search field, hero grid, mono hint bar. (Reqs: hero-picker —
      Picker opens for one named target; Search filters from the first
      character)
- [ ] 5.2 Render the grid from the design's `component-picker.html`: 40px
      tiles with the hero name under each, taken heroes at `opacity: .35`
      labelled `ban` / `team` / `enemy` in the accent colour and disabled, the
      first match ringed on a `--bg-3` cell. (Req: hero-picker — Grid shows
      taken heroes as taken)
- [ ] 5.3 Render a `role="status"` message when the query matches no hero.
      (Req: hero-picker — Grid / No match)
- [ ] 5.4 Test: the first selectable match is the first hero with
      `usedAs(...) === null`, and there is none when every match is taken.
      (Req: hero-picker — Picker is operable from the keyboard alone / Enter
      when every match is taken)
- [ ] 5.5 Implement the keyboard layer: `Enter` picks the first selectable
      match (nothing when there is none, whether the grid is empty or every
      match is taken), arrows move by one and by the grid's computed column
      count, a printable key on a tile appends to the query and refocuses the
      field, `Esc` closes. (Req: hero-picker — Picker is operable from the
      keyboard alone)
- [ ] 5.6 Close the picker on a `click` whose target is the dialog element
      itself, and give the confirmation dialog no light dismiss. (Req:
      hero-picker — Picker opens for one named target / Closed without
      choosing)
- [ ] 5.7 Apply a choice through the existing `applyAction`, close the dialog,
      and redirect focus to the filled position in a macrotask. (Req:
      hero-picker — A choice applies and closes)
- [ ] 5.8 Hold the `PickTarget` in `App` state only — never in the session or
      in storage. (Req: hero-picker — The picker is never persisted)

## 6. Board and header wiring

- [ ] 6.1 Delete `PickEntry` and `availableHeroes`; every empty slot and the
      bans row becomes a button opening the picker for its position, keeping
      the bans row's disabled-at-the-limit behaviour. (Reqs: draft-board —
      Pick entry; Bans row / Ban limit)
- [ ] 6.2 Update `board.test.ts`: the candidate-list tests go with
      `availableHeroes`; what survives is the `usedAs` coverage of task 2.
      (Req: draft-board — Pick entry)
- [ ] 6.3 Make `New` live: the confirmation dialog while fewer than ten picks
      are in, immediate reset at ten. (Req: draft-session — Reset clears the
      draft and keeps the setup)
- [ ] 6.4 Add the `Draft reset · Undo` toast (`role="status"`, five seconds)
      and the header `Undo`, both rendered off `backup !== null`. (Req:
      draft-session — One level of undo after a reset)
- [ ] 6.5 Tests: a session hero id absent from the loaded snapshot keeps its
      slot with a `re-pick` marker, and the other panels still render and
      recompute. (Req: draft-board — A hero the snapshot no longer contains is
      flagged for re-pick)
- [ ] 6.6 Implement the `re-pick` marker on team, enemy, and ban entries whose
      hero left the snapshot. (Req: draft-board — A hero the snapshot no
      longer contains is flagged for re-pick)

## 7. Styles

- [ ] 7.1 Picker, dialog, and toast styles in `src/app/styles/app.css` from
      the design project's `component-picker.html` and
      `component-dialogs.html`, using existing tokens only. (Reqs: hero-picker
      — Grid shows taken heroes as taken; app-shell — Style values come from
      design tokens)
- [ ] 7.2 Full-screen picker below 720px with a reflowed grid, verified at
      390px with no horizontal page scroll. (Req: hero-picker — Full-screen
      picker on a narrow viewport)

## 8. Accessibility verified during apply

- [ ] 8.1 Verify the search field has an accessible label and holds focus when
      the picker opens. **(e2e)** (Req: hero-picker — Search filters from the
      first character / Search field has focus on open)
- [ ] 8.2 Verify each selectable tile is a `button` whose accessible name
      contains the hero's name, and that a taken tile is exposed as disabled
      rather than merely dimmed. **(e2e)** (Req: hero-picker — Grid shows
      taken heroes as taken / Every tile is named)
- [ ] 8.3 Verify the board is not focusable while the picker is open.
      **(e2e)** (Req: hero-picker — Picker opens for one named target /
      Background is inert)
- [ ] 8.4 Verify the toast is announced and does not move focus. **(e2e)**
      (Req: draft-session — One level of undo / Toast does not steal focus)

## 9. Journeys verified during apply

- [ ] 9.1 Verify `3` on the board → type `cli` → `Enter` lands Clinkz on
      Offlane with the picker closed. **(e2e)** (Reqs: hero-picker — Board
      hotkeys open the picker; A choice applies and closes)
- [ ] 9.2 Verify `Esc` closes the picker with the session unchanged and focus
      back on the trigger. **(e2e)** (Req: hero-picker — Picker opens for one
      named target / Closed without choosing)
- [ ] 9.3 Verify a click on the backdrop closes the picker while a click inside
      it does not, and that the confirmation dialog ignores backdrop clicks
      altogether. **(e2e)** (Req: hero-picker — Picker opens for one named
      target / Closed without choosing)
- [ ] 9.4 Verify focus lands on the filled slot's control after a pick and not
      on `document.body`. **(e2e)** (Req: hero-picker — A choice applies and
      closes / Focus after the pick)
- [ ] 9.5 Verify `ArrowDown` from the first tile moves focus one full row down
      at eight columns and at four. **(e2e)** (Req: hero-picker — Picker is
      operable from the keyboard alone / Arrows move by row)
- [ ] 9.6 Verify typing a letter while a tile has focus appends it to the
      query and returns focus to the field. **(e2e)** (Req: hero-picker —
      Picker is operable from the keyboard alone / Typing returns to the
      search field)
- [ ] 9.7 Verify `B` while the picker is open opens no second picker and types
      into the search field. **(e2e)** (Req: draft-session — Keystrokes route
      to the topmost context)
- [ ] 9.8 Verify a reload with the picker open restores the board with the
      picker closed. **(e2e)** (Req: hero-picker — The picker is never
      persisted)
- [ ] 9.9 Verify a reset on an incomplete draft asks first, and that `Esc` on
      that dialog changes nothing. **(e2e)** (Req: draft-session — Reset /
      Incomplete draft asks first)
- [ ] 9.10 Verify reset → reload inside the toast window → the header `Undo`
      still restores the draft. **(e2e)** (Req: draft-session — One level of
      undo / Undo survives a reload inside the window)
- [ ] 9.11 Verify the picker at 390px does not scroll the page horizontally.
      **(e2e)** (Req: hero-picker — Full-screen picker on a narrow viewport)

## 10. Gates

- [ ] 10.1 `bun test` green; `tsc --noEmit` clean; `biome check` clean.
- [ ] 10.2 `/zombies` in diff mode over the branch; every finding becomes a
      test or an **(e2e)** bullet here, or is recorded as skipped with a
      reason.
- [ ] 10.3 No `/warm` gate — this change adds no dependency; state that in the
      PR rather than running it.
- [ ] 10.4 `/triage` suggested to the user before the PR is opened.
- [ ] 10.5 `PLAN.md` updated: 2c marked done, Phase 2 closed, any decision
      taken during apply recorded.
