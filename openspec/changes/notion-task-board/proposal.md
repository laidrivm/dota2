# notion-task-board

## Why

The always-on set is **851 lines** against the ~500 `context-budget` fixes —
`CLAUDE.md` 227 plus `PLAN.md` 624 — and 532 of `PLAN.md`'s 624 are the queue
and the log of what is done. The trigger has now fired four times, and each
time the cause was the same: `PLAN.md` recorded work. It is not rules
accumulating, so pruning rules cannot reach it. Promoting the five
verification rules `docs/rulebook-growth.md` names (−12), deleting the Done
section the archive already records (−72) and collapsing every proposed
change's entry to one line (−200) together leave the set at **567**. The
arithmetic does not close while the queue lives in a file read at every
session start.

Size is the visible half. The other half is that the queue drifts, twice in
the week this was written: the `suggestion-calibration` entry still reads
**not yet proposed** with its proposal merged, and the entry recording the
trigger says **743** against a measured 851. Both for one reason — a status
had to be remembered and typed by whoever finished the work, and a file is
the wrong instrument for a status. Nothing reads a queue entry to check it.

## What Changes

- The open queue and the done log leave `PLAN.md` for the `D2ASS` database in
  the Notion workspace, which becomes where a task's status is recorded and
  read. `PLAN.md` keeps the standing constraints, the requirement sources and
  the growth protocol — what it holds that is not a status.
- A card carries a status out of eight, a pointer to where its content lives,
  and nothing else. **The board holds no content the repository holds**: a
  proposed change's substance stays in `openspec/changes/<slug>/`, an
  archived one's in `openspec/changes/archive/`, and the card points at it.
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

## Capabilities

### Added Capabilities

- `task-board`: what the board records, which statuses derive from the tree
  and which do not, how a session reads it, and what a card may not hold.

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

## What derives, measured

Run against the tree as it stands, all sixteen unapplied changes and all
thirty archived ones:

```text
status         what makes it true                              verdict
proposing      openspec/changes/<slug>/ exists, incomplete     1/1, and silent
                                                               on the 16 that
                                                               are complete
ready          the directory is complete, no step applied      16/16 correct
done           openspec/changes/archive/<date>-<slug>/ exists  30/30 correct

suggested      nothing in the tree — the card is the record    not derivable
exploring      nothing in the tree — /opsx:explore leaves none not derivable
implementing   —— no key joins a pull request to its change ——  14/30 wrong
reviewing      ——                                          ——  14/30 wrong
archiving      ——                                          ——  14/30 wrong
```

The two at the top of the second block are the reason the board is worth
having at all: eighteen of the thirty-four open entries are findings with no
change directory, and the tree has nowhere to put them. The three below them
are the reason it is not worth deriving everything.

## Impact

- `PLAN.md` — loses the Queue section, 532 lines, and the opening sentence
  that names the queue as what the file holds. The always-on set falls from
  851 to about **325**, which is under the trigger with room for the growth
  that has fired it four times.
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
- Eleven `tasks.md` files under `openspec/changes/` — one step each.
- No new dependency, no new secret, no new environment variable. The project
  keeps its single runtime dependency.

## Consequences worth stating

- **This repository is public and the board is not.** What a reader of the
  repository can see today — what is planned and what is in flight — stops
  being visible to them. The archive still records everything that shipped.
- **The queue stops being readable offline and stops being in git.** A
  session with no connector attached can read the tree and the archive, and
  cannot read the eighteen findings that live only on the board. There is no
  recorded history of a card's edits beyond what Notion itself keeps.
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

## How this proposal ships

`design.md` and `tasks.md` follow on `spec/notion-task-board-plan`, which
opens from the default branch once this one has merged, on the terms
`docs/git-and-prs.md` fixes for a proposal over the diff budget's failing
threshold. The change directory is incomplete on purpose until the second
branch lands.
