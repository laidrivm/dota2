# notion-task-board — tasks

Nine acceptance criteria are in scope: seven `ADDED` in the `task-board`
delta and two `MODIFIED` in the `context-budget` delta. Each appears in
exactly one `Closes` line below.

The `context-budget` delta modifies two of that capability's four
requirements. The other two — *The always-on set is named and measured as one
budget* and *A fence stands where it is stepped on* — are **carried
unchanged** by this change and closed by nothing here; the first is what the
budget gate will measure once this change and `archive-digest` have landed.

Steps 1 to 6 are additive: the boards gain what nothing reads yet and
`PLAN.md` still holds the queue. Step 7 is the point of no return.

## 1. Board schema

Closes: *There are three boards and a card goes to one of them*

- [x] 1.1 Set each board's `Status` in one statement to exactly the eight
      `select` options — the statement replaces the list rather than
      extending it, so it is idempotent on `D2ASS`, converted during design,
      and complete on `Harness`, which still carries the original three
- [x] 1.2 Add the `Pointer` `rich_text` property to both boards, then
      **measure how it encodes a path and an empty value**: write one
      throwaway card with a path, write one with no pointer, read both back
      through the saved view, and delete them. The delta defers this on
      purpose — Notion's REST surface takes `rich_text` as an array of
      objects and nothing has exercised this connector's write path — and
      this task is the only thing that closes it. Do it here, on boards that
      still hold nothing: the same mistake found at step 4 is thirty cards to
      rewrite
- [x] 1.3 Record the measured encoding where steps 4, 5 and 6 read it, so
      three steps do not each re-derive it from one card
- [x] 1.4 Record `mellon` in the routing rule's home without creating the
      board — the project does not exist, and an empty third board is a
      thing to keep in step with two others for no reader

## 2. The derivation

Closes: *Three statuses are derived and five are moved by hand*

- [x] 2.1 Write `scripts/board-state.ts`: filesystem in, JSON out, no
      network and no connector
- [x] 2.2 Tests first, from the ZOMBIES run, against a fabricated tree —
      empty `openspec/changes/`; complete directory to `ready`; directory
      missing `tasks.md` to `proposing`; directory whose `specs/` is empty to
      `proposing`; slug in both `changes/` and `archive/` to `done`; a slug
      the tree cannot see distinguished from `suggested`; the output carrying
      no key for any of the five hand-moved statuses; a full run with no
      network route
- [x] 2.3 Assert no `collectionPropertyOption://`, board URL or view URL
      reaches the output — this repository is public
- [x] 2.4 Run it over the tree as it stands and check it against the figures
      the proposal states: thirty `done`, twenty `ready`, no `proposing` —
      nineteen and one until this change's own directory completed, which the
      proposal's §*What derives, measured* now records

## 3. Blocking edges

Closes: *A card names what blocks it, derived from the tree*

- [x] 3.1 Add `after:` to the six `.openspec.yaml` files whose `## Ordering`
      names a predecessor, leaving the prose argument where it stands —
      **seven**, not six: `outcome-calibration` carries no `## Ordering`
      section, so the scan that counted six could not reach it, and its
      dependency on `match-harvest` is the hardest of the set. Its argument
      stood only in the `PLAN.md` entry that step 5 turns into a card with an
      empty body, so the section it never had is written now
- [x] 3.2 Derive the blocked set, computing it at the time of asking rather
      than storing it on a card
- [x] 3.3 Tests: a predecessor not `done` reports blocked; every predecessor
      `done` reports takeable with the `after:` list intact; an absent
      `after:` reports takeable; an `after:` naming a slug that exists
      nowhere fails naming slug and file; an `after:` holding a bare string
      fails naming the file rather than walking its characters; a self-edge
      and a two-change cycle are reported rather than resolved

## 4. Cards for what is archived

Closes: *A board records a task's status and nothing the tree holds*

- [x] 4.1 Create thirty cards at `done`, one per directory under
      `openspec/changes/archive/`, routed by the owning repository
- [x] 4.2 Set each `Pointer` to the archive path; leave every body empty
- [x] 4.3 Re-derive and compare — this is the status that derives 30/30, so
      a mistake here is visible now and nowhere later

## 5. Cards for what is open

Closes: *The board is read through a saved view*

- [x] 5.1 Create thirty-seven cards, routed 21 to `D2ASS` and 16 to
      `Harness` per the design's reading, settling the four borderline
      entries it names rather than re-arguing them. Thirty-five when the
      design counted: `PLAN.md`'s Open section has since gained this change's
      own entry, and `drop-mutation-exemptions` is a change directory the
      queue never gave a bullet of its own — the derivation reports it and
      nothing else would, so the board owes it a card. Both are `Harness`,
      which is the whole of the 14 → 16
- [x] 5.2 Set the `Pointer` on the twenty with a change directory; write
      the body as the record for the seventeen with none
- [x] 5.3 Read both boards back through the `Board view` saved view, by
      name, and confirm no SQL query was needed to do it
- [x] 5.4 Check that a status holding no card shows no column, and that this
      does not stop a card being written to that status by name

