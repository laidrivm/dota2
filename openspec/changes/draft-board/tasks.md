# Draft board — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). Bullets
marked **(e2e)** are the run's `(e2e candidate)` findings: they are specified
here, verified by hand against a running app during apply, and are Task 4's
Playwright target.

## 1. Design tokens

- [x] 1.1 Add `--tile-ink-dark: #1b1d12`, `--tile-ink-light: #f4f3fb`, and
      `--hero-fallback: #3a4250` to `src/app/styles/tokens/colors.css`. (Req:
      draft-board — Hero tile; app-shell — Style values come from design
      tokens)
- [x] 1.2 Push the same three lines to the design project's
      `tokens/colors.css` so `src/app/styles/` stays a verbatim copy. (Req:
      draft-board — Hero tile)

## 2. Session reducer

- [x] 2.1 Tests for bans: `banAdd` appends last; `banRemove` at index 1 of
      three preserves the order of the other two; removing from an empty
      `bans` changes nothing; `banAdd` is refused at exactly
      `heroes.length - 10` and accepted one below. (Req: draft-session — Ban
      list, all three scenarios)
- [x] 2.2 Tests for team picks: `teamSet` on role 2 leaves the other four
      `null`; `teamSet` on an occupied role replaces rather than appends;
      `teamClear` on role 4 leaves the other four unchanged; `teamClear` on an
      already-empty role changes nothing. (Req: draft-session — Team picks,
      both scenarios)
- [x] 2.3 Tests for enemy picks: `enemyAdd` appends; `enemyRemove` at index 0
      of three preserves the relative order of the rest; a sixth `enemyAdd` is
      refused. (Req: draft-session — Enemy picks, all three scenarios)
- [x] 2.4 Tests for single occupancy: a hero in `teamPicks` cannot be banned;
      a hero in `bans` cannot be set as a team pick; a hero in `enemyPicks`
      cannot be added twice. (Req: draft-session — A hero occupies at most one
      position)
- [x] 2.5 Tests for the reducer contract: `applyAction` does not mutate its
      argument; eight actions in sequence all survive to `localStorage` with
      no field dropped. (Reqs: draft-session — Team picks; Session persists
      across reloads)
- [x] 2.6 Fold `applyHotkey` into `applyAction(session, action)` over the
      eight-variant union and keep `useSession`'s single write-through
      `persist`. (Reqs: draft-session — Ban list; Team picks; Enemy picks; A
      hero occupies at most one position)

## 3. Formatters and hero tile

- [x] 3.1 Tests for `heroAbbr`: `Zeus` → `ZEUS`; `Keeper of the Light` →
      `KEEP`; `Anti-Mage` → `ANTI` (non-letters stripped before truncating);
      `Io` → `IO` with no padding. (Req: draft-board — Hero tile /
      Abbreviation)
- [x] 3.2 Tests for `tileInk`: `#4a3d85` (luminance 0.065) → light ink;
      `#dce8f2` (0.793) → dark ink; a colour at exactly 0.22 → dark ink.
      (Req: draft-board — Hero tile / Ink follows the background)
- [x] 3.3 Test: every `--hero-*` and `--tile-ink-*` token in
      `src/app/styles/tokens/colors.css` parses to a luminance, and
      `--hero-fallback` is present — a malformed or renamed entry fails the
      suite instead of lettering a tile in the wrong ink. (A contrast floor
      was the original plan and guards nothing here — see design.md.) (Req:
      draft-board — Hero tile)
- [x] 3.4 Tests for score and estimate formatting: `+2.1%` for 2.14; `-0.4%`
      for -0.44; `+0.0%` for 0 with the muted class, not the positive one;
      `formatAdvantage(-3.24)` → `-3.2 pp`; `formatWinProbability(0.585)` →
      `~59% win`. (Reqs: draft-board — Suggestion blocks / Score sign is
      visible; Result block)
- [x] 3.5 Tests for `topRoles`: `{1: .62, 2: .31, …}` → `p1 62% · p2 31%`; a
      second term rounding to `0%` is dropped; ties break by ascending role.
      (Req: draft-board — Enemy slots with inferred roles, first two
      scenarios)
- [x] 3.6 Test: `formatPhase` maps `p1`/`p2`/`last` to `1st`/`2nd`/`last`.
      (Req: draft-board — Suggestion blocks)
- [x] 3.7 Implement the formatters and `tileInk`/`relativeLuminance` as pure
      functions in `src/app/board/`. (Reqs: as 3.1–3.6)
- [x] 3.8 Implement the hero tile component: three sizes, abbreviation,
      `--hero-<short>` background resolved through `getComputedStyle` and
      memoized by slug, `--hero-fallback` when the token is absent, ink from
      3.7, accessible name naming the hero. (Req: draft-board — Hero tile, all
      four scenarios)

## 4. Header, editor, and hotkey context

- [x] 4.1 Test: side and role hotkeys change the session while the Setup block
      is shown or the editor is open, and change nothing while the board is
      shown with the editor closed. (Reqs: draft-session — Side selection /
      Board is not an active context; Role selection / Board is not an active
      context)
- [x] 4.2 Test: `Esc` closes the editor and touches no session field. (Req:
      draft-session — Setup collapses into the session-editor strip / Editor
      closes on Esc)
- [x] 4.3 Rebuild the header: `New` (disabled — 2c owns reset), side · role as
      text with the `edit` affordance, provenance and the stabilizing banner
      as before. (Req: draft-session — Setup collapses into the
      session-editor strip)
