# board-lifecycle — tasks

Three steps, three pull requests, in this order. Each names the criteria it
closes by their `<capability>/<scenario-slug>` identifiers.

The `MODIFIED` deltas carry these eleven criteria, which this change does not
close. Most change only a status name or a count in their wording.
`a-status-the-tree-cannot-see` and `a-card-and-the-tree-disagreeing` are also
reworded so a derived status reads as a floor, which is what the script has
always computed: it reads no card. The tests on `main` that close them are
updated in step 1 without changing what they assert:

  `task-board/a-status-holding-no-cards`
  `task-board/a-change-directory-missing-an-artefact`
  `task-board/a-change-directory-whose-specs-is-empty`
  `task-board/a-slug-reported-at-no-status-at-all`
  `task-board/an-archived-change`, `task-board/a-status-the-tree-cannot-see`
  `task-board/the-derivation-reaches-no-network`
  `task-board/a-card-on-a-board-whose-tree-is-elsewhere`
  `task-board/a-card-for-a-finding-with-no-change`
  `task-board/a-card-and-the-tree-disagreeing`
  `task-board/a-stage-moved-and-not-recorded`

ZOMBIES items are numbered as in the proposal-stage report. All five are in
step 1. Nothing on a board is testable from the suite, so the board-side tasks
verify by a view read.

## 1. Nine statuses

Closes `task-board/a-complete-change-directory-no-step-applied`,
`task-board/a-card-at-a-retired-status`, `task-board/a-proposal-merges`.

- [x] 1.1 In `scripts/board-state.ts`, rename `Status`'s `"ready"` to
      `"proposed"` and its two assignments with it. Rewrite the header
      comment's count and list of the statuses never reported: six, `idea`
      through `archiving`. Verify with `bun run typecheck`, which refuses any
      `"ready"` left on a `Status`.
- [x] 1.2 Update the cases that assert the old name: `board-state.test.ts`
      `:26-35` (ZOMBIES 1, 2) and `:73-76` (3), `board-state-edges.test.ts`
      `:39` with the comment at `:129` (4), and the fixture at
      `board-state-hygiene.test.ts:90` (5). Keep each `// spec:` citation.
      Verify `bun test scripts/board-state`, and that
      `grep -n '"ready"' scripts/board-state*.ts` finds nothing.
- [x] 1.3 In `docs/feature-workflow.md` §*Across the stages*, rename the
      derived statuses (`proposing`, `proposed`, `done`), and change every
      count of them to nine and six: *Three of the eight* (`:128`), *The other
      five* (`:130`), and *Which eight, and so which five* (`:133`). Change
      `task-board`'s *Purpose* (`openspec/specs/task-board/spec.md`) from
      eight statuses to nine. Do the same in `PLAN.md`'s board paragraph and
      growth protocol, and in `context-budget`'s two cards at `suggested`
      (`openspec/specs/context-budget/spec.md`), which become `idea`: the
      edits to live specs the delta cannot carry. Verify by reading every
      passage back.
- [x] 1.4 Migrate `D2ASS`, then `Harness`, through the union. Add `idea`,
      `explored`, `proposed`, `applying` and `applied` beside the current
      options. Move every card at `suggested`, `ready`, `implementing` or
      `reviewing` to `idea`, `proposed` or `applying`. Only then set the
      option list to exactly the nine. Before the last write, read
      `Board view` and confirm no card sits at a retired option. After it,
      read again and confirm every card reads one of the nine and none reads
      empty (*a-card-at-a-retired-status*).
- [x] 1.5 Move this change's card on `Harness` to the status this step
      reaches, under the new names, in the same turn.
- [x] 1.6 Run the pre-PR sequence per `docs/review-toolkit.md`, and `bun test`.

## 2. Cards a person can rank

Closes `task-board/a-card-for-a-change-that-exists-in-the-tree`,
`task-board/a-finding-that-becomes-a-change`,
`task-board/a-card-short-of-done`.

- [x] 2.1 In `docs/feature-workflow.md`, extend the *Move the card in the same
      turn* bullet: the turn a pull request opens also adds its link to the
      card, under the `Ссылки` line, with its number and kind; the turn a
      proposal merges adds its `proposal.md` on the default branch; the
      archive re-points that link to the archived path; an edit to a
      proposal's *Why* or *What Changes* re-reads the card's summary. Verify
      by reading the bullet back.
- [x] 2.2 Backfill every `D2ASS` card short of `done`. Write an English title
      saying what it does: a slug title is replaced, a finding's sentence
      title is kept if it already says what changes, and a brief's title keeps
      its filename as prefix. Open the body with a Russian summary of at most
      500 characters, read from the change's `proposal.md` (*Why*, *What
      Changes*) or, where there is no directory, from the card's own record,
      which stays below it. End it with the links:
      `gh pr list --state all --search <slug>` for pull requests, and
      `proposal.md` on `main` for a merged proposal. Measure each summary's
      length before writing it.
- [x] 2.3 Do the same for every `Harness` card short of `done`.
- [x] 2.4 Read `Board view` on both boards, and open five cards on each,
      chosen across columns. Confirm each against
      *a-card-short-of-done*: title, summary length, links. Confirm too that
      every card whose change has a directory carries it in `Pointer`, and
      every archived card its archive path, which `Done`'s sort reads in
      step 3. Report any card left unchanged and why.
- [x] 2.5 Move this change's card in the same turn.
- [x] 2.6 Run the pre-PR sequence per `docs/review-toolkit.md`.

## 3. Columns as queues, done as a stack

Closes `task-board/a-card-the-user-dragged-up`,
`task-board/a-card-reaching-done`.

- [ ] 3.1 Measure the drag before anything rests on it. Ask the user to drag
      one named card to the top of its column on `D2ASS`, then read
      `Board view` and confirm it comes first in that column's slice. If it
      does not, stop and bring the result to the user. The requirement cannot
      be met by anything a session controls.
- [ ] 3.2 On both boards, add a filter to `Board view` excluding `done`, and
      create a view named `Done` over the same data source, filtered to
      `done` and sorted by `Pointer` descending. Read `Done` and confirm the
      newest archive comes first and the brief cards, which have no pointer,
      come last.
- [ ] 3.3 In `docs/feature-workflow.md`, beside the boards, state that a
      session takes the first unblocked card of its column in `Board view`'s
      order and never reorders cards, and that `done` is read through `Done`.
      Verify by reading it back.
- [ ] 3.4 Move this change's card in the same turn.
- [ ] 3.5 Run the pre-PR sequence per `docs/review-toolkit.md`.
