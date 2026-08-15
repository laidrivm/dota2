# file-size-cap — tasks

Eight steps in this order, one pull request each unless the step's own note
says otherwise — five of them say so. Seven of them close no
acceptance criterion: they are the decomposition the cap costs, and each one
leaves the application working and every test green. The eighth adds the cap
and closes all five criteria at once, which is only possible because the seven
before it brought the tree under the line.

The order is deliberate. CSS first, because it changes how styles are delivered
and everything after it should run against the finished mechanism; then the
three source splits, each with its test file; then the five test files that
split on their own; then the cap.

Moving a rule counts twice in the diff budget — once removed, once added — so
the 943 lines of `app.css` are ~1900 budgeted lines on their own. That, not
caution, is why the migration takes three steps.

Step 1 turned out to need one thing this list did not foresee, and it shipped
ahead of the step rather than inside it: Bun's HTML dev server cannot emit a
CSS module's class-name mapping, so development now builds and serves `dist/`.
It is its own pull request because it changes how the application is served and
stands on its own — `design.md` records the decision. The scan that checks a
component reads only names its module defines was opened as a third, and merged
into this step's pull request rather than behind it, so it ships here.

`/zombies` in diff mode runs before each pull request, per the pre-PR sequence.
Only step 8 introduces logic for it to find; the test tasks in steps 1–7 are
the existing suites, which must stay green unchanged except where a file is
renamed. Numbers in brackets in step 8 are `/zombies` items from the pass over
this proposal.

## 1. Styles arrive through the bundle, and the first components own theirs

- [x] 1.1 Import `src/app/styles/styles.css` from `src/app/main.tsx` and drop
      the `<link rel="stylesheet">` from `index.html`, leaving the `@import`
      chain and every rule exactly as they are — this changes the delivery path
      and nothing else, and it is the commit to bisect to if styles vanish
- [x] 1.2 Update `build.test.ts`, which globs `*.css` in `dist` and asserts on
      the single emitted stylesheet; confirm the `@import url("/fonts/fonts.css")`
      assertion still holds, since fonts stay a served file
- [x] 1.3 Move the `hero tile` and `re-pick marker` blocks out of `app.css`
      into `src/app/board/hero-tile.module.css`, imported by `hero-tile.tsx`;
      each explanatory comment moves with the rules it describes
- [x] 1.4 Move the `picker and dialogs` block into
      `src/app/picker/picker.module.css` — except the confirm dialog, which is
      `app.tsx`'s and goes to `src/app/app.module.css` (step 3's file, brought
      forward) rather than making the shell import the picker's stylesheet, and
      the bare `dialog` panel both share, which has no class to scope and goes
      to `base.css`
- [x] 1.5 Rewrite every `class` on the migrated markup to read from the
      imported mapping — `class={s.heroTile}`, not `class="hero-tile"` — in
      `hero-tile.tsx`, `picker.tsx` and wherever else those classes are
      written, `board.tsx`'s re-pick badge included. The bundler rewrites the
      names in the stylesheet, so a literal left behind matches nothing and the
      rule silently stops applying. Every step that moves a block owes this,
      not only this one
- [x] 1.6 Confirm no rule was left behind and none duplicated. Not by counting
      lines: the block splits across two modules, `app.module.css` and
      `base.css`, and two rules become custom properties, so no equality holds.
      Compare the multiset of declarations and of selectors before and after,
      and account for every difference
- [x] 1.7 Run the e2e suite and confirm the rendered page is unchanged — a
      mistake here is a blank stylesheet, which is loud

## 2. The board owns its styles

This step ships as three pull requests, not one — the second step to take more
than one, after the dev server that shipped beside step 1. Both halves of the
reason are the numbers: the blocks are ~350 lines
together against the 200-line cap step 8 brings, so one module would only have
to be split again there; and moving them costs ~1000 budgeted lines against a
gate that fails at 800. One module per pull request answers both, and the seam
is the one step 6 splits `board.tsx` on.

- [x] 2.1 Move the `board`, `bans`, `teams`, `suggestions` and `result` blocks
      into `src/app/board/`, across `board.module.css` (the frame, the bans row
      and the pieces every panel shares), `panels.module.css` (what a panel is
      and the rows the team panels carry) and `suggestions.module.css` (the
      strips and the result readout)
- [x] 2.2 Move the one-column rule under `/* One column: the board has to fit a
      phone… */` with the rules it governs, splitting it per module rather than
      leaving a media query orphaned in `app.css`

## 3. The shell owns its styles, and app.css goes

- [x] 3.1 Move the header, side, setup and undo-toast blocks into
      `header.module.css`, `session-controls.module.css` and
      `app.module.css` beside their components
