# retire-plan-md — tasks

Two steps, two pull requests, in this order. Each names the criteria it closes
by their `<capability>/<scenario-slug>` identifiers.

Two `MODIFIED` deltas carry these seven criteria, none of which this change
closes:

  `task-board/a-brief-that-is-done`, `task-board/the-brief-still-open`
  `task-board/an-archived-change-citing-a-brief-by-path`
  `task-board/the-directory-s-row-in-the-ownership-map`
  `agent-rulebook/the-duplicate-is-removed`, `agent-rulebook/a-reference-is-kept`
  `agent-rulebook/the-rule-that-treated-the-symptom`

They are copied whole because a `MODIFIED` delta replaces a requirement. What
changes in them is wording about `PLAN.md`, and the tests on `main` that close
them still do.

ZOMBIES items are numbered as in the proposal-stage report; item 11 is
already covered by `scripts/repo-layout.test.ts:69` and `:124`.

## 1. The standing constraints go to their owners

Closes `context-budget/an-architecture-default`,
`context-budget/a-fact-its-owner-already-states`,
`context-budget/a-fact-no-site-owns`.

`PLAN.md` keeps *Where the work is* and the `tasks/task-5.md` line until step
2. Both are held by `checks/plan-sources.test.ts` cases that cite criteria,
and removing a citation before the file goes would move the uncited floor
twice.

- [x] 1.1 Add *STRATZ, not OpenDota* to `openspec/config.yaml` `context:` as
      one architecture default: STRATZ carries the lane position
      `hero_position_stats` rests on, and OpenDota does not. Verify with
      `openspec instructions proposal --change retire-plan-md --json`,
      whose `context` shows the bullet.
- [x] 1.2 In `.github/dependabot.yml`, comment above `updates:` why it is
      Dependabot and not Renovate (no third-party App with write access; no
      dashboard or lockfile maintenance, which the nightly `bun audit`
      covers). Comment at the `bun` entry that it reads `dependencies` and
      `devDependencies` only, so the `overrides` for `qs` and `fast-uri` (both
      reached only under `@stryker-mutator/core`) are raised by hand when
      `.github/workflows/audit.yml` reports one. Verify
      `bun test checks/container-image` still passes, since it reads this
      file.
- [x] 1.3 In `docs/api-design.md`, beside the camelCase bullet, add the one
      exception: Postgres columns stay `snake_case`, because an unquoted
      identifier folds to lowercase, and the exporter renames at that
      boundary. Verify by reading the passage back.
- [x] 1.4 Create `docs/design-sync.md`, opening with a level-1 heading: the
      private claude.ai/design project *Draft board screen design*, reached
      through `DesignSync`, and the derivation of its two swatch pages from
      `src/app/styles/tokens/colors.css`, carried over from `PLAN.md` whole.
      Add its row to the `README.md` ownership map (*when the palette or the
      design project is touched*) and one index line to `CLAUDE.md`. Verify
      `bun test checks/readme-map.test.ts`.
- [x] 1.5 From `PLAN.md`, delete *Growth protocol*, *Standing constraints* and
      the `spec-inbox/` and design-project lines of *Requirement sources*.
      Reduce the preamble to one line saying the file names where the work
      is. Every deleted entry's destination is the design's table, and the
      deletions rest on the evidence column, re-read at its paths now rather
      than trusted.
- [x] 1.6 In `checks/plan-sources.test.ts`, delete the case asserting the
      constraints themselves, and drop `## Standing constraints` from the
      headings case. Neither carries a citation. Verify the file passes and
      lists its remaining tests by full describe path.
- [x] 1.7 Move the change's card on `Harness` to the status this step
      reaches, in the same turn.
- [x] 1.8 Run the pre-PR sequence per `docs/review-toolkit.md`, and
      `bun test`.

## 2. PLAN.md leaves the tree

Closes `task-board/the-workflow-doc-names-the-boards-by-name-alone`,
`context-budget/the-trigger-fires-on-the-one-file`,
`context-budget/a-second-file-read-every-session`.

