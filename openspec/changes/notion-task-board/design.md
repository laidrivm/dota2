# notion-task-board — design

## Context

`proposal.md` and the two delta specs merged as PR #258 and were widened on
`spec/notion-task-board-scope` to three boards, a pointer property, and the
nine task briefs. This document settles what that left open, and it exists
because three of the things the contract rests on were assumptions when the
proposal was written and are measurements now.

The workspace holds the page `Xapar` with two inline databases, `D2ASS` and
`Harness`; `mellon` does not exist yet. Both held `Name` (title), `Status`
(status, three options) and `Assign` (person), both carried a saved board
view named `Board view`, and both held zero rows.

Everything below marked *measured* was run against the live workspace or the
live tree on 2026-09-13. Everything else is a choice with its alternatives
named.

## Goals / Non-Goals

**Goals:**

- Settle the schema each board carries, and how it is arrived at.
- Settle what `scripts/board-state.ts` reads and emits.
- Fix the order the migration runs in, so that no step leaves the tree and
  the boards disagreeing in a way the next step cannot see.

**Non-Goals:**

- The archive and `spec-inbox/`. They have no status and go to pages, in
  `archive-digest`.
- The budget gate. It measures a set this change is still shrinking.
- Populating `mellon`. The board is named by the routing rule and created
  when the project exists.

## Decisions

### `Status` is a `select` property, not a `status` property

**Measured.** The connector's DDL cannot put options on a `status` property:

```text
ALTER COLUMN "Status" SET STATUS('suggested':gray, …)
  → 400 validation_error
    Invalid statements at position 32: Expected ADD, DROP, RENAME, or
    ALTER keyword, got "("
```

Position 32 is the character after `SET STATUS`, so the parser accepted the
type and then expected a new statement: `STATUS` is terminal in this grammar
and takes no option list. Nothing was written.

The same eight options on a `select` were accepted whole, in one statement,
with their colours and in the order given — verified by adding a throwaway
`ProbeSelect` column, reading the schema back, and dropping it again.

`D2ASS` was then converted:

```text
ALTER COLUMN "Status" SET SELECT('suggested':gray, 'exploring':purple,
  'proposing':orange, 'ready':yellow, 'implementing':blue,
  'reviewing':pink, 'archiving':brown, 'done':green)
```

`Harness` is untouched and gets the same statement in the migration. The
statement **replaces** the option list rather than extending it — the three
options a board carried before cease to exist — which is why running it a
second time on `D2ASS` changes nothing rather than producing eleven options.

**Why this is smaller, not merely scriptable.** The `task-board` delta
carries a section on Notion's fixed group keys — the `to_do`/`in_progress`/
`complete` mapping, the warning that a group key is neither an option name
nor an option identifier, and the argument that grouping by group would
collapse eight columns into three. All of it exists to work around the
`status` type's groups. A `select` has no groups, so the section is deleted
rather than maintained. The delta already concedes the keys are dead weight:
*the mapping above exists because the keys are fixed, not because anything
reads them.*

**What is given up.** Notion's built-in status semantics — the three-bucket
rollup and the treatments some views give a `complete` group. No requirement
reads them.

**Alternative rejected: keep `status`, add the five options by hand in the
UI.** It costs a manual precondition on two boards now and a third later,
which the apply stage can only verify by reading, never perform. Against
that it buys the group keys, which nothing reads.

### The saved view is followed, not rebuilt

**Measured.** Converting the property took the existing `Board view` with it
rather than breaking it — the view's `groupBy` moved from
`propertyType: status` to `propertyType: select` on its own, and view-mode
reads against it still return.

Two defaults arrived with the conversion and are **accepted rather than
fought**, because the DSL has no directive for either — the full
`notion://docs/view-dsl-spec` was read, and `GROUP BY "Property"` is the
whole of the grouping surface:

```text
hideEmptyGroups: true    a status holding no card shows no column
sort: {type: "manual"}   column order is hand-set, not alphabetical
```

Neither breaks the contract, and saying why is the point of recording them.
A session reads the view to learn *what work is open and at what status*; a
status with no cards has no work in it, so nothing is missed. The vocabulary
of eight names is fixed in the spec, which is in the repository — the view
was never where a session learns it. And no requirement fixes a column
order.

What this does mean is that the board will show three or four columns on the
day the migration finishes, not eight, and that is correct rather than a
failure to configure.

### The pointer is a `rich_text` property named `Pointer`

A card's pointer is a repository-relative path — `openspec/changes/<slug>/`
— for every card whose subject has a directory, and reads as empty rather
than as absent for the rest.

**The wire encoding of those two states is not settled and is the first thing
step 1 measures.** Notion's REST surface takes a `rich_text` value as an array
of rich-text objects rather than a scalar, and no write through this
project's connector has been made either way, so neither "the empty string"
nor `rich_text: []` is a measurement. The delta states the observable and
defers the encoding on purpose; what settles it is one card written and read
back, on a board that is still empty. Getting this wrong the other way has
already cost this change once — the eight status options were assumed
settable and were not.

**Not `url`.** A repository-relative path is not a URL, and a `url` property
that holds one either renders a broken link or forces an absolute
`github.com` address into the card. The second is worse than it looks: it
pins a card to a host and a default branch name, both of which are facts
about today.

**Not `relation`.** A relation joins rows within or across data sources, and
the contract has just forbidden the one cross-board join it would serve.