- [x] 3.2 Delete `src/app/styles/app.css` and its `@import`; `styles.css` is
      left with tokens and `base.css`, the global layer that has no class to
      scope
- [x] 3.3 Rescope the token check in `src/app/styles/styles.test.ts`: take the
      file list from `git ls-files -z` at the repository root, keep the `*.css`
      entries and exempt `src/app/styles/tokens/`, rather than enumerating one
      directory — a moved stylesheet must not leave the no-colour-literal
      assertion silently. Not a filesystem-wide `Bun.Glob`, which would walk
      `node_modules` and pick up untracked files; the shape is
      `scripts/no-suppressions.ts`'s. Add the guard that the sweep found more
      than zero files
- [x] 3.4 Break the rescoped check before trusting it: put a hex literal in a
      component module and watch it fail

## 4. `src/app/session.ts` splits

This step ships as four pull requests, not one — the fourth step to take more
than one, and for the reason the preamble gives: the test file is 831 lines and
moving it costs every one of them twice. 4.1 is one; 4.2 is one per file it
extracts, so no pull request needs an `oversize:` marker to pass the budget.

- [x] 4.1 Move the keyboard layer — `SIDE_KEYS`, `ROLE_KEYS`, `unmodified`,
      `hotkeyContext`, `ownsKeystroke`, `closesEditor`, `hotkeyFor` — into
      `src/app/hotkeys.ts`, leaving session state and its reducer behind. That
      list alone left `session.ts` at 340, so the persistence layer became
      `src/app/session-storage.ts` too: it is neither the state nor the
      reducer, and it already stood on `storage.ts`. `pickerHotkey` went with
      the rest of the keyboard layer rather than staying behind to read
      `ROLE_KEYS` through the seam, which moved `MAX_ENEMY_PICKS` to
      `types.ts`. `hotkeys.ts` takes `PickTarget` type-only, which is what
      keeps the two modules off `noImportCycles` — verified by adding a value
      import and watching the linter report both. Final: 137 / 257 / 69.
      The move is behaviour-preserving with one exception, which a CodeRabbit
      finding on the pull request forced and which is a fix rather than a
      decomposition: `isSession` checked that the keys the UI indexes were
      present, and presence let `side` through as `undefined`, which the screen
      choice — asking `side === null` — reads as a set-up session and answers
      with the board. It now checks each field against its own domain
- [x] 4.2 Split `src/app/session.test.ts` along the same seam; every file
      lands at 300 lines or fewer, the cap being inclusive, or the seam was
      wrong. Four files, because the module split was three and the remainder
      was still ~500: `hotkeys.test.ts` (241), `session-storage.test.ts` (166),
      `session.test.ts` (281, the reducer) and `session-undo.test.ts` (247,
      reset and the undo window, plus the round trip that needs both the
      reducer and a storage stub). Confirm at each extraction that no test was
      lost — by the full describe path of every test, not by the count: a block
      absorbed into its neighbour because a closing brace moved with the text
      above it runs exactly as many tests as before, and twice did

## 5. `scripts/command-guard.ts` splits

This step ships as three pull requests, not one — the fifth step to take more
than one, and for the reason step 4 gives: the test file is 595 lines, moving
one costs it twice, and 595 against a gate that fails at 800 leaves no room for
the code split beside it. 5.1 and 5.2 are one, being the code change and the
probe that it still refuses; 5.3 and 5.4 are one each.

The seam is the same one 5.1 cuts, but it does not reach the cap on its own:
the parser's own cases are 98 lines and the remainder is still ~500. The
prohibitions divide once more, at the boundary the guard's own reasons already
draw — a commit or a `gh` write is refused by name, a push by what it would
reach — so 5.4 takes the push cases.

- [x] 5.1 Move the shell-line parser — `SEPARATORS`, `commands`, `WRAPPERS`,
      `SHELLS`, `invocation` — into `scripts/command-parse.ts`, leaving the git
      and `gh` prohibitions in `command-guard.ts`. `SHELLS` is exported rather
      than internal: the recursion into a shell's `-c` argument is a
      prohibition's decision, not the parser's. Final: 246 / 154.
      The move is behaviour-preserving with four exceptions, every one of them a
      CodeRabbit finding on the extracted file and a fix rather than a
      decomposition — a guard that quietly stopped refusing, which is the
      failure 5.2 exists to catch. Two in `commands`: a substitution reset the
      enclosing quote instead of suspending it, so the quote closing `$(…)` was
      read as one opening and everything after it became a single quoted word;
      and once suspension was a stack, a `)` closing a group *inside* a
      substitution popped the substitution's own entry, so a subshell now
      suspends its quote as well. Two in what was `invocation`: it stopped at
      the first word that was neither an assignment nor a wrapper, so `env -i
      git commit` resolved to `-i` — it now skips by what a command name cannot
      be, an option or a redirection, rather than by a list of the forms seen so
      far; and skipping an option is not enough when the option takes an operand
      (`env -u PATH git commit`), so past a wrapper it returns every word as a
      candidate and the guard checks each. That plural is the rename to
      `invocations`
