# board-lifecycle — design

## Context

The repository and the boards change together, but only the repository goes
through review. The status names live in four places:

- the options of each board's `Status` property;
- `scripts/board-state.ts` (`Status`, the header comment) and its fixtures;
- `docs/feature-workflow.md` §*Across the stages*, which names the derived
  statuses and counts the hand-moved ones;
- `task-board`'s *Purpose*, which counts them.

Card content and order exist only on the boards.

What was measured against the live connector on 2026-10-04, through view
reads of `D2ASS` and `Harness`:

- A board has one manual order, and each column of `Board view` is that
  order's slice for one status. The view returns it: in all three of `D2ASS`'s
  columns it matched the board as the user sees it.
- A card created through the connector lands first in the order:
  `retire-plan-md` came first of 58.
- Setting a status through the connector keeps the card's place in that
  order: `retire-plan-md`, moved to `ready`, stayed first.
- The update call takes no position, so a session cannot place a card.

One thing is not measured: whether the user's drag changes the order the
view returns. Step 3 measures it before anything rests on it.

## Goals / Non-Goals

**Goals:** no card loses its status in the migration; every card short of
`done` can be ranked from the board alone.

**Non-Goals:** a derived `applying`, `applied` or `archiving`; a priority
property; rewriting `done` cards.

## Decisions

- **Migrate statuses through the union, not a rename.** Add the four new
  option names beside the eight, move every card at a retired option to its
  successor, then set the list to exactly the nine. Every card is readable at
  every point, and the result does not depend on whether the connector's DDL
  renames an option in place, which is unmeasured. A rename that worked would
  save one pass over about fifty cards. A rename that silently empties values
  would cost the board.
- **Links live in the body, not a property.** A change opens one pull request
  for its proposal (two when the proposal is split), one per step, and one for
  the archive, so the link list grows by stage. A property would hold one.
  The links end the body under a `Ссылки` line, one per line, with the
  pull request's number and kind (`proposal`, `step 2`, `archive`).
- **The summary goes above everything else in the body.** A card with no
  directory keeps its English record below the summary. A card with one keeps
  only the summary and the links (the modified *A finding that becomes a
  change*).
- **`Pointer` stays the key.** Once titles are readable, nothing else joins a
  card to its directory. `scripts/board-state.ts` reports by slug, and the
  slug is in the pointer.
- **A brief's card keeps its filename as a prefix.** `task-board` titles a
  brief's card with its filename, because the citations key on it, so
  `tasks/task-5.md` becomes `tasks/task-5.md — <what it does>`. That is both
  the key and a readable title.
- **`Done` sorts by `Pointer`, descending.** An archived change's pointer is
  `openspec/changes/archive/<date>-<slug>/`, so text order is archive order.
  This needs no new property and no write when a card is archived beyond the
  pointer it already gets. A card that reaches `done` with no directory sorts
  last. That is right for the briefs, which predate every archive.
- **`Board view` filters `done` out rather than hiding the group.** A filter
  holds whatever a later card does. A collapsed group is per-user display
  state.
- **The backfill fans out per board, each card's summary read from its own
  source.** A card with a directory takes its summary from that change's
  `proposal.md` (*Why* and *What Changes*), and pull requests from
  `gh pr list --state all --search <slug>`. A card without one takes it from
  its own record. No summary is written from the title alone.

## Risks / Trade-offs

- [The user's drag does not change the order the view returns] → Step 3
  stops and brings the measurement to the user. The queue requirement cannot
  be met by anything a session controls.
- [The derivation says `proposed` before a board is migrated] → Both boards
  migrate inside step 1's apply, before its pull request is opened. Nothing
  reconciles automatically in between.
- [A `done` card without a directory, other than a brief, sorts below older
  archives] → Accepted: such a card is a finding dropped without a change,
  and nobody reads it for recency.
- [Fifty summaries drift from proposals that later change] → The summary
  states what and why, not counts or orderings, which is where the
  proposals have drifted. `docs/feature-workflow.md` gains one line: an edit
  to a proposal's *Why* or *What Changes* re-reads its card's summary in the
  same turn.
