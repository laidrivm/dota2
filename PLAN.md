# Implementation plan — agent working file

This file names where the work is.

## Where the work is

The queue is not here. Every task with a status is a card on one of three
boards in the Notion workspace, read through the saved view named `Board view`
and never through a SQL query:

- `D2ASS` — this repository's product work.
- `Harness` — the agent scaffolding, which is to leave for a repository of its
  own. Its cards stay whether or not that work is still carried out here.
- `mellon` — the second project that will sit on that scaffolding. Named by the
  routing rule; the board is made when the repository is.

Named rather than linked: this repository is public and the boards are not, so
a board or view URL is an identifier for private content and does not belong in
a tracked file. `scripts/board-state.ts` derives `proposing`, `proposed`
and `done` for `D2ASS` from the file tree alone, and reports nothing for the
other six statuses or the other two boards — those move by whoever does the
work, in the turn the work moves.

## Requirement sources

- The `tasks/task-5.md` card on `D2ASS` — error tracking, the infrastructure
  task still open. The brief it is named for has left the tree; the card holds
  its scope.