## 6. Cards for the briefs

Closes: *Each task brief becomes one card and the directory goes*

- [x] 6.1 Create nine cards, one per brief, routed by the owning repository,
      each **titled with the brief's filename** — `tasks/task-1.md`, not a
      readable paraphrase: the filename is the only key the four surviving
      archived citations carry, and a brief card's pointer is empty
- [x] 6.2 Build each body from the brief's `Status: DONE` block where there
      is one, and from its scope for `tasks/task-5.md`, which is still open
- [x] 6.3 Delete `tasks/` and its `README.md` ownership row in the same
      commit — `scripts/repo-layout.ts` fails on a documented directory
      holding no tracked file, which is what makes the pair atomic. Three
      sites rather than the pair: the check that actually fails is
      `checks/readme-layout.test.ts`, whose `UNPLACED` list exempts `tasks/`
      from placement and refuses an exemption naming nothing tracked, and
      `README.md` also counts the directory in the prose under its layout
      table
- [x] 6.4 Correct the one live citation, in
      `docs/context/pipeline-yield-2026-07.md`, and leave the four archived
      ones standing

## 7. PLAN.md

Closes: *PLAN.md holds the standing constraints and the sources*

- [x] 7.1 Delete the `## Queue` section, 591 lines, and the opening sentence
      naming the queue as what the file holds — 604 lines when it ran, the
      section having grown by this change's own entry, and the growth
      protocol's *What lives here* and *What evicts an entry* name the queue
      too
- [x] 7.2 Replace the `tasks/task-5.md` requirement source with its card
- [x] 7.3 Add the pointer to the boards, by name and not by URL
- [x] 7.4 Measure the always-on set and record the figure: **912 before, 334
      after** — `PLAN.md` 704 → 122 and `CLAUDE.md` 208 → 212, the four lines
      being 8.3's sentence saying where the queue is now. 899 and about 308
      were taken before `PLAN.md` gained this change's own entry; recorded in
      the proposal's `## Impact`
- [x] 7.5 Test that `PLAN.md` holds no `## Queue` heading and no
      `tasks/task-5.md` citation — `checks/plan-sources.test.ts`. The path may
      not survive as a *citation*, and the card it is replaced by is titled
      with that same filename, so the case asserts the one mention names a
      card and that git tracks no such file

## 8. The sites that restate what moved

Closes: *An entry leaves PLAN.md by one of four routes*

- [x] 8.1 Retarget the eleven `tasks.md` files carrying a step that updates
      `PLAN.md`'s queue — and the nine preambles naming that update as work
      closing no criterion, plus six one-off sites the count of eleven did not
      reach: `bun-version-sites` 2.4 and 3.5, whose entry is now a card that
      restates nothing; `laning-phase-model` 10.3's *`PLAN.md`'s open entry*;
      `drop-mutation-exemptions` 2.3's grep list; `hero-aliases-seed` 5.5's
      e2e backlog; and the *four places that restate a decision* list in both
      `bun-version-sites` 3.7 and `gh-api-guard` 3.5, which step 9.1 takes
      `PLAN.md` out of
- [x] 8.2 `docs/rulebook-growth.md` §*An always-on file past its trigger*
      gains relocation as a second remedy beside extraction, and the test
      that picks between them — as written it states extraction as the only
      remedy a fired trigger has, which forbids what this change does
- [x] 8.3 `CLAUDE.md` §*Maintenance & growth*, `README.md`'s ownership map
      and `scripts/repo-layout.ts` — each names `PLAN.md` as the queue. Two
      sites in `CLAUDE.md` rather than one: the section names the extraction
      protocol, and the Process rule *Take the queue's next entry* names the
      queue itself. Taken with step 7 rather than with the rest of step 8, so
      that the claim and its removal land in the same pull request
- [x] 8.4 Grep the wording of each claim being replaced, not the wording
      replacing it, and reconcile every site this step did not anticipate —
      seven more: five code comments sending a reader to `PLAN.md` for a lift
      or an open question (`scripts/spec-coverage.ts`, `scripts/scan.ts`,
      `scripts/mutation-floor-exemptions.test.ts`, `e2e/hero-image.ts`,
      `src/model.ts`, which is at its cap so the reword adds no line), and
      two change artefacts (`bun-version-sites`'s `## Impact`,
      `drop-mutation-exemptions`'s design)

## 9. The obligation that replaces the PLAN.md duty

Closes: *A stage that completes moves its card in the same turn*

Its own step because it is an obligation rather than a build, and because
until `docs/feature-workflow.md` is rewritten the obligation has nowhere to
live. The five hand-moved statuses are the part of this change that is
honoured rather than mechanised; this step is where that is written down.

- [x] 9.1 `docs/feature-workflow.md` — *Maintain `PLAN.md`* becomes an
      obligation to the board, and `PLAN.md` leaves the list of four places
      a changed statement is grepped in
- [x] 9.2 State that a reconciliation reports what it corrected rather than
      repairing silently — a silent repair leaves nobody aware the
      obligation was missed, which is the failure this change was written
      after twice
