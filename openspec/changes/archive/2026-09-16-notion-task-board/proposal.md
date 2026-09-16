# notion-task-board

## Why

The always-on set is **899 lines** against the ~500 `context-budget` fixes —
`CLAUDE.md` 208 plus `PLAN.md` 691 — and 591 of `PLAN.md`'s 691 are the queue
and the log of what is done. The trigger has now fired four times, and each
time the cause was the same: `PLAN.md` recorded work. It is not rules
accumulating, so pruning rules cannot reach it — measured again twelve days
after this proposal was first written, the set had grown 48 lines while
`CLAUDE.md` itself shrank by 19. Promoting the five verification rules
`docs/rulebook-growth.md` names (−12), deleting the Done section the archive
already records (−72) and collapsing every proposed change's entry to one
line (−200) together leave the set at **615**. The arithmetic does not close
while the queue lives in a file read at every session start.

Size is the visible half. The other half is that the queue drifts, twice in
the week this was written: the `suggestion-calibration` entry still reads
**not yet proposed** with its proposal merged, and the entry recording the
trigger says **743** against a measured 899. Both for one reason — a status
had to be remembered and typed by whoever finished the work, and a file is
the wrong instrument for a status. Nothing reads a queue entry to check it.

## What Changes

- The open queue and the done log leave `PLAN.md` for the boards in the Notion
  workspace, which become where a task's status is recorded and read.
  `PLAN.md` keeps the standing constraints, the requirement sources and the
  growth protocol — what it holds that is not a status.
- **There are three boards, not one.** `D2ASS` holds this repository's product
  work, `Harness` the work on the agent scaffolding, which is to leave for a
  repository of its own, and `mellon` a second project that will sit on that
  same scaffolding. A card goes to the board of the repository that owns the
  work. The two that are not this repository's are named here rather than
  discovered per card, because the routing rule is what decides where a card
  is looked for when it is not on the board somebody expected.
- **Derivation is scoped to `D2ASS`.** It is the only board whose tree is this
  repository, so `scripts/board-state.ts` reports the three derived statuses
  for its cards and nothing at all for the other two, whose cards move by hand
  entirely. An `after:` edge therefore never crosses a board: a slug addresses
  a change directory in *this* repository, and nothing addresses one
  elsewhere — the same absent key that stops the middle statuses deriving.
- A card carries its pointer in a **property**, not in its body. Neither live
  board has such a column: `Name`, `Status` and `Assign` are the whole schema
  of both, read off the live databases, so the requirement below has nowhere
  to land until one is added.
- A card carries a title, a status out of eight, and a pointer to where its
  content lives. **The board holds no content the repository holds**: a
  proposed change's substance stays in `openspec/changes/<slug>/`, an
  archived one's in `openspec/changes/archive/`, and the card points at it.
  A card whose subject has no directory anywhere is the exception the rule
  implies — there the body is the record, because nothing else holds it.
- Three of the eight statuses are **derived** from the file tree by
  `scripts/board-state.ts`, which reads no network and asks no service. The
  other five are moved by whoever does the work, in the turn the work moves.
- The board is read through a **saved board view**, never through SQL.
- A card carries what blocks it, so that a session choosing work does not take
  a task whose predecessor has not landed. The edge is **derived like the
  three statuses**, from a new `after:` list in each change's `.openspec.yaml`
  — not hand-set on the board, which would be a second copy of what
  `## Ordering` already says and would drift the way the queue did.
- The eleven `tasks.md` files carrying a step that updates `PLAN.md`'s queue
  are retargeted, so no unapplied change is left pointing at a queue that is
  gone.
- The nine briefs under `tasks/` become nine cards, one each, and the
  directory leaves the tree. None of them has a change directory anywhere —
  they predate OpenSpec in this repository — so every one is the case the
  contract already describes, where the card body is the record. `PLAN.md`
  collapses six of them into a single line today, which is why they are
  counted here rather than read out of the queue. `tasks/task-5.md`, the one
  still open, stops being a requirement source in `PLAN.md`; its card becomes
  the source.

## Capabilities

### Added Capabilities

- `task-board`: what the board records, which statuses derive from the tree
  and which do not, how a session reads it, what a card may not hold, and the
  lifecycle a card follows from a body-only record to a pointer — including
  which boards that lifecycle applies to.

### Modified Capabilities

- `context-budget`: *PLAN.md holds the open queue and the standing
  constraints* is what this change contradicts — it requires the queue to
  live in the file this change takes it out of. The budget requirement itself
  is untouched: the set is still `CLAUDE.md` plus `PLAN.md` measured against
  ~500, and this change is how it gets back under.

