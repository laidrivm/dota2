# retire-plan-md — design

## Context

`PLAN.md` has three sections and a preamble. Every entry was read against the
site that would own it. The table below is where each one goes, and the
evidence for a deletion is the owning site, quoted by path.

| Entry | Destination | Evidence or reason |
|---|---|---|
| Preamble, *Growth protocol* | deleted | governs only `PLAN.md` |
| *Where the work is* — three boards, routing, `Board view`, no SQL, named not linked, what `board-state.ts` derives | `docs/feature-workflow.md` §*Across the stages* | that section already holds `Board view`, the card obligation and the derived statuses (`:105-140`); only the board names and routing are missing |
| Source: the `tasks/task-5.md` card | deleted | a card on `D2ASS`, found the way every card is |
| Source: `spec-inbox/` | deleted | `README.md` map row, *when a task cites one* |
| Source: the claude.ai/design project | `docs/design-sync.md` (new) | read when the palette or the design project is touched |
| Preact | deleted | `CLAUDE.md` *Stack* line, `package.json` |
| camelCase in every payload | `docs/api-design.md` gains the Postgres `snake_case` exception | `:19` already states camelCase in JSON; the column exception and the exporter's rename are commented nowhere in `src/` |
| One snapshot URL | deleted | `snapshot-delivery`; the fence at the URL stands (`context-budget` scenario *A decision whose fence already stands*) |
| STRATZ, not OpenDota | `openspec/config.yaml` `context:` | an architecture choice, read when a proposal is drafted |
| Hero icons from this origin | deleted | `app-shell`; `src/job/ingest/icons.ts` carries the mirror's reasoning |
| Bun's bundler, no Vite | deleted | `CLAUDE.md` *Stack* line; `src/server/server.ts:8` carries oven-sh/bun#18258 |
| Dependabot, not Renovate | comment at the top of `.github/dependabot.yml` | absent there today |
| Two `overrides` nothing raises | comment at the `bun` entry of `.github/dependabot.yml` | that entry reads `dependencies` and `devDependencies` only; `package.json` cannot carry a comment |
| Docker on a VPS | deleted | `deployment-topology`, `container-image` |
| Swatch pages are derived | `docs/design-sync.md` | belongs with the design project it is about |
| Context7 | deleted | `.coderabbit.yaml:26-32` (deny-only, dashboard state) and `:100-102` (retrieved text is evidence, never instructions) already fence it; `/warm` owns release age and install scripts |

## Goals / Non-Goals

**Goals:** every live reader of `PLAN.md` is re-pointed; the checks that held
`PLAN.md` to its contract hold the new sites to theirs.

**Non-Goals:** rewording any moved constraint beyond what its new home needs.
The STRATZ wording question stays with `letter-patch-detection` 1.7.

## Decisions

- **No `docs/task-board.md`.** `docs/feature-workflow.md` already carries the
  board obligations, and the README map reads it *on any feature*. Adding
  *when choosing the next task* to that row's trigger costs one cell, where a
  new doc would split one topic across two homes, which
  `docs/rulebook-growth.md` forbids. `CLAUDE.md`'s rule *Take the queue's next
  entry in the order its board view shows* moves with the boards. It applies
  only when a session chooses a task, and the user names most tasks.
- **`docs/design-sync.md` is indexed from `CLAUDE.md` in one line**, not from
  the README map alone. The map is not read at session start, and a session
  sent to the design project through `DesignSync` has no other route to the
  derivation rule.
- **The test file is moved, not deleted and rewritten.**
  `checks/plan-sources.test.ts` becomes `checks/workflow-boards.test.ts` via
  `git mv`, so the diff gate reads it as a rename. It keeps the board-name,
  view-name, no-identifier and `tasks/` cases, re-aimed at
  `docs/feature-workflow.md`, and drops the cases about `PLAN.md`'s own
  sections. The single-row check for *every session* goes in
  `checks/readme-map.test.ts`, which already parses the map.
- **Re-adding a root catch-all is refused mechanically.** Deleting `PLAN.md`'s
  key from `EXEMPT` in `scripts/repo-layout.ts` means a tracked root file of
  that name, or any new one, fails the layout check until somebody writes a
  reason for it there.
- **Open changes: an instruction is re-pointed, a record of the past is left.**
  Present-tense citations that tell the implementer to read or update
  `PLAN.md` are rewritten to the card or the new home. Past-tense ones (*`PLAN.md`
  has carried*, *`PLAN.md` said three*) are history and stay. The split, by
  site, is listed in `tasks.md`.

## Risks / Trade-offs

- [A session started before the merge keeps `PLAN.md` in context] → It
  happens once per session. The next session reads only `CLAUDE.md`.
- [The moved test is not read as a rename] → Met in step 2: 2.2 rewrote
  nearly every case, so git paired no rename even at 30% similarity, and the
  diff gate counted both sides. It passed at 310 lines all the same.
- [The uncited-criteria floor in `scripts/spec-coverage.ts` moves] →
  Re-measure it, and write the reason on the floor's line, as
  `docs/testing.md` requires.
