# captains-mode-assistant — tasks

Thirteen steps, thirteen pull requests, in this order, each on
`feat/captains-mode-assistant-<n>`. Each names the criteria it closes by their
`<capability>/<scenario-slug>` identifiers. Tests come first in every step;
the ZOMBIES numbers refer to the proposal-stage run recorded in the body of
the pull request that added this file.

The two `MODIFIED` deltas carry six criteria this change does not close —
every scenario their requirements already had, closed by tests on `main`:
  `app-shell/no-navigation-surface`,
  `app-shell/screen-composition-follows-the-data`,
  `app-shell/build-output-is-self-contained`,
  `module-boundaries/the-model-reaches-into-the-app`,
  `module-boundaries/the-app-imports-the-model`,
  `module-boundaries/a-type-only-import-back-into-the-app`.

## 1. The CM API and signing in

Closes `cm-access/signing-in-with-the-password`,
`cm-access/a-request-without-a-valid-session`,
`cm-access/no-password-configured`.

- [x] 1.1 Add `hono`, `zod` as exact-pinned dependencies and run `/warm` on
      them; `bun audit` stays clean.
- [x] 1.2 Write the failing cases first in `src/server/cm-access.test.ts`
      (ZOMBIES 1, 2, 3, 6, 7, 8, 11, 12, 13): sign-in 204 with the five cookie
      attributes; `GET /api/cm/session` shape with `expiresAt` 30 days on;
      401 for no cookie, empty cookie, tampered signature, a non-numeric
      expiry, a cookie signed with another key, one expired a second ago
      (one expiring in a second passes); a changed password; 503 for unset,
      empty, 12 spaces and 11 characters, 12 characters configuring it; 422
      `invalid-body` for non-JSON and a missing `password`; every problem
      body carrying all six fields.
- [x] 1.3 Implement the Hono app under `src/server/cm/` (configuration,
      session cookie per design D2, problem responses per D4, the sign-in
      body limit and `no-store` per D4) and mount it for `/api/cm` and
      `/api/cm/*` in `server.ts`'s `fetch` ahead of `distFile`; the 1.2
      cases pass.
## 2. Hardening the sign-in

Closes `cm-access/repeated-wrong-passwords`,
`cm-access/a-request-from-another-origin`,
`deployment-topology/the-password-in-the-compose-file`.

- [x] 2.1 Failing cases first (ZOMBIES 4, 5, 9, 10, 14): the tenth wrong
      password is 401 and the eleventh 429 with `Retry-After` in 1–900, the
      right password included; a failure exactly 900 s old no longer counts
      (clock injected); a session signed in before the ten stays signed in;
      a foreign `Origin` is 403 before the limiter counts
      it; no response carries `Access-Control-Allow-Origin`; an unknown
      `/api/cm/` path is 404 `not-found`.
- [x] 2.2 Implement the limiter (in-memory sliding window, design D2) and the
      origin middleware; the cases pass.
- [x] 2.3 Pass `CM_PASSWORD` to the application service in
      `docker-compose.yml` and name it in `.env.example`; extend
      `checks/deployment-topology.test.ts` for it. Name setting it on the
      host in the pull request body's preflight list.

## 3. The CM page and its sign-in screen

Closes `cm-access/signing-out`,
`app-shell/the-all-pick-page-never-reaches-the-cm-api`,
`app-shell/the-cm-page-on-a-static-host`.

- [x] 3.1 Add `cm.html` and `src/cm/main.tsx`; the build script and
      `scripts/dev.ts` take both entry points; `distFile` maps `/cm` to
      `cm.html`; `src/server/build.test.ts` asserts both are emitted.
- [x] 3.2 Failing cases first (ZOMBIES 15, 24): the form announces a wrong
      password through `role="alert"` and keeps focus; 503 and 429 are shown
      from their `code`; `DELETE /api/cm/session` answers 204 and clears the
      cookie, and sign-in, read, sign-out work in sequence.
- [x] 3.3 Implement `DELETE /api/cm/session`, the sign-in screen under
      `src/cm/ui/` and a sign-out control; Playwright's `webServer` gets a
      test `CM_PASSWORD`; e2e `e2e/cm.spec.ts`: wrong then right password
      reaches the page on `/cm`, sign-out returns to the form; `/` makes no
      `/api/cm/` request; the axe scan covers the sign-in state.