## Non-goals

- **Deriving the five agent-moved statuses.** Measured, not assumed: applying
  a branch-name derivation to the thirty archived changes gets fourteen wrong.
  Nine of them shipped with no `feat/<slug>` pull request at all — the work
  went out on `chore/` and `fix/` branches, which `docs/git-and-prs.md`
  permits — and the step count does not match the pull-request count because
  a step splits (`snapshot-build` has 8 steps and 16 merged pull requests:
  `3a/3b/3c`, `4a`–`4d`, `5/5b/5c`, `8a/8b`). There is no key in this
  repository joining a pull request to its change, and inventing one is a
  change of its own rather than a line in this one.
- **Writing to the board from a script, a hook or CI.** That needs a Notion
  integration token, a secret in two places and a network path in the test
  suite. The derivation is a pure function over the file tree and stays one;
  the agent is what carries its output to the board.
- **Moving the standing constraints.** They are not tasks and have no status.
- **Making the board authoritative over anything the repository holds.**
  Where the two disagree about a derived status, the tree is right and the
  card is corrected.
- **Moving `openspec/changes/archive/` or `spec-inbox/`.** Both go to Notion,
  and neither goes here. The line is whether the thing has a status: a task
  has one and becomes a card, and reference prose has none and becomes a
  page. The archive is also what the `done` derivation reads, so taking it
  out of the tree costs the one rule that is 30/30 correct and has to buy
  that back with a digest — an argument this change does not need to make in
  order to close the budget. `archive-digest` carries both.
- **Gating the always-on budget mechanically.** The ~500 trigger is asserted
  as text in `checks/rulebook.test.ts` and measured by nothing, in a
  repository that gates diff size, file size, mutants and criterion
  coverage. That gate lands after this change and after `archive-digest`,
  so that it is green when it arrives rather than red on the day it is
  written.
- **Populating the boards that are not this repository's.** `Harness` and
  `mellon` are named so the routing rule is complete; the cards this change
  creates on them are the ones `PLAN.md` is holding today, and no work is
  done to fill them from anywhere else.

## What derives, measured

Run against the tree as it stands, all twenty unapplied changes and all
thirty archived ones:

What makes each of the three true is stated in the `task-board` delta and
nowhere else. These are the verdicts of running it:

```text
status         verdict
proposing      nothing left to fire on, and silent on all 20
ready          20/20 of the directories expected ready
done           30/30 of the archived changes

suggested      not derivable — nothing in the tree records a finding
exploring      not derivable — /opsx:explore leaves no trace
implementing   14/30 wrong — no key joins a pull request to its change
reviewing      14/30 wrong — likewise
archiving      14/30 wrong — likewise
```

The two at the top of the second block are the reason the board is worth
having at all: seventeen of the thirty-seven open entries have no change
directory, and the tree has nowhere to put them. The three below them
are the reason it is not worth deriving everything.

The `ready` count was 19 of 20 while this change's own directory was
incomplete on purpose, which made it the one case `proposing` had to fire on.
Both of its proposal branches have since merged, so the directory is complete,
the count is 20 of 20, and no directory in this repository derives `proposing`
today. The rule is exercised where its other cases already are — against the
fabricated tree in `scripts/board-state.test.ts`, which is the only place a
directory can be held half-written without a change being held open to hold
it.

## What the boards hold today

Read off both live databases rather than assumed:

```text
                D2ASS                      Harness
schema          Name, Status, Assign       Name, Status, Assign
Status options  Not started | In progress | Done      (3, not 8)
saved view      "Board view", grouped by option, on both
rows            0                          0
```

Three things follow. The saved-view requirement is already satisfiable — a
view of that name exists on both, grouped as the requirement asks, so nothing
is created and the name is what an instruction carries. The `Status` property
carries three options that are not any of the eight, which is why the delta
states the vocabulary as a replacement rather than an addition — the
migration rule and the option names are its to fix, not this file's. And
there is no column for the pointer on either, so one is added before a card
is written, to the name and type the delta fixes.

Both boards being empty, the migration starts from nothing and conflicts
with nothing.

## Impact

- `PLAN.md` — loses the Queue section, the opening sentence that names the
  queue as what the file holds, and the `tasks/task-5.md` entry under
  Requirement sources. Measured when it ran: the section was 604 lines rather
  than the 591 estimated here, having grown by this change's own entry, and
  `PLAN.md` went 704 → 122 while `CLAUDE.md` went 208 → 212, the four lines
  being the sentence that says where the queue is now. The always-on set
  falls from **912 to 334** — where this file predicted 899 to about 308,
  both figures taken before that entry was added — which is under the trigger
  with room for the growth that has fired it four times.
