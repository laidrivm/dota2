# file-size-cap — tasks

Eight steps, eight pull requests, in this order. Seven of them close no
acceptance criterion: they are the decomposition the cap costs, and each one
leaves the application working and every test green. The eighth adds the cap
and closes all five criteria at once, which is only possible because the seven
before it brought the tree under the line.

The order is deliberate. CSS first, because it changes how styles are delivered
and everything after it should run against the finished mechanism; then the
three source splits, each with its test file; then the three test files that
split on their own; then the cap.

Moving a rule counts twice in the diff budget — once removed, once added — so
the 943 lines of `app.css` are ~1900 budgeted lines on their own. That, not
caution, is why the migration takes three steps.

`/zombies` in diff mode runs before each pull request, per the pre-PR sequence.
Only step 8 introduces logic for it to find; the test tasks in steps 1–7 are
the existing suites, which must stay green unchanged except where a file is
renamed. Numbers in brackets in step 8 are `/zombies` items from the pass over
this proposal.

## 1. Styles arrive through the bundle, and the first components own theirs

- [ ] 1.1 Import `src/app/styles/styles.css` from `src/app/main.tsx` and drop
      the `<link rel="stylesheet">` from `index.html`, leaving the `@import`
      chain and every rule exactly as they are — this changes the delivery path
      and nothing else, and it is the commit to bisect to if styles vanish
- [ ] 1.2 Update `build.test.ts`, which globs `*.css` in `dist` and asserts on
      the single emitted stylesheet; confirm the `@import url("/fonts/fonts.css")`
      assertion still holds, since fonts stay a served file
- [ ] 1.3 Move the `hero tile` and `re-pick marker` blocks out of `app.css`
      into `src/app/board/hero-tile.module.css`, imported by `hero-tile.tsx`;
      each explanatory comment moves with the rules it describes
- [ ] 1.4 Move the `picker and dialogs` block into
      `src/app/picker/picker.module.css`
- [ ] 1.5 Rewrite every `class` on the migrated markup to read from the
      imported mapping — `class={s.heroTile}`, not `class="hero-tile"` — in
      `hero-tile.tsx`, `picker.tsx` and wherever else those classes are
      written, `board.tsx`'s re-pick badge included. The bundler rewrites the
      names in the stylesheet, so a literal left behind matches nothing and the
      rule silently stops applying. Every step that moves a block owes this,
      not only this one
- [ ] 1.6 Confirm no rule was left behind and none duplicated: `app.css` shrinks
      by exactly the lines the two modules gained, comments included
- [ ] 1.7 Run the e2e suite and confirm the rendered page is unchanged — a
      mistake here is a blank stylesheet, which is loud

## 2. The board owns its styles

- [ ] 2.1 Move the `board`, `bans`, `teams`, `suggestions` and `result` blocks
      into `src/app/board/board.module.css`
- [ ] 2.2 Move the one-column rule under `/* One column: the board has to fit a
      phone… */` with the rules it governs, splitting it per module rather than
      leaving a media query orphaned in `app.css`

## 3. The shell owns its styles, and app.css goes

- [ ] 3.1 Move the header, side, setup and undo-toast blocks into
      `header.module.css`, `session-controls.module.css` and
      `app.module.css` beside their components
- [ ] 3.2 Delete `src/app/styles/app.css` and its `@import`; `styles.css` is
      left with tokens and `base.css`, the global layer that has no class to
      scope
- [ ] 3.3 Rescope the token check in `src/app/styles/styles.test.ts`: take the
      file list from `git ls-files -z` at the repository root, keep the `*.css`
      entries and exempt `src/app/styles/tokens/`, rather than enumerating one
      directory — a moved stylesheet must not leave the no-colour-literal
      assertion silently. Not a filesystem-wide `Bun.Glob`, which would walk
      `node_modules` and pick up untracked files; the shape is
      `scripts/no-suppressions.ts`'s. Add the guard that the sweep found more
      than zero files
- [ ] 3.4 Break the rescoped check before trusting it: put a hex literal in a
      component module and watch it fail

## 4. `src/app/session.ts` splits

- [ ] 4.1 Move the keyboard layer — `SIDE_KEYS`, `ROLE_KEYS`, `unmodified`,
      `hotkeyContext`, `ownsKeystroke`, `closesEditor`, `hotkeyFor` — into
      `src/app/hotkeys.ts`, leaving session state and its reducer behind
- [ ] 4.2 Split `src/app/session.test.ts` along the same seam into
      `hotkeys.test.ts` and a smaller `session.test.ts`; both files land at 300
      lines or fewer, the cap being inclusive, or the seam was wrong

## 5. `scripts/command-guard.ts` splits