- [x] 5.2 Confirm the hook still blocks, on the terms `CLAUDE.md` sets for
      probing a gate: refuse it with an input this session has not already
      cleared, and report what the call returned rather than what a prompt did.
      One command it must refuse, one it must allow — this file is a safety
      gate, and a refactor that quietly stops refusing is the failure that
      matters. The refusing input carries `--dry-run`, so the probe is a probe
      either way: allowed, it would have changed nothing. That the flag does not
      exempt a force is pinned by a test as well, since a probe run once says
      nothing about the next change to `FORCE`
- [x] 5.3 Split `scripts/command-guard.test.ts` along the same seam: the two
      describes that exercise the parser — spellings and quoting — become
      `scripts/command-parse.test.ts`. The harness both files need, being a
      fabricated repository and a spawned guard rather than a stub, is lifted to
      one module rather than copied; `afterAll` stays with each test file, which
      is where a lifecycle hook registers. `fabricate` took a prefix parameter
      so the one case needing a path with a space in it stops reaching into the
      harness's own list. Final: 462 / 165 / 73 — the first is still over the
      cap, which is 5.4's. The 93 full describe paths are identical before and
      after
- [ ] 5.4 Move the push describes into `scripts/command-guard-push.test.ts`,
      leaving the unreadable event, the commit and the `gh` cases behind.
      Confirm across both extractions that the set of full describe paths is
      unchanged, per the check `CLAUDE.md` carries

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

This step ships as three pull requests, not one — the third to take more than
one. 7.1 to 7.3 are small splits and travel together, 1238 lines between them;
7.4 and 7.5 carry 1442 between just the two, and each earns its own — 7.4
because it moves a whole implementation into a new file, 7.5 because it waits
on a lift that is not this change's.

- [ ] 7.1 Split `scripts/diff-budget.test.ts` (466) by what it exercises —
      the counting rules, the task-line pairing, and the override marker
- [ ] 7.2 Split `src/model.test.ts` (425) by the model spec's sections — enemy
      role inference, scoring, and the win estimate
- [ ] 7.3 Split `agent-permissions.test.ts` (347) by the policy areas it reads
- [ ] 7.4 `scripts/spec-coverage.test.ts` (891): extract the check it
      implements — `parse`, `cite`, `tests`, `check`, `uncited`, `gauge` and
      the patterns they read — into `scripts/spec-coverage.ts`, the shape
      `no-suppressions.ts` and `mutation-floor.ts` already have and this file
      is alone in lacking. Then split what is left by what it exercises: the
      citation reader, the sweep over the repository, and the floor with the
      archive rules. `design.md` records why the extraction comes first. The
      README's ownership map names the test file as the owner of that
      knowledge; the script becomes the owner, so that row moves in this task
- [ ] 7.5 `scripts/mutation-floor.test.ts` (551), after the lift it waits on.
      Switching `scripts/mutation-floor.ts` to `scripts/scan.ts` is `PLAN.md`'s
      outstanding item and not this change's work, but it is what makes this
      file the size it is: the disable-comment scanner's own cases leave with
      the scanner they duplicate. So measure the file again once that lands,
      and split it — by the floor arithmetic and the command-line entry point —
      only if it is still over the cap. Record the measurement either way. If
      the lift has not landed when this step is reached, split the file as it
      stands — the cap is reachable without it, and waiting would make another
      change's schedule this one's
- [ ] 7.6 Confirm across all five splits that the set of full describe paths is
      unchanged, which is the check `CLAUDE.md` now carries and step 4 is why:
      a test lost in a move is the one failure a green run cannot show, and a
      block absorbed into its neighbour is a failure the count cannot show
      either. Every split here moves cases and deletes none — the deletions the
      scanner lift makes belong to the lift's own change and are outside this
      measurement

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
      stops at the first turns an eleven-file backlog into an eleven-round
      game; a file whose last line carries no terminating newline counts it [4],
      because `wc -l` counts newlines and would read a 301-line file as 300; a
      file with `\r\n` endings counts each pair as one line, not two; and a run
      that found zero files fails rather than passing every assertion vacuously
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
