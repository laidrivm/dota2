# board-lifecycle

## Why

The boards can't be ranked by the person who ranks them. A card becomes a
slug and an empty body the moment its change directory exists: twelve of
`D2ASS`'s cards at `ready` read `beta-refit`, `candidacy-gate` and the like,
with nothing on the card to say what each one does or how big it is. The
statuses also don't match the OpenSpec stages they track. `suggested` and
`ready` have to be explained, two stage handovers (*context gathered*,
*merged and waiting to archive*) have no column, and `implementing` and
`reviewing` split one stretch of work that a session never pauses between.

## What Changes

- **BREAKING (board vocabulary):** nine statuses replace eight, one per
  OpenSpec handover: `idea`, `exploring`, `explored`, `proposing`, `proposed`,
  `applying`, `applied`, `archiving`, `done`. `scripts/board-state.ts` derives
  `proposed` where it derived `ready`. Every live card is carried over to the
  new name without losing its status.
- Every card short of `done` carries an English title saying what the change
  does, not its slug. Its body opens with a summary in Russian of at most 500
  characters and ends with links to the change on GitHub: `proposal.md` once
  merged, and every pull request the change has opened. `Pointer` stays as the
  key that joins a card to its directory.
- A column is a queue. A session takes the first takeable card in the order
  the board view shows, and the user's drag sets that order. `done` leaves the
  board view for a view of its own, newest first.
- Every card short of `done` on `D2ASS` and `Harness` is backfilled to the new
  shape.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-board`: the status vocabulary and the derived status it renames; what
  a card's title and body carry, the summary relaxing the rule that a card
  copies nothing the tree holds; the order a session takes work in, and where
  `done` cards are read.

## Non-goals

- No priority property or rank number. The drag already sets the order the
  view returns, and a second ordering would have to be kept in step with it.
- No new derived status. `applying`, `applied` and `archiving` still have no
  key in the tree that joins a pull request to its change, the reason
  `task-board` already records for refusing `implementing`.
- `done` cards keep their slugs and bodies. They are read to look something
  up, not to rank.
- No new connector, and no network read from `scripts/board-state.ts`.
- The README already says what the board needs (`chore/readme-task-board`).

## Impact

- `openspec/specs/task-board/spec.md`: four requirements modified, one of
  them renamed, and two added.
- `scripts/board-state.ts` and its tests: `ready` becomes `proposed`.
- `docs/feature-workflow.md`: the derived-status line.
- Both live boards: the `Status` options, the `Board view` filter, a new
  `Done` view, and about fifty cards retitled and summarised.
- No dependency, no runtime code, nothing the app serves.