**Not the card body.** A property is what a view can display and a query can
filter on. The saved view exists to spare a session from opening cards, and
a pointer only readable by opening one gives that back.

### `after:` is safe to write into `.openspec.yaml`

**Measured**, and it was the blocking unknown the save point recorded. A
fabricated change carrying `after: [candidacy-gate]` was validated, archived
and inspected:

```text
openspec validate probe-after-key            → valid, exit 0
openspec archive probe-after-key -y --skip-specs
                                             → archived, exit 0
archive/2026-09-13-probe-after-key/.openspec.yaml
                                             → after: key present, verbatim
```

The probe ran on a fabricated directory rather than a real change, and both
directories were removed afterwards; `git status` was clean.

So the field does not break the last step of every change, which is what the
save point said had to be settled before it was written anywhere.

### `scripts/board-state.ts` is a pure function over the tree

Filesystem in, JSON out. No network, no connector, no token. It emits, for
`D2ASS` cards only:

- the derived status of each slug it can see — `done`, `ready`, `proposing`
- the `after:` list of each unapplied change, and which of those slugs are
  not yet `done`

It emits nothing for the five hand-moved statuses and nothing for a card on
`Harness` or `mellon`. An agent carries its output to the board; the script
never writes there. That keeps the whole of its behaviour exercisable from a
fabricated directory, which is how its test is written.

### Routing the cards that exist today

The rule is the owning repository. Applied to the thirty-five open entries
by reading their subjects:

```text
D2ASS    21   draft model and calibration chain, board and picker,
              snapshot build and ingest, hero data, deploy
Harness  14   rulebook and captured rules, review toolkit and the bot,
              commit and diff gates, workflow pins, skills, repo layout
```

Four are genuinely borderline and are named so the apply stage does not
re-argue them silently: **Task 5** (error tracking is infrastructure, but
it watches the product) and **the e2e backlog** (run by harness tooling,
about product behaviour) go to `D2ASS`; **`scan-lift`** (a repository scan
script) and **the build's unstated behaviours** go to `Harness`.

The thirty archived changes and the nine briefs are routed by the same rule
when their cards are made. The briefs lean the other way from the queue —
six of the nine are scaffolding work.

## Risks / Trade-offs

- **A hand-moved status is moved by nobody.** → The reconciliation repairs
  only the three derived ones, by construction. This is the part of the
  contract that is honoured rather than mechanised, and the proposal says so;
  the mitigation is that the three that *can* be checked are checked, not
  that all eight are.
- **`hideEmptyGroups` hides a status somebody is looking for.** → Accepted.
  The eight names are in the spec, and a column with no cards has no work.
- **The conversion is not reversible to the original three options.** →
  Both boards held zero rows when it ran, so nothing lost a value. Reverting
  would mean re-adding three options by hand, and nothing wants them back.
- **`D2ASS` is already converted and `Harness` is not.** → The option
  statement replaces the whole list, so running it on both is idempotent on
  the one already done rather than additive. The step does not have to branch
  on which board is in which state.
- **The pointer's encoding is unmeasured when step 1 begins.** → It is
  measured there, before any card is written, on boards that still hold
  nothing. A wrong guess discovered at step 4 would mean rewriting thirty
  cards; discovered at step 1 it costs one.

## Migration Plan

Order matters only where a step would otherwise leave the tree and the
boards disagreeing invisibly.

1. **Schema.** `Harness` gets the eight-option `select`; both boards get
   `Pointer`. Idempotent — read the schema, apply the difference.
2. **`scripts/board-state.ts`** and its test, against a fabricated tree.
3. **Cards from the archive** — thirty at `done`, pointer set, bodies empty.
   First because their status is the one that derives 30/30, so a mistake
   here is visible immediately.
4. **Cards from the open queue** — thirty-five, routed 21/14, each at the
   status the script derives or at `suggested` where it derives none.
5. **Cards from the briefs** — nine, bodies carrying the `Status: DONE`
   block where there is one.
6. **`after:` into the six `.openspec.yaml` files** that name a predecessor.
7. **`PLAN.md`** loses the Queue section and the `tasks/task-5.md` source;
   `tasks/` is deleted with its README row.
8. **The eleven `tasks.md` steps** are retargeted, and the prose sites the
   proposal lists are reconciled.

Steps 3 to 5 are the only ones that write to Notion, and each is checkable
afterwards by re-deriving and comparing.

**Rollback.** Before step 7, everything is additive: the boards carry cards
nothing reads yet and `PLAN.md` still holds the queue. Step 7 is the point
of no return, and what makes it safe is that step 3's thirty cards are
re-derivable from the tree at any time.

## Open Questions

1. **Does view mode escape the quota under load?** The tool's own
   documentation says view mode carries no tool-specific quota on any plan.
   Four view-mode reads have now run against these boards without error,
   but all four were against empty boards. Unresolved until a board holds
   cards, and cheap to check then.
2. **Where does a card's body live for a `Harness` card after the harness
   leaves this repository?** The routing rule places the card; it does not
   say what happens to the pointer when the slug starts addressing a
   directory in a repository this one cannot read. `archive-digest` does not
   answer it either.
3. **How does `rich_text` encode a path and an empty value through this
   connector?** Deliberately open, and the only one of the three with an
   owner: task 1.2 settles it before a card is written. It is listed here
   rather than treated as settled because the delta declines to fix an
   encoding nobody has exercised, and a reader of this document should not
   conclude from the `Pointer` decision above that the wire shape is known.
