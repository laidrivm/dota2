# Notion task board — what was measured

Save point for `notion-task-board` (PR #258, proposal stage). Everything here
was read off the live workspace or the live tree on 2026-09-01, not inferred.
The proposal states the conclusions; this records the evidence and the dead
ends, so neither is re-investigated.

## The workspace and the board

- The board is the `D2ASS` database under the page `Xapar`, which also holds a
  `Harness` database. It existed before this change and is reused rather than
  created. The workspace it sits in is named nowhere here: this repository is
  public, and the account's own name is an identifier for private content on
  the same terms the `task-board` delta applies to a view URL.
- Its schema at the time of writing: `Name` (title), `Status` (type `status`),
  `Assign` (person). No other property.
- The `Status` property has three options — `Not started`, `In progress`,
  `Done` — filed under group keys. The rendering exposes **five** keys, not
  three: `to_do`, `in_progress`, `complete`, `current`, `future`. The last two
  hold nothing.
- A group key is neither an option name nor an option identifier. Each option
  additionally carries a `collectionPropertyOption://` URL, which is its stable
  identity and is an identifier for private content — it does not belong in
  this public repository.
- What a read returns and a write sets is the option **name**: the property's
  table projection types the column as `one of ["Not started", "In progress",
  "Done"]`.

## Tool access

- `query_data_sources` is `available_with_limit` on this plan;
  `query_meeting_notes` is `upgrade_required`. Every other Notion tool reports
  `available`. So the plan is below Business.
- The tool's own description states that **view mode carries no tool-specific
  quota on any plan**, while SQL mode draws on a shared workspace usage limit
  and cannot span data sources. This is the tool's documentation, **not a
  measurement** — no `query_data_sources` call has been made against this board
  in either mode. Confirming it is open work, and the saved-view requirement in
  the `task-board` delta rests on it.

## A subagent reaches the connector, after asking

Probed read-only: a spawned agent fetched the workspace identity and the
`D2ASS` data source successfully.

The finding that matters: the connector's tools were **not in the subagent's
starting tool list**. They arrived as deferred names and became callable only
after it ran `ToolSearch`. An agent that does not know to load them reports the
board as unreachable, which is indistinguishable from the board actually being
unreachable. Any instruction sending an agent to the board must name the tools
it loads first.

## Deriving a card's status from the tree

Three statuses derive exactly, and were exercised against cases that could have
produced the opposite outcome:

- `done` — `openspec/changes/archive/<date>-<slug>/` exists. 30/30 correct.
- `ready` — the directory holds `proposal.md`, `design.md`, `tasks.md` and
  `specs/`. 16/16 correct.
- `proposing` — the directory exists and lacks one of those. Fired on exactly
  one case and stayed silent on the sixteen complete ones.

### Ruled out: deriving the middle statuses from branch names

Do not re-attempt this. Applied to the thirty archived changes, a branch-name
derivation gets **fourteen wrong** — 5 read as `implementing`, 9 as `ready`,
where all thirty are past `archiving`.

Two independent causes, both verified:

- **Nine archived changes have no `feat/<slug>` pull request at all.** Their
  work shipped on `chore/` and `fix/` branches, which `docs/git-and-prs.md`
  permits. Confirmed individually for `coderabbit-config`, `playwright-smoke`
  and `proposal-slicing`.
- **A step splits, so pull requests outnumber steps.** `snapshot-build` has 8
  steps and 16 merged pull requests (`3a/3b/3c`, `4a`–`4d`, `5/5b/5c`,
  `8a/8b`); `file-size-cap` has 8 steps and 22 (`7a`–`7g` alone is seven). So
  "merged pull requests ≥ steps" lands on the right answer by coincidence, not
  by test.

The root cause is that **nothing in this repository joins a pull request to
its change**. A derivation of the middle statuses needs that key introduced
first; it is not a scripting problem.

### Ruled out: parsing the blocking graph out of `## Ordering`

Six of the seventeen changes name a predecessor. Taking every change slug an
`## Ordering` section mentions gets the predecessor set right for **two** of
those six. For the other four it adds slugs that are not dependencies, and for
two of those the added slug is a **successor** read as a predecessor —
`laning-phase-model`'s section names `suggestion-calibration`, which comes
after it, and `lane-synergy-model`'s does the same. An edge derived backwards
blocks a task on the work that is waiting for it.

Hence the `after:` list is written, not parsed.

### `after:` in `.openspec.yaml`

Probed on a throwaway copy of `openspec/changes/candidacy-gate/.openspec.yaml`,
restored afterwards from a copy taken before the probe:

- `openspec validate candidacy-gate` → `Change 'candidacy-gate' is valid`,
  exit 0, with the extra key present.
- `openspec status --change candidacy-gate` → unchanged, `4/4 artifacts
  complete`.

**Not probed: `openspec archive`.** It relocates the directory and may validate
differently. If it rejects the extra key, the field breaks the last step of
every change. Settle this before the field is written into any
`.openspec.yaml`.

## The always-on arithmetic

Measured on `main` at `069417f`:

```text
CLAUDE.md 227 + PLAN.md 624 = 851        trigger ~500
PLAN.md:  preamble 35 | Done 72 | Queue 532 | Standing constraints 57
Queue: 34 open entries, 456 lines
       16 of them (216 lines) restate a change directory that already exists
       18 (240 lines) are findings with no directory anywhere
Sublists: Code 20, Process 24, Safety 5
```

Why pruning cannot close it: promoting the five verification rules (−12),
deleting the Done section (−72) and collapsing every proposed change's entry
to one line (−200) together leave **567**, still over. Removing the Queue
section leaves about **325**.

## Sites that restate what the change alters

Found by grep, beyond the obvious:

- `README.md:17` — ownership map row naming `PLAN.md` as the open queue.
- `CLAUDE.md:84` — the sentence naming the always-on set.
- `docs/feature-workflow.md:110` — `PLAN.md` listed as one of four places a
  changed statement is grepped in; `:114` — *Maintain `PLAN.md`*.
- `scripts/repo-layout.ts:24` — `"PLAN.md": "always-on queue, …"`.
- `docs/rulebook-growth.md` §*An always-on file past its trigger* — states
  extraction to `docs/<topic>.md` as the **only** remedy a fired trigger has.
  As written it forbids what this change does, which is to move a whole
  section somewhere that is not a doc and not in the tree.
- **Eleven `tasks.md` files** under `openspec/changes/` carry a step reading
  *Update `PLAN.md`'s queue in this step's pull request*: `beta-refit`,
  `candidacy-gate`, `hero-aliases-seed`, `lane-synergy-model`,
  `laning-phase-model`, `letter-patch-detection`, `match-harvest`,
  `outcome-calibration`, `score-calibration`, `side-and-phase-deltas`,
  `suggestion-calibration`.

## Open questions

1. Does `openspec archive` accept `after:`? Blocking, per above.
2. Can a `status` property take eight options through the MCP surface? The
   whole eight-column layout assumes it and nothing has tested it.
3. Does view mode actually escape the quota? Documented, unmeasured.
4. The board is to carry a card per archived change (30) where `PLAN.md`'s
   Done section holds 29 entries. The two differ; the archive is the
   authority, so the count to migrate is 30.