- [x] 4.4 Editor panel toggled by the affordance, reusing `SessionControls`,
      closing on `Esc`. (Req: draft-session — Setup collapses / Side and role
      stay editable)
- [x] 4.5 Scope the document-level `keydown` listener to the active context
      per 4.1. (Reqs: draft-session — Side selection; Role selection)

## 5. Board panels

- [x] 5.1 Call `computeModel` in a `useMemo` keyed on the session and snapshot
      identities, with the `ponytail:` comment naming the worker upgrade path.
      (Req: draft-board — Model output is recomputed on every session change,
      both scenarios)
- [x] 5.2 Board composition: header → bans → team panels → suggestions or
      result, with panel order and panel headers driven by `session.side`.
      (Req: draft-board — Board composition, all three scenarios)
- [x] 5.3 Bans row: tiles in insertion order, per-ban removal, pick-entry
      control disabled with a title at `heroes.length - 10`. (Req:
      draft-board — Bans row, all three scenarios)
- [x] 5.4 My-team panel: five role slots, star and accent on `myRole`, filled
      slot with tile + name + removal, empty slot with the pick-entry control,
      `insufficient data` badge on a thin hero. (Req: draft-board — My-team
      slots, all four scenarios)
- [x] 5.5 Enemy panel: five slots, filled slot with tile + name + `topRoles`
      + removal, empty slot with the pick-entry control. (Req: draft-board —
      Enemy slots with inferred roles, all three scenarios)
- [x] 5.6 Suggestions panel: one block per open role, `myRole` first with the
      star and accent row, chips of tile + signed score, chip activation picks
      that hero for that role, phase indicator. (Req: draft-board —
      Suggestion blocks, all four scenarios)
- [x] 5.7 Result block and the `Add enemy picks to see win probability` hint.
      (Req: draft-board — Result block, all three scenarios)
- [x] 5.8 Verify a session holding a hero id absent from the snapshot renders
      the board without throwing and falls back on that slot. **(e2e)** — the
      branch is `getComputedStyle` and markup, so there is nothing a
      DOM-less test can assert (docs/testing.md routing). (Req: draft-board —
      Hero tile / Hero missing from the snapshot)
- [x] 5.9 Pick-entry control: a labelled native `<select>` per empty slot and
      for the bans row, offering only unused heroes in ascending name order
      and dispatching the 2.6 actions. Marked in code as replaced by the
      picker in proposal 2c. (Req: draft-board — Pick entry, both scenarios)

## 6. Layout and accessibility

- [x] 6.1 Desktop two-column board styles from the design tokens only — no
      literal values outside `tokens/`. (Reqs: draft-board — Board
      composition; app-shell — Style values come from design tokens)
- [x] 6.2 One-column layout at `max-width: 720px`: stacked team panels, enemy
      probabilities under the hero name, bans row and suggestion rows as
      `overflow-x: auto` strips with `::scroll-button`s and no entry omitted.
      (Req: draft-board — One-column layout on a narrow viewport, both
      scenarios)
- [x] 6.3 Removal controls: real buttons with hero-naming accessible names,
      revealed on `:hover, :focus-within`, always-visible corner badge in the
      one-column layout. (Req: draft-board — Removal controls are reachable)
- [x] 6.4 Verify at 390px that the page has no horizontal scroll and the bans
      strip scrolls on its own. **(e2e)** (Req: draft-board — One-column
      layout / 390px board)
- [x] 6.5 Verify tabbing to a filled slot's removal control makes it visible
      with a focus ring. **(e2e)** (Req: draft-board — Removal controls are
      reachable / Keyboard reveal)
- [x] 6.6 Verify a suggestion row that overflows is scrollable by keyboard.
      **(e2e)** (Req: draft-board — One-column layout / Scroll strips are
      operable without a pointer)

## 7. Journeys verified during apply

- [x] 7.1 Verify picking from the Carry block lands the hero in the Carry slot
      and removes that block. **(e2e)** (Req: draft-board — Suggestion blocks
      / A suggestion is a one-click pick)
- [x] 7.2 Verify the tenth pick replaces suggestions with the result block.
      **(e2e)** (Req: draft-board — Result block / Full draft)
- [x] 7.3 Verify five team picks with incomplete enemies show the hint and no
      win probability. **(e2e)** (Req: draft-board — Result block / Team
      complete, enemies not)
- [x] 7.4 Verify switching side on a full board keeps every pick, swaps panel
      order, and recomputes the result. **(e2e)** (Req: draft-board — Model
      output is recomputed / Editing side with a full board)
- [x] 7.5 Verify a reload restores every ban, team pick, and enemy pick.
      **(e2e)** (Req: draft-session — Session persists across reloads)
- [x] 7.6 Verify `3` on the board changes nothing and `3` with the editor open
      changes the role. **(e2e)** (Req: draft-session — Role selection / Board
      is not an active context)

## 8. Gates

- [ ] 8.1 `bun test` green; `tsc --noEmit` clean; `biome check` clean.
- [ ] 8.2 `/zombies` in diff mode over the branch; every new or `[partial]`
      finding becomes a test or an explicit user decision to skip.
- [ ] 8.3 No `/warm` gate — this change adds no dependency; state that in the
      PR rather than running it.
- [ ] 8.4 `/triage` suggested to the user before the PR is opened.
- [ ] 8.5 `PLAN.md` updated: 2b marked done, 2c named as next, any decision
      taken during apply recorded.