- `docs/rulebook-growth.md` §*An always-on file past its trigger* — it states
  the one remedy a fired trigger has, *move whole sections to
  `docs/<topic>.md`*, and this change takes a whole section somewhere that is
  not a doc and not in the tree. As written the protocol forbids what happens
  here, so it gains the second remedy and the test that picks between them:
  extraction moves what a session reads on demand, relocation moves what a
  session **writes** — a status, which no file is the right instrument for.
- `scripts/board-state.ts` — new, plus its test. Filesystem in, statuses and
  blocking edges out.
- `openspec/changes/*/.openspec.yaml` — six of them gain an `after:` list,
  which is where the six proposals that name a predecessor put the fact
  their `## Ordering` states in prose. Probed rather than assumed: `openspec
  validate` reports a change carrying the extra key as valid and `openspec
  status` reads it unchanged.
- `CLAUDE.md` §*Maintenance & growth* — the sentence naming what the set
  holds, and the rule that sends a status to `PLAN.md`.
- `docs/feature-workflow.md` — *Maintain `PLAN.md`* becomes an obligation to
  the board, and `PLAN.md` leaves the list of four places a changed statement
  is grepped in.
- `README.md` ownership map and `scripts/repo-layout.ts` — both describe
  `PLAN.md` as the queue.
- `tasks/` — the directory and its nine files leave, and with them the
  `README.md` ownership row naming it. The row goes *because* the directory
  does: `scripts/repo-layout.ts` refuses a documented directory holding no
  tracked file, so a row left behind fails the layout check rather than
  merely reading stale.
- Eleven `tasks.md` files under `openspec/changes/` — one step each.
- No new dependency, no new secret, no new environment variable. The project
  keeps its single runtime dependency.

## Consequences worth stating

- **This repository is public and the board is not.** What a reader of the
  repository can see today — what is planned and what is in flight — stops
  being visible to them. The archive still records everything that shipped.
- **The queue stops being readable offline and stops being in git.** A
  session with no connector attached can read the tree and the archive, and
  cannot read the sixteen findings that live only on the board. There is no
  recorded history of a card's edits beyond what Notion itself keeps, which
  is accepted: what a card holds is a status, and a status has no text worth
  reviewing a diff of.
- **Nine briefs stop being greppable, and four archived citations go stale.**
  Counted: `tasks/task-7.md` is named in `archive/2026-08-27-deploy-pipeline`
  twice, `tasks/task-8.md` in `archive/2026-08-01-always-on-context-budget`
  once, `tasks/task-1.md` in `archive/2026-07-27-agent-permissions-gaps`
  once. An archived change is never edited to keep a citation current, so all
  four are left standing and resolve to a card instead of a path — which is
  what the card's body being the record is for. One live citation is not
  archived and is corrected: `docs/context/pipeline-yield-2026-07.md` names
  `tasks/task-8.md`.
- **A subagent reaches the connector, but not without asking.** Probed
  read-only: a spawned agent fetched both the workspace identity and the
  `D2ASS` data source. The connector's tools were **not in its starting tool
  list** — they arrived as deferred names and became callable only after it
  searched for them, so an agent that does not know to load them reports the
  board as unreachable rather than as unloaded. Whatever instruction sends an
  agent to the board has to name the tools it must load first.

## Ordering

Independent of the calibration chain and of every change in
`openspec/changes/` — it touches their `tasks.md` and none of their subject
matter. It should land before them rather than after, because each of those
eleven steps updates a queue that would otherwise have to be updated and then
removed.

It is first of three that together take the prose tied to features and tasks
out of the tree:

```text
1. notion-task-board   what has a status becomes a card
2. archive-digest      what has none becomes a page, and the digest left
                       behind is what keeps `done` deriving
3. the budget gate     measures the set once there is nothing left to move
```

`archive-digest` comes after because it needs a board to point its pages at
and the routing rule to know which one. The gate comes last because a gate
written while the set is 899 against a trigger of ~500 is red on the day it
lands and stays red for two changes, and a gate that is expected to be red
is not read.

## How this proposal ships

`design.md` and `tasks.md` follow on `spec/notion-task-board-plan`, which
opens from the default branch once this one has merged, on the terms
`docs/git-and-prs.md` fixes for a proposal over the diff budget's failing
threshold. The change directory is incomplete on purpose until the second
branch lands.