- [ ] 5.1 Move the shell-line parser — `SEPARATORS`, `commands`, `WRAPPERS`,
      `SHELLS`, `invocation` — into `scripts/command-parse.ts`, leaving the git
      and `gh` prohibitions in `command-guard.ts`
- [ ] 5.2 Split `scripts/command-guard.test.ts` along the same seam
- [ ] 5.3 Confirm the hook still blocks, on the terms `CLAUDE.md` sets for
      probing a gate: refuse it with an input this session has not already
      cleared, and report what the call returned rather than what a prompt did.
      One command it must refuse, one it must allow — this file is a safety
      gate, and a refactor that quietly stops refusing is the failure that
      matters

## 6. `src/app/board/board.tsx` splits

- [ ] 6.1 Move `BansRow` into `src/app/board/bans.tsx`, `TeamPanel` and
      `EnemyPanel` into `panels.tsx`, and `Suggestions` with `Result` into
      `suggestions.tsx`; `board.tsx` keeps `Board` and the pieces more than one
      of them uses — `PickEntry`, `RemoveButton`, `RepickBadge`, `ThinBadge`
- [ ] 6.2 Before moving a shared piece, grep for the logic it duplicates
      elsewhere rather than moving a near-copy
- [ ] 6.3 Run the e2e suite: this file has no unit test by design, so e2e is the
      only thing that will notice a panel that stopped rendering

## 7. The remaining test files split

- [ ] 7.1 Split `scripts/diff-budget.test.ts` (448) by what it exercises —
      the counting rules, the task-line pairing, and the override marker
- [ ] 7.2 Split `src/model.test.ts` (425) by the model spec's sections — enemy
      role inference, scoring, and the win estimate
- [ ] 7.3 Split `agent-permissions.test.ts` (347) by the policy areas it reads
- [ ] 7.4 Confirm the total test count is unchanged across all three splits: a
      test lost in a move is the one failure a green run cannot show

## 8. The cap

- [ ] 8.1 Write the check's tests first, all failing: a 301-line `.ts` file
      fails naming file, count and cap (*A file over the cap*); a 300-line one
      passes; a 201-line `.css` fails (*A stylesheet over the cap*); a
      200-line one passes
- [ ] 8.2 Write the scope tests first: a `*.test.ts` file over the cap fails
      like any other (*A test file is not exempt*); an untracked 400-line file
      does not fail the check (*An untracked file over the cap*); a `.md`,
      `.json` or `.yml` file over 300 lines does not fail it
- [ ] 8.3 Write the extension tests first: a 301-line `.tsx` file fails, since
      the requirement covers `.tsx` and not only `.ts` [2]; a 250-line `.css`
      file fails while a 250-line `.ts` file passes, proving the cap is chosen
      by extension rather than one number applied to everything [3]; and a
      `*.module.css` file is counted under the 200-line cap, which is the
      extension the whole CSS migration produces [6]
- [ ] 8.4 Write the counting and sweep tests first: three files over the cap
      are all reported in one run rather than only the first [1] — a check that
      stops at the first turns a nine-file backlog into a nine-round game; a
      file whose last line carries no terminating newline counts that line [4],
      because `wc -l` counts newlines and would read a 301-line file as 300;
      and a run that found zero files fails rather than passing every assertion
      vacuously
- [ ] 8.5 Write the environment tests first: a file `git ls-files` lists but
      that is absent from the working tree is skipped rather than throwing [5],
      and the check run from a subdirectory resolves the file list from the
      repository root [7]
- [ ] 8.6 Implement the check as `scripts/file-size.test.ts`, taking the file
      list the way `scripts/no-suppressions.ts` already does — `git ls-files
      -z` spawned at the repository root rather than at `cwd`, with the comment
      there explaining why — so an untracked file is out of scope and a
      gitignored one cannot pass locally and fail in a clone. This is the
      fourth site to do it; match the established shape instead of inventing
      one. Break each assertion above before it passes
- [ ] 8.7 Run it over the tree and confirm it passes with nothing exempted
      (*The tree as it stands*). A file still over the cap here means a
      previous step's seam was wrong and is fixed there, not exempted here
- [ ] 8.8 Add `scripts/file-size.test.ts` to the README's knowledge ownership
      map, beside `command-guard.ts` and `no-suppressions.ts`
- [ ] 8.9 Update `PLAN.md`: the queue entry asking for an `/opsx:update` on
      `reviewable-diff-gates` is answered — the cap landed here, and the rule of
      two remains outstanding as its own one-line Code rule, which is what the
      archived proposal prescribed for it
- [ ] 8.10 Grep the four sites that restate a claim like this one before calling
      the change done: this change's sibling artefacts, `openspec/specs/**`,
      `PLAN.md` and the README ownership map — searching the wording being
      replaced, not the wording replacing it