- [x] 2.1 In `docs/feature-workflow.md` §*Across the stages*, state the three
      boards and the work each takes, the `Board view` they are read through
      and never by SQL, why they are named rather than linked, and that
      `scripts/board-state.ts` derives three statuses for `D2ASS` alone. Move
      `CLAUDE.md`'s *Take the queue's next entry in the order its board view
      shows…* rule into the same section. Delete the sentence at `:118` that
      says what `PLAN.md` holds now. Add *when choosing the next task* to that
      doc's `README.md` map row.
- [x] 2.2 `git mv checks/plan-sources.test.ts checks/workflow-boards.test.ts`
      and re-aim it at `docs/feature-workflow.md`, citing
      `task-board/the-workflow-doc-names-the-boards-by-name-alone`.
      Read the doc inside each case, never in the describe body (ZOMBIES 1).
      Assert each of `D2ASS`, `Harness`, `mellon` and `Board view` on its
      own, so the failure names it (2). Refuse `notion.so`, `notion.com`,
      `collection://`, `view://`, `collectionPropertyOption://` and a UUID
      matched case-insensitively (3, 4, 5). Keep the `tasks/` case and its
      `task-board/the-brief-still-open` citation (6). Delete the
      queue-heading, sections and task-5-line cases, and with them the
      `context-budget/a-source-that-is-itself-a-task` citation. Verify every
      test by full describe path.
- [x] 2.3 In `checks/readme-map.test.ts`, assert that the rows whose *Read*
      cell matches `/every session/i` are exactly `["CLAUDE.md"]`, citing
      `context-budget/a-second-file-read-every-session`. This covers one row
      (ZOMBIES 7), a second row (8), a reworded or capitalised cell (9) and
      none at all (10). Probe it once with a second row added. Restore
      `README.md` from a copy taken before the probe, never with
      `git checkout`.
- [x] 2.4 Delete `PLAN.md`, its `README.md` map row and its key in
      `EXEMPT` (`scripts/repo-layout.ts`). Verify `bun test scripts/repo-layout`
      passes, and fails if the key is left in (`:124`).
- [x] 2.5 Rewrite `CLAUDE.md` §*Maintenance & growth*: `CLAUDE.md` is the one
      file read every session, and its trigger is ~350 lines. Delete the
      paragraph on what `PLAN.md` holds, and point the *Feature workflow*
      index line at the boards as well. Verify `wc -l CLAUDE.md` is under 350
      and `grep PLAN.md CLAUDE.md` finds nothing.
- [x] 2.6 Re-point `docs/rulebook-growth.md:40` (*the boards `PLAN.md` points
      at*) and `spec-inbox/README.md:7` (*listed in `PLAN.md`*) to
      `docs/feature-workflow.md` and the `README.md` map respectively.
- [ ] 2.7 Re-point the open changes' instructions: the eleven
      `` `PLAN.md` holds no queue `` clauses lose that clause.
      `letter-patch-detection` 1.7 reads the constraint in
      `openspec/config.yaml` `context:`. The present-tense citations in
      `scan-lift` (proposal `:42`, tasks `:65`), `match-harvest` (proposal
      `:73`, `:88`), `outcome-calibration` (proposal `:73`),
      `laning-phase-model` (design `:197`), `score-calibration` (design
      `:139`) and `hero-aliases-seed` (proposal `:87`) name the card instead.
      The past-tense records in `bun-version-sites`, `focus-restore-idiom` and
      `tracked-file-sweep` stay. Assert the clause's match count before
      scripting it, and read each changed passage back.
- [ ] 2.8 Run `bun test scripts/spec-coverage` and set `FLOOR` in
      `scripts/spec-coverage.ts` to the measured count, with the reason: one
      citation left with `checks/plan-sources.test.ts`. Rewrite the floor
      comment's clause naming that file to name
      `checks/workflow-boards.test.ts`. Re-measure again at archive, once
      sync removes and adds `context-budget` criteria.
- [ ] 2.9 `git grep -n PLAN.md`, excluding `openspec/changes/archive/`,
      `docs/context/` and this change, and confirm every hit is a past-tense
      record that 2.7 left on purpose.
- [ ] 2.10 Move the change's card on `Harness` to the status this step
      reaches, in the same turn.
- [ ] 2.11 Run the pre-PR sequence per `docs/review-toolkit.md`, and
      `bun test`.
