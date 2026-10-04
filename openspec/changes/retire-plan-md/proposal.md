# retire-plan-md

## Why

Every session reads `PLAN.md` (122 lines) and needs none of it. The next task
reaches a session one of two ways: the user names it, or the session proposes
one from a board. Neither reads `PLAN.md`. Its other half, the standing
constraints, turned out on inspection to be duplicates of what an owning site
already says (`CLAUDE.md`'s stack line, a spec, a fence already standing in
the code) or fences that were never written at the line they guard. A file
whose test for admission is "no single site owns this" admits whatever nobody
placed. It grew to 691 lines on that test once already, and it will grow back
on it.

## What Changes

- **BREAKING (agent workflow):** `PLAN.md` leaves the tree. `CLAUDE.md` becomes
  the only file read at the start of every session, and the maintenance
  trigger becomes that one file passing **~350 lines**.
- Each entry goes to the site whose reader would look for it:
  - the three boards, the routing rule and the `Board view` →
    `docs/feature-workflow.md`, beside the card obligations already there.
    `CLAUDE.md`'s rule on taking the queue's next entry moves with them;
  - the design project and the derivation of its swatch pages → a new
    `docs/design-sync.md`, read when the palette or the design project is
    touched;
  - *STRATZ, not OpenDota* → `openspec/config.yaml` `context:`, which owns
    architecture choices and is read when a proposal is drafted;
  - *Dependabot, not Renovate* and the two `overrides` nothing raises → as
    comments in `.github/dependabot.yml`;
  - Postgres keeping `snake_case` columns → `docs/api-design.md`, beside the
    camelCase rule it is the exception to.
- Deleted as duplicates of the site that owns them: Preact, Bun's bundler, the
  one snapshot URL, same-origin hero icons, Docker on a VPS, Context7, the
  `tasks/task-5.md` card and `spec-inbox/` as sources, and the growth protocol,
  which governed only `PLAN.md`.
- `checks/plan-sources.test.ts` goes with the file. Its board-naming checks
  move to `docs/feature-workflow.md`.
- Every live citation of `PLAN.md` is re-pointed. That covers the instructions
  in open changes, several of which already cite entries that left for the
  boards. Dated logs under `docs/context/` and the archive keep theirs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `context-budget`: the always-on set becomes `CLAUDE.md` alone at ~350 lines.
  The two requirements on what `PLAN.md` holds and how an entry leaves it are
  replaced by one on where a fact with no status is written, which rules out a
  catch-all file.
- `task-board`: the boards, the routing rule and the view are named in
  `docs/feature-workflow.md`. The open brief's card no longer has a
  requirement-source list to be named in.
- `agent-rulebook`: the pre-PR sequence requirement stops naming `PLAN.md` as
  a site that must not restate it.

## Non-goals

- No catch-all replacement, such as `docs/standing-constraints.md`. A file read
  "whenever" is read always, and is `PLAN.md` under another name.
- The *Purpose* sections of `context-budget` and `task-board` are not
  rewritten. They record why each capability exists, which stays true.
- Archived changes and `docs/context/*` are not edited. They describe the time
  they were written.
- Whether the STRATZ constraint's wording outlives the last OpenDota call
  stays with `letter-patch-detection` 1.7. This change only re-points that
  task to the constraint's new home.
- Session state does not move into card bodies. `task-board` already forbids
  a card carrying what the tree holds.

## Impact

- Removed: `PLAN.md`, `checks/plan-sources.test.ts`.
- Added: `docs/design-sync.md`.
- Edited: `CLAUDE.md`, `README.md`, `docs/feature-workflow.md`,
  `docs/rulebook-growth.md`, `docs/api-design.md`, `openspec/config.yaml`,
  `.github/dependabot.yml`, `spec-inbox/README.md`, `scripts/repo-layout.ts`,
  `checks/readme-map.test.ts`, and the uncited-criteria floor in
  `scripts/spec-coverage.ts`.
- Open changes re-pointed: `scan-lift`, `match-harvest`,
  `outcome-calibration`, `laning-phase-model`, `score-calibration`,
  `hero-aliases-seed`, `letter-patch-detection`, plus the shared "`PLAN.md`
  holds no queue" clause in eleven `tasks.md` files.
- No dependency, no runtime code, nothing the app serves.
- The card goes on `Harness`: this is agent scaffolding.
