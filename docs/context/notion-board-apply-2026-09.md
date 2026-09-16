# Notion task board — what the apply run needs and the artefacts do not hold

Save point for applying `notion-task-board`, written 2026-09-14, after both
propose branches merged (PRs #269 and the plan half). It carries the four
things the nine steps need that `proposal.md`, `design.md`, `tasks.md` and the
delta specs do not state, and two defects in the merged `tasks.md` found after
it merged.

Its companion is `docs/context/notion-board-2026-09.md`, which records the
proposal-stage measurements and the dead ends. Neither overrides the specs.

## Task 2.2 delegates to a run whose output is not in the tree

The task reads *tests first, from the ZOMBIES run*. That run happened in the
proposal session and its report was never written down, so the task as
written points at nothing. The report is below.

Twenty-one ideas came out of it. Three became scenarios in the delta —
an empty `specs/` deriving `proposing`, an unseen slug distinguished from
`suggested`, and an `after:` holding a bare string. Sixteen are named in
tasks 2.2, 2.3, 2.4, 3.3, 6.3 and 7.5. **Three reached no artefact at all**
and are the gap this section exists to close:

- **Every slug gets exactly one status.** A run over twenty change
  directories and thirty archive directories omits no slug and counts none
  twice. Nothing else in the task list exercises the whole sweep at once.
- **An archive entry whose slug is a prefix of another** does not derive
  `done` for the longer name. This is not hypothetical here:
  `openspec/specs/review-bot-config/spec.md` already documents the
  `archive-preflight` against `archive` collision, and a prefix match would
  reproduce it in a second tool.
- **A `tasks.md` with every box ticked still derives `ready`.** The
  derivation reads the artefact set and never the boxes, which is easy to
  "improve" into reading them.

Add these three to step 2's tests. The other sixteen are already cited where
they belong.

## Step 3 — which six changes name a predecessor

`design.md` says six `.openspec.yaml` files gain an `after:` list and never
says which. Scanning every `## Ordering` section for another change's slug
gives exactly six:

```text
beta-refit             mentions hero-aliases-seed, outcome-calibration,
                       score-calibration, side-and-phase-deltas
lane-synergy-model     mentions candidacy-gate, laning-phase-model,
                       outcome-calibration, suggestion-calibration
laning-phase-model     mentions candidacy-gate, outcome-calibration,
                       score-calibration, side-and-phase-deltas,
                       suggestion-calibration
score-calibration      mentions outcome-calibration
side-and-phase-deltas  mentions match-harvest, outcome-calibration,
                       score-calibration
suggestion-calibration mentions beta-refit, lane-synergy-model,
                       laning-phase-model, side-and-phase-deltas
```

**The right-hand column is not the `after:` list.** It is the input the
proposal stage measured and rejected: taking every mentioned slug gets the
predecessor set right for two of the six, and for two others the mention is a
*successor* — `laning-phase-model` and `lane-synergy-model` both name
`suggestion-calibration`, which comes after them. An edge derived backwards
blocks a task on the work waiting for it.

So the table is a reading list, not an answer: it says which six proposals to
open and argues nothing. Write each `after:` from the prose.

### What the prose gave, written 2026-09-14

```text
beta-refit              hero-aliases-seed, outcome-calibration,
                        score-calibration, side-and-phase-deltas
lane-synergy-model      candidacy-gate, laning-phase-model
laning-phase-model      candidacy-gate
score-calibration       outcome-calibration
side-and-phase-deltas   match-harvest, outcome-calibration
suggestion-calibration  beta-refit, lane-synergy-model, laning-phase-model,
                        side-and-phase-deltas
```

Two readings decided the four columns that shrank, and both are worth naming
because a later re-derivation would otherwise reach the mention list again:

- **A window is not an edge.** `laning-phase-model` and `lane-synergy-model`
  each say they SHOULD NOT land *between* `outcome-calibration` and
  `suggestion-calibration`. That forbids an interval; it does not say which
  side of it they take, and `outcome-calibration` is a predecessor on neither
  reading. `suggestion-calibration` names both of them in its own `after:`, so
  the interval is closed from the other end, where the fact belongs. The
  argument stays in both `## Ordering` sections, which is where a reader asking
  *why* is sent.
- **A comparison is not a dependency.** `side-and-phase-deltas` says *like
  `score-calibration` it moves the score scale*, and `laning-phase-model` says
  its collisions with `side-and-phase-deltas` and `score-calibration` were
  routed into added requirements **so that neither change has to wait for the
  other**. Both mentions argue against the edge the table would have drawn.

### A seventh, which the scan could not have found

`outcome-calibration` carries no `## Ordering` section at all, so a scan of
those sections was never going to reach it — and it has the hardest
dependency of the seven. `PLAN.md`'s entry states it flatly: *cannot be
applied before `match-harvest` is applied and synced*, because its
`snapshot-ingest` delta is copied from the version that change leaves behind,
so out of order the sync replaces a five-step requirement with a three-step
one. That is the same failure `laning-phase-model` names against
`candidacy-gate`, and the one edge whose absence a session would pay for.

It mattered that this was caught before step 5 landed: the `PLAN.md` entry
holding the argument becomes a card with a pointer and an **empty body**,
because the change has a directory and a card restates nothing a directory
holds. The argument therefore had to reach that directory, and
`outcome-calibration` gains the `## Ordering` section it never had.

Adding it repairs the chain transitively rather than only its own edge:
`score-calibration` reaches `match-harvest` through it, and so do `beta-refit`
and `suggestion-calibration`. Seven files, not six.

**The reading to carry forward:** the scan was for `## Ordering` sections, and
a change with no such section is invisible to it however hard its dependency.
Scanning for the dependency instead — *cannot be applied before*, *must be
applied*, *applied and synced* — over `PLAN.md` and every proposal is what
found this one.

Derived afterwards: no cycle, every named slug resolves, and all seven are
blocked today because nothing in the chain is archived yet.

## Step 5 — the routing of the thirty-five open entries

`design.md` states the split as 21 to `D2ASS` and 14 to `Harness` and names
only the four borderline ones. The reading behind the count, by the entry's
subject:

```text
Harness (14)
  workflow hygiene stated nowhere        the skills-lock.json patch
  mutation testing's scope               scan-lift
  MCP's place in the review              tracked-file-sweep
  merged-branch-guard                    ten workflow pins
  gh-api-guard                           a captured rule sent to the
  pre-pr-sequence-gate                     costliest home
  the diff budget's missing baseline     a live spec's stale reason
                                         the always-on trigger

D2ASS (21)
  Task 5 — error tracking                outcome-calibration
  the scroll-strip criterion             score-calibration
  three glyphs carrying meaning          side-and-phase-deltas
  the e2e backlog                        beta-refit
  isTimestamp and the missing offset     laning-phase-model
  two unstated build behaviours          suggestion-calibration
  hero-aliases-seed                      focus-restore-idiom
  candidacy-gate                         lane-synergy-model
  letter-patch-detection                 snapshot.json vs its generator
  match-harvest                          bans moving a suggestion by 0.05%
                                         five letter sets naming two heroes
```

Four are genuinely arguable and `design.md` names them: Task 5 and the e2e
backlog went to `D2ASS`, `scan-lift` and the build's unstated behaviours to
`Harness`. Re-deciding any of them is fine; re-deriving all thirty-five from
scratch is what this table exists to prevent, because `design.md` asserts a
count that a different reading would contradict.

### What step 5 actually wrote, 2026-09-14

Thirty-seven cards, 21 to `D2ASS` and 16 to `Harness`. The table above is
unchanged and settled all thirty-five of its entries; the two beyond it are
both `Harness`, and neither was a re-reading:

- **`notion-task-board` itself.** `PLAN.md`'s Open section gained its entry in
  `4a6c92f`, after the count in `design.md` was taken. Its card is at
  `implementing` rather than the `ready` the tree derives — `implementing` is
  one of the five the tree cannot see, and *A status the tree cannot see* is
  the specific rule where *A card and the tree disagreeing* is the general one.
- **`drop-mutation-exemptions`.** A change directory with no bullet of its own;
  `PLAN.md` named it only inside the `scan-lift` entry. The derivation reports
  it `ready` and the queue never did, so a board built from `PLAN.md` alone
  would have been one card short of its own contract on the day it was made.
  This is the case worth carrying forward: **the card set is every task, not
  every queue entry**, and the two sources have to be unioned.

Twenty carry a `Pointer`, seventeen carry a body. Read back through both
`Board view`s: 31 rows on `D2ASS`, 36 on `Harness`, every `Pointer` either a
path or `""`.

One entry resolved by its headline rather than by a cited path:
`suggestion-calibration` still read *not yet proposed* with its directory in
the tree — the drift the proposal was written after, met while applying the
change that fixes it. Resolving entries by path alone gives that change two
cards.

## Step 6 — the briefs, and a hole in task 6.2

Task 6.2 says to build each card's body from the brief's `Status: DONE` block
*where there is one*, and from its scope for `tasks/task-5.md`. Measured, the
block is in five of the nine:

```text
DONE block   task-1, task-2, task-3, task-6, task-8
no block     task-4, task-5, task-7, task-9
```

`task-5` the task names. **`task-4`, `task-7` and `task-9` it does not**, and
all three are finished: task-4 and task-7 have archived changes
(`2026-07-25-playwright-smoke`, `2026-08-27-deploy-pipeline`), and task-9 has
neither a block nor an archive though `PLAN.md` lists it among the done.

So 6.2 as written leaves three of nine cards with no rule for their body.
Suggested: task-4 and task-7 take their archived change as the body's source
and carry its path; task-9 takes its own text, being the only one of the nine
with no other record anywhere.

Routing, by the same rule as the queue — most of the briefs are scaffolding:

```text
Harness   task-1 (bun supply chain), task-2 (Dependabot), task-3 (linting),
          task-4 (Playwright smoke), task-6 (git hooks),
          task-8 (CLAUDE.md split), task-9 (unit test setup)
D2ASS     task-5 (error tracking for the deployed product),
          task-7 (Docker image and VPS deploy)
```

That is seven and two. `design.md` says *six of the nine are scaffolding
work*, which is the same reading with `task-4` counted the other way — it is
a Playwright layer, so it is arguable either way and neither count is wrong.
Take seven and two, or take six and three and correct `design.md`; do not
leave the two figures disagreeing silently.

## The `Pointer` encoding, measured by task 1.2

Run on `D2ASS` on 2026-09-14, on a board still holding nothing: two throwaway
cards written through the connector, both read back through the `Board view`
saved view. This is what steps 4, 5 and 6 write and read, and none of them
re-derives it.

```text
write a path    "Pointer": "openspec/changes/probe-slug/"
                a plain string in the properties map — the connector takes
                SQLite values, not the REST surface's array of rich-text
                objects
write empty     omit the key entirely
read back       "Pointer": "openspec/changes/probe-slug/"
                "Pointer": ""
```

So the empty state the delta requires — *reads as empty rather than as
absent* — is what omitting the property already produces: the view returns
`""` for the card that was never given one, and there is no second value to
write for it. Setting `null` was not exercised and nothing needs it.

**The connector has no page-delete.** `create_pages`, `update_page`,
`move_pages` and `duplicate_page` are the whole page surface; nothing bins a
row. The two probes were moved to the workspace level instead, which empties
the board — the state step 4 counts from — and leaves two private pages named
`ProbePointerPath` and `ProbePointerEmpty` for the Notion UI to delete. The
same limit applies to the 76 cards steps 4 to 6 wrote: a wrong card is
corrected in place, never removed.

## What is already recorded elsewhere, and needs no repeating

- The eleven `tasks.md` files carrying a `PLAN.md` queue step, and the prose
  sites that restate what moves: `docs/context/notion-board-2026-09.md`
  §*Sites that restate what the change alters*, and the proposal's `## Impact`.
- Every probe this change rests on — `openspec archive` accepting `after:`,
  `STATUS` refusing an option list where `SELECT` accepts one, the saved view
  following the property through the conversion: `design.md` §*Decisions*.
- That the `rich_text` wire encoding was unmeasured when this note was
  written: the delta says so and task 1.2 owned it. The section above is the
  measurement it asked for.

## State of the boards when the apply run starts

`D2ASS` carries the eight `select` options already — they were written during
the design stage's probe, not by step 1 — and no `Pointer` property. Both
boards hold zero cards. `Harness` is untouched: `Name`, `Status` with the
original three options, `Assign`. `mellon` does not exist.

What step 1 left: both boards carry the eight `select` options and a
`Pointer` of type `rich_text`, and both still hold zero cards. `mellon` still
does not exist, and step 1 deliberately did not create it — the routing rule
names three boards and only two have a project behind them, so a session
finding two is reading the rule correctly rather than finding a breach. The
board is made when `mellon`'s repository is, with the same one statement
task 1.1 ran on the other two.

## A title that looks like a hostname is autolinked

Measured 2026-09-16, on the nine brief cards step 6 titles with their
filename. The connector wrote `tasks/task-6.md` with a link annotation on the
`task-6.md` span — `.md` reads as a top-level domain — so a read back through
the saved view renders `tasks/[task-6.md](http://task-6.md)`.

The card's plain-text title is exactly `tasks/task-6.md`, character for
character, so the criterion holds: the cited path is the title of exactly one
card and a search for it matches. What is wrong is the annotation alone,
pointing at a host that does not exist. Escaping the dot on write does not
remove it, and nothing in the contract reads it; stripping it is one click per
card in the Notion UI.

Worth carrying forward for `archive-digest`, which titles pages the same way:
a title that parses as a hostname comes back as a link, and the check that it
is right is the plain text rather than what the view renders.
