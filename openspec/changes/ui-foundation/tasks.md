# UI foundation — tasks

Test tasks are derived from the proposal-stage `/zombies` run and are written
before the module they cover (docs/testing.md — TDD for edge cases). Bullets
marked **(e2e)** are not written here: they are the enumerated target for
Task 4's Playwright smoke suite.

## 1. Toolchain and entry point

- [x] 1.1 Add `preact` as the first runtime dependency (`bun add preact`);
      run `/warm` on the manifest change before anything else lands. (Req:
      app-shell — Single screen, state derived from data)
- [x] 1.2 Add `index.html` at the repo root plus `src/app/main.tsx` mounting
      a Preact root; `bun ./index.html` serves it. (Req: app-shell — Single
      screen, state derived from data / No navigation surface)
- [x] 1.3 Set `tsconfig.json` `"jsx": "react-jsx"`, `"jsxImportSource":
      "preact"`, and add `DOM` + `DOM.Iterable` to `lib`; `tsc --noEmit`
      stays clean. (Req: app-shell — Single screen)
- [x] 1.4 Add `dev` (`bun ./index.html`) and `build` (`bun build
      ./index.html --outdir=dist --minify`) scripts; add `dist/` to
      `.gitignore` before the first build runs. (Req: app-shell — Static
      production build)
- [x] 1.5 Verify `dist/` served by a plain static file server loads and
      reaches Setup with no other process running. **(e2e)** (Req:
      app-shell — Static production build / Build output is self-contained)

## 2. Design tokens and self-hosted fonts

- [x] 2.1 Copy `styles.css` and `tokens/{colors,typography,spacing}.css`
      from the design project into `src/app/styles/` verbatim. (Req:
      app-shell — Style values come from design tokens)
- [x] 2.2 Commit IBM Plex Sans and IBM Plex Mono variable `woff2` files
      under `src/app/styles/fonts/` with their OFL licence; replace the
      Google Fonts `@import` in `typography.css` with `@font-face` rules
      using `url()` + `font-display: swap`. (Req: app-shell — No
      third-party runtime requests / Fonts are self-hosted)
- [x] 2.3 Add the base page styles (page background, UI font, dark colour
      scheme) using only `var(--token)` references. (Req: app-shell — Style
      values come from design tokens)
- [x] 2.4 Test: no hex, `rgb()`, or `rgba()` literal exists in any CSS
      outside `src/app/styles/tokens/`. (Req: app-shell — Style values /
      No literal colours outside the token files)
- [x] 2.5 Test: no `@import` or `url()` in the app's CSS names a host other
      than the app's own origin. (Req: app-shell — No third-party runtime
      requests)

## 3. Storage wrapper

- [x] 3.1 Tests for the wrapper: `getItem` throwing returns absent rather
      than propagating; `setItem` throwing (quota, disabled storage) is
      swallowed; a round-trip returns the stored value. (Reqs:
      draft-session — Session persists / Storage unavailable;
      snapshot-delivery — Last good snapshot cached / Cache write is
      rejected)
- [x] 3.2 Implement the wrapper both the session store and the snapshot
      cache use — every `localStorage` access in the app goes through it.
      (Reqs: same as 3.1)

## 4. Snapshot delivery

- [x] 4.1 Tests for shape validation: a payload missing `snapshotId`,
      missing `patch.id`, missing `createdAt`, or with an empty `heroes`
      array is rejected; the shipped fixture is accepted. (Req:
      snapshot-delivery — Snapshot is fetched from a URL / Malformed
      payload)
- [x] 4.2 Tests for fetch-and-cache: a valid response becomes the active
      bundle and is written to the cache key; a fetch rejection with a warm
      cache yields the cached bundle; a non-JSON body falls back to the
      cache; a corrupt cached value is treated as no cache; a rejection
      with a cold cache yields the error state. (Req: snapshot-delivery —
      Last good snapshot cached, all three scenarios)
- [x] 4.3 Tests for the header formatter: `patch.id = "7.41d"` +
      `createdAt = "2026-07-19T03:00:00Z"` → `patch 7.41d · snapshot Jul
      19`; the 1st of a month renders `Jul 1`, not `Jul 01`; a
      `createdAt` near a UTC day boundary formats from the date the field
      carries, not the viewer's local shift. (Req: snapshot-delivery —
      Header shows snapshot provenance)
- [x] 4.4 Implement `src/app/snapshot.ts`: `import snapshotUrl from
      "../fixtures/snapshot.json" with { type: "file" }`, one fetch per
      page lifetime, shape validation, cache read/write through the 3.2
      wrapper, and the `{ bundle | error }` result the app renders from.
      (Reqs: snapshot-delivery — Snapshot is fetched from a URL; Last good
      snapshot cached)
- [x] 4.5 Header component: product name in plain type (no logo asset
      exists), the provenance line, and the `new patch — stats are still
      stabilizing` banner rendered only while `stabilizing` is `true`.
      (Reqs: snapshot-delivery — Header shows snapshot provenance;
      Stabilizing banner)