- [x] 3.4 An unreachable API shows "unavailable" instead of the form;
      `e2e/static-build.spec.ts` covers `cm.html` on the static server.
      (Moved from step 4: this step ships the state, and the criterion it
      closes in its place, signing in from the page, needs the setup step 4
      adds.)

## 4. Setup and rosters

Closes `cm-draft/setup-collapses-into-the-board`,
`cm-draft/editing-the-captain-s-roster`,
`cm-draft/signing-in-from-the-page`.

- [x] 4.1 Failing cases first in `src/cm/ui/session.test.ts` (ZOMBIES 16, 17,
      21, 22): the `CmSession` reducer — side and pick order independent;
      nickname 24 accepted, 25 and whitespace-only refused; a duplicate
      position on either team unsets the first; the 10-signature
      limit; a stored session that fails to parse falls back to empty.
- [x] 4.2 Implement the session type and reducer, the setup block and both
      roster panels (signature heroes through the existing picker); the
      board appears once side and pick order are set with step 1 marked.
- [x] 4.3 E2e: a wrong password on `/cm` is announced and keeps focus, and
      the right one replaces the form with the setup, on `/cm` and without a
      page load. (Task 4.3's old content moved to 3.4.)

## 5. The draft order

Closes `cm-draft/the-order-from-the-second-pick`,
`cm-draft/a-banned-hero-offered-again`, `cm-draft/undoing-a-pick`.

- [x] 5.1 Failing cases first (ZOMBIES 18, 19, 20, 25, 27): the order table
      holds 7 bans and 5 picks per team as the spec's table gives; a hero
      fills only the step in progress; a taken hero is refused; undo from 24
      back to 1 restores each state; nothing is entered after step 24; the
      step in progress names its team and action accessibly.
- [x] 5.2 Implement the order as one data table under `src/cm/engine/`, the
      board's step strip, bans and picks rows, and undo.
- [x] 5.3 From step 4 (its diff at the cap): lift `focusAfterPick` into the
      picker module and focus a signature pick's add control, or its new tile
      at ten; e2e: the pick shows, its tile removes it, ten disables adding.

## 6. Keeping the draft

Closes `cm-draft/reloading-mid-draft`, `cm-draft/resetting-the-draft`.

- [x] 6.1 Failing cases first (ZOMBIES 28, 29): `cm.session` round-trips;
      reset keeps setup and rosters; the All Pick key is untouched; e2e:
      sign in, set up, enter ten steps, reload, resume at step 11, keyboard
      alone (ZOMBIES 26).
- [x] 6.2 Implement persistence and reset.

## 7. Valuing a team

Closes `cm-model/valuing-a-team`,
`cm-model/a-signature-hero-outranks-an-equal-one`,
`module-boundaries/the-cm-engine-reaches-into-its-page`.

- [x] 7.1 Extend `biome.json`'s restricted imports to `src/cm/engine/**`
      (no `src/app/**`, no `src/cm/ui/**`); a lint fixture case shows the
      restriction fires and that `src/model.ts` imports pass.
- [x] 7.2 Failing cases first in `src/cm/engine/value.test.ts` (ZOMBIES 23,
      30, 31, 34): empty draft 0; CM phases `p1`/`p2`/`p2`/`last`; signature
      +3.0 × ρ, 3.3 at rank 6 of mean 5; clamp 0.75 and 1.25; unknown ranks
      weigh 1; a synergy pair counted once.
- [x] 7.3 Implement the team value (design D7) reusing `src/model.ts`'s
      lane-weighted matchup; add `src/cm/engine/` to Stryker's `mutate`
      with its stored result and floor.

## 8. Assignment and first suggestions

Closes `cm-model/a-flexible-hero-takes-the-open-slot`,
`cm-model/components-add-up-to-the-score`.

- [x] 8.1 Failing cases first (ZOMBIES 32, 33, 35, 36, 38, 39, 40): the best
      of 120 assignments beats a greedy one on a constructed five; share 0.05
      playable and 0.049 not; off-role −10 keeps the assignment defined;
      components sum to the score within 0.05; ban components are the
      enemy's; fewer than five eligible heroes return that many.
- [x] 8.2 Implement the assignment and the immediate ranking (depth 1,
      computed synchronously for now) under `src/cm/engine/`.
## 9. The board reads the draft

Split from step 8, which together stood at 998 lines of the 800-line budget.

Closes `cm-model/the-assignment-is-shown`, `cm-model/an-enemy-step`.

- [x] 9.1 The board shows each pick's position and player, and the top five
      for the step in progress with their components; on an enemy step the
      list is headed as the enemy's expected choices with no enter control.

## 10. Off the main thread

Closes `cm-model/entering-two-steps-quickly`.

- [ ] 10.1 Failing cases first (ZOMBIES 41): a result for an older `stateId`
      is dropped.
- [ ] 10.2 Move the ranking into a Web Worker with `stateId` messages and
      restart-on-newer (design D6); e2e: two steps 100 ms apart show only the
      second state's suggestions.

## 11. Looking ahead

Closes `cm-model/a-ban-that-would-hand-the-enemy-a-better-pick`,
`cm-model/the-search-answers-within-its-budget`.

- [ ] 11.1 Failing cases first in `src/cm/engine/search.test.ts` (ZOMBIES
      37, 42, 43): the constructed ban fixture ranks Y above X; deepening
      returns the last completed depth when the budget ends mid-iteration
      (clock injected); depth ≥ 2 within 1700 ms on the full snapshot
      fixture.
- [ ] 11.2 Implement alpha-beta with the beam, greedy completion and
      iterative deepening (design D8) behind the worker; the board shows the
      depth reached.

## 12. Uploading d2pt meta

Closes `cm-meta-import/a-valid-upload-for-one-position`,
`cm-meta-import/an-upload-that-is-not-the-meta-file`,
`deployment-topology/the-store-in-the-compose-file`.

- [ ] 12.1 Add `devalue` exact-pinned and run `/warm`; commit a trimmed real
      d2pt data file as `src/fixtures/d2pt-meta-pos3.json`. (`devalue` was
      pinned with the other planned dependencies; the real file waits on a
      captain's browser — the reader is tested on a synthetic file meanwhile,
      `src/server/cm/d2pt.fixture.ts`.)
- [x] 12.2 Mount the `cm` volume on the application alone at
      `/app/cm-data`, set `CM_DATA_DIR: /app/cm-data` literally in its
      compose environment (as the job's `BUNDLE_DIR` is), create the
      directory owned by the runtime user in the `Dockerfile`, and extend
      `checks/deployment-topology.test.ts` to pin the mount and the variable
      to one path — in this step, so no upload it accepts lives in a
      container's writable layer.
- [x] 12.3 Failing cases first in `src/server/cm-meta.test.ts` (ZOMBIES 45,
      46, 47, 48, 49, 50): 5 MB accepted for parsing and 5 MB + 1 refused
      413; 50 known rated heroes accepted, 49 refused, 50 known heroes with
      null ratings refused; ratings 0, 100, null valid, 100.1 refused,
      all-equal refused; mixed positions refused with the store unchanged;
      every hero field present; a write interrupted before its rename leaves
      the previous upload.
- [x] 12.4 Implement `POST` and `GET /api/cm/meta` (design D4, D5) with the
      atomic per-position store under `CM_DATA_DIR`.

## 13. The model reads the upload

Closes `cm-meta-import/nothing-uploaded-yet`,
`cm-meta-import/one-position-uploaded`,
`cm-meta-import/the-page-names-where-its-meta-comes-from`.

- [ ] 13.1 Failing cases first (ZOMBIES 44, 51): `GET /api/cm/meta` with an
      empty store answers all five positions `null`, and the page then shows
      the snapshot as every position's source; position 1 uploaded maps
      rating 50 to 0 with the std-matched scale and positions 2–5 equal the
      snapshot's; a null rating makes the hero unplayable there.
- [ ] 13.2 Implement the mapping (design D9), the page's meta panel with the
      five d2pt links and the multi-file upload, and the fetch of
      `/api/cm/meta` after sign-in.
- [ ] 13.3 Move the D2ASS card to `applied` once this pull request merges.
