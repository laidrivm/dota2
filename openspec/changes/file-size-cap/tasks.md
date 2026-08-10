# file-size-cap — tasks

Nine steps, nine pull requests, in this order. Eight of them close no
acceptance criterion: they are the decomposition the cap costs, and each one
leaves the application working and every test green. The ninth adds the cap and
closes all five criteria at once, which is only possible because the eight
before it brought the tree under the line.

The order is deliberate. CSS first, because it changes how styles are delivered
and everything after it should run against the finished mechanism; then the
three source splits, each with its test file; then the three test files that
split on their own; then the cap.

`/zombies` in diff mode runs before each pull request, per the pre-PR sequence.
Only step 9 introduces logic for it to find; the test tasks in steps 1–8 are
the existing suites, which must stay green unchanged except where a file is
renamed.

## 1. Styles arrive through the bundle

- [ ] 1.1 Import `src/app/styles/styles.css` from `src/app/main.tsx` and drop
      the `<link rel="stylesheet">` from `index.html`, leaving the `@import`
      chain and every rule exactly as they are — this step changes the delivery
      path and nothing else
- [ ] 1.2 Update `build.test.ts`, which globs `*.css` in `dist` and asserts on
      the single emitted stylesheet; confirm the `@import url("/fonts/fonts.css")`
      assertion still holds, since fonts stay a served file
- [ ] 1.3 Run the e2e suite and confirm the rendered page is unchanged — this
      is the step where a mistake is a blank stylesheet, which is loud

## 2. The first components own their styles

- [ ] 2.1 Move the `hero tile` and `re-pick marker` blocks out of `app.css`
      into `src/app/board/hero-tile.module.css`, imported by `hero-tile.tsx`;
      each explanatory comment moves with the rules it describes
- [ ] 2.2 Move the `picker and dialogs` block into
      `src/app/picker/picker.module.css`
- [ ] 2.3 Confirm no rule was left behind and none duplicated: `app.css` shrinks
      by exactly the lines the two modules gained, comments included

## 3. The board owns its styles

- [ ] 3.1 Move the `board`, `bans`, `teams`, `suggestions` and `result` blocks
      into `src/app/board/board.module.css`
- [ ] 3.2 Move the one-column rule under `/* One column: the board has to fit a
      phone… */` with the rules it governs, splitting it per module rather than
      leaving a media query orphaned in `app.css`

## 4. The shell owns its styles, and app.css goes

- [ ] 4.1 Move the header, side, setup and undo-toast blocks into
      `header.module.css`, `session-controls.module.css` and
      `app.module.css` beside their components
- [ ] 4.2 Delete `src/app/styles/app.css` and its `@import`; `styles.css` is
      left with tokens and `base.css`, the global layer that has no class to
      scope
- [ ] 4.3 Rescope the token check in `src/app/styles/styles.test.ts`: glob every
      tracked `*.css` in the repository and exempt `tokens/`, rather than
      enumerating one directory — a moved stylesheet must not leave the
      no-colour-literal assertion silently. Add the guard that the sweep found
      more than zero files
- [ ] 4.4 Break the rescoped check before trusting it: put a hex literal in a
      component module and watch it fail

## 5. `src/app/session.ts` splits

- [ ] 5.1 Move the keyboard layer — `SIDE_KEYS`, `ROLE_KEYS`, `unmodified`,
      `hotkeyContext`, `ownsKeystroke`, `closesEditor`, `hotkeyFor` — into
      `src/app/hotkeys.ts`, leaving session state and its reducer behind
- [ ] 5.2 Split `src/app/session.test.ts` along the same seam into
      `hotkeys.test.ts` and a smaller `session.test.ts`; both files land under
      300 lines or the seam was wrong

## 6. `scripts/command-guard.ts` splits

- [ ] 6.1 Move the shell-line parser — `SEPARATORS`, `commands`, `WRAPPERS`,
      `SHELLS`, `invocation` — into `scripts/command-parse.ts`, leaving the git
      and `gh` prohibitions in `command-guard.ts`
- [ ] 6.2 Split `scripts/command-guard.test.ts` along the same seam
- [ ] 6.3 Confirm the hook still blocks: run the guard against one command it
      must refuse and one it must allow, since this file is a safety gate and a
      refactor that quietly stops refusing is the failure that matters

## 7. `src/app/board/board.tsx` splits

- [ ] 7.1 Move `BansRow` into `src/app/board/bans.tsx`, `TeamPanel` and
      `EnemyPanel` into `panels.tsx`, and `Suggestions` with `Result` into
      `suggestions.tsx`; `board.tsx` keeps `Board` and the pieces more than one
      of them uses — `PickEntry`, `RemoveButton`, `RepickBadge`, `ThinBadge`
- [ ] 7.2 Before moving a shared piece, grep for the logic it duplicates
      elsewhere rather than moving a near-copy
- [ ] 7.3 Run the e2e suite: this file has no unit test by design, so e2e is the
      only thing that will notice a panel that stopped rendering

## 8. The remaining test files split

- [ ] 8.1 Split `scripts/diff-budget.test.ts` (448) by what it exercises —
      the counting rules, the task-line pairing, and the override marker
- [ ] 8.2 Split `src/model.test.ts` (425) by the model spec's sections — enemy
      role inference, scoring, and the win estimate
- [ ] 8.3 Split `agent-permissions.test.ts` (347) by the policy areas it reads
- [ ] 8.4 Confirm the total test count is unchanged across all three splits: a
      test lost in a move is the one failure a green run cannot show

## 9. The cap

- [ ] 9.1 Write the check's tests first, all failing: a 301-line `.ts` file
      fails naming file, count and cap (*A file over the cap*); a 300-line one
      passes; a 201-line `.css` fails (*A stylesheet over the cap*); a
      200-line one passes
- [ ] 9.2 Write the scope tests first: a `*.test.ts` file over the cap fails
      like any other (*A test file is not exempt*); an untracked 400-line file
      does not fail the check (*An untracked file over the cap*); a `.md`,
      `.json` or `.yml` file over 300 lines does not fail it
- [ ] 9.3 Write the sweep guard's test: a run that found zero files fails
      rather than passing every assertion vacuously
- [ ] 9.4 Implement the check as `scripts/file-size.test.ts`, reading the file
      list from `git ls-files` so an untracked file is out of scope and a
      gitignored one cannot pass locally and fail in a clone; break each
      assertion above before it passes
- [ ] 9.5 Run it over the tree and confirm it passes with nothing exempted
      (*The tree as it stands*). A file still over the cap here means a
      previous step's seam was wrong and is fixed there, not exempted here
- [ ] 9.6 Add `scripts/file-size.test.ts` to the README's knowledge ownership
      map, beside `command-guard.ts` and `no-suppressions.ts`
- [ ] 9.7 Update `PLAN.md`: the queue entry asking for an `/opsx:update` on
      `reviewable-diff-gates` is answered — the cap landed here, and the rule of
      two remains outstanding as its own one-line Code rule, which is what the
      archived proposal prescribed for it
- [ ] 9.8 Grep the four sites that restate a claim like this one before calling
      the change done: this change's sibling artefacts, `openspec/specs/**`,
      `PLAN.md` and the README ownership map — searching the wording being
      replaced, not the wording replacing it