- [x] 4.6 Error state: message plus a retry control that re-runs the fetch
      without reloading the page, announced with `role="status"`. (Req:
      snapshot-delivery — Last good snapshot cached / Fetch fails with a
      cold cache)
- [x] 4.7 Test: a bundle whose `snapshotId` differs from the cached one
      becomes active and leaves the stored session untouched. (Req:
      snapshot-delivery — A newer snapshot never destroys the session)

## 5. Session store

- [x] 5.1 Tests for restore: no stored value → `EMPTY_SESSION()`; a stored
      v1 session round-trips deeply equal; unparseable JSON, a non-object
      (`"null"`, `"[]"`, `"7"`), and `v: 2` are each discarded for an empty
      session without throwing. (Req: draft-session — Session state shape;
      Session persists across reloads / Corrupt stored value)
- [x] 5.2 Tests for the persisted shape: the written value carries `v`,
      `createdAt`, `side`, `myRole`, `bans`, all five `teamPicks` keys, and
      `enemyPicks` — no key omitted when its value is `null` or empty.
      (Req: draft-session — Session persists across reloads)
- [x] 5.3 Tests for hotkey mapping: `R`/`r` → radiant and `D`/`d` → dire;
      each digit `1`–`5` and each letter `C M O S F` maps to its role, and
      digit and letter agree for every role; `6` and `X` change nothing;
      re-pressing the selected side leaves it selected; Ctrl-, Meta-, and
      Alt-held keystrokes change nothing and are not `preventDefault`ed.
      (Reqs: draft-session — Side selection; Role selection)
- [x] 5.4 Test: two changes in sequence (side then role) both survive to
      storage — the second write does not drop the first field. (Req:
      draft-session — Session persists across reloads)
- [x] 5.5 Test: setting `side` leaves `bans`, `teamPicks`, and `enemyPicks`
      untouched. (Req: draft-session — Setup collapses / Side and role stay
      editable)
- [x] 5.6 Implement `src/app/session.ts`: the pure hotkey→action mapping,
      the setters, restore/validate, and the write-through-3.2 persistence;
      plus the `useSession()` hook wrapping it. (Reqs: draft-session —
      Session state shape; Side selection; Role selection; Session persists
      across reloads)

## 6. Setup screen and session-editor strip

- [x] 6.1 Side and role controls as `fieldset` + `legend` +
      `input[type=radio]` + `label`, styled with `appearance: none` to the
      design's chip look, hotkey hint in a `kbd`-styled `span`. (Reqs:
      draft-session — Side selection; Role selection)
- [x] 6.2 Document-level `keydown` listener wired to the 5.6 mapping,
      ignoring events that carry Ctrl, Meta, or Alt. (Reqs: draft-session —
      Side selection / Modified keystrokes are ignored; Role selection)
- [x] 6.3 Centered Setup block while `side` or `myRole` is `null`; the same
      controls as the inline header strip once both are set, with no
      confirm step and no other session field touched. (Req: draft-session
      — Setup collapses into the session-editor strip, both scenarios)
- [x] 6.4 Verify the controls expose a named radio group to assistive
      technology, are operable by keyboard alone, and keep a visible focus
      state. **(e2e)** (Req: app-shell — Single screen)
- [x] 6.5 Verify choosing side then role collapses Setup into the strip in
      one update, and that a reload restores both. **(e2e)** (Reqs:
      draft-session — Setup collapses; Session persists across reloads)
- [x] 6.6 Verify that with the snapshot route unreachable and no cache, the
      error state appears and retry recovers without a page reload.
      **(e2e)** (Req: snapshot-delivery — Fetch fails with a cold cache)

## 7. Gates

- [x] 7.1 `bun test` green; `tsc --noEmit` clean; `biome check` clean.
- [x] 7.2 `/warm` report on `preact` shown and accepted (from 1.1).
- [x] 7.3 `/zombies` in diff mode over the branch; every new or `[partial]`
      finding becomes a test or an explicit user decision to skip. Four
      findings were real defects and were fixed at the root (snapshot date
      and hero-entry validation, stored-session shape validation, radio hit
      area); ten became tests (`static-routes.test.ts`, `build.test.ts`, and
      additions to the snapshot and session suites); three went to Task 4 as
      **(e2e)**. Two were deliberately skipped:
      - IME composition (`event.isComposing`) is not checked by the hotkey
        layer — no text input exists until the picker, and proposal 3 owns
        hotkey context routing, which supersedes a per-key guard.
      - The double-retry race cannot occur: activating retry clears the
        result, which unmounts the error state and its button.
- [x] 7.4 Architecture delta presented (the app is a new module boundary),
      then `/triage` suggested to the user before the PR is opened.
- [x] 7.5 `PLAN.md` updated: Phase 2 split into three proposals, this one
      marked done, Task 4's e2e set pointed at the **(e2e)** tasks above.
