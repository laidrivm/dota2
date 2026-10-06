# glob-row-example

## Why

`openspec/specs/repo-onboarding/spec.md` §*Every path the map names is real and
shipped* carries a scenario **A glob row** whose trigger reads *the map names
`tasks/*.md`*. `notion-task-board` deleted that row along with the directory
under it, so the scenario now fires on a condition the repository cannot meet.

The requirement is intact and so is what enforces it. Measured on this tree:
two glob rows survive — `docs/research/*` and `openspec/specs/*/spec.md` — and
`checks/readme-map.test.ts` resolves every row of the live map generically,
naming no path of its own. It passes, 28 cases, and would pass with no glob row
at all. So nothing failed and nothing will: the defect is that a scenario
describes a state of the repository that stopped being true, which
`CLAUDE.md`'s *Docs describe current state only* forbids and no gate detects.

Now, because the row was deleted three days ago and the next reader of that
requirement has no way to tell a stale trigger from a live one.

The same requirement has since gone stale a second time. Its **A gitignored
row** scenario fires when *the map names `.claude/skills/`, which `.gitignore`
covers*, and `extract-harness` made the skill links tracked: the row is still
in the map, but `.gitignore` no longer covers it. The class has now bitten
twice in one requirement, and both bites sit in the block this change
replaces whole.

## What Changes

- The scenario's trigger becomes the **shape** of a row rather than one row's
  path: a map row whose path carries a glob, illustrated by a live one. What
  the criterion fixes is that a glob resolves by matching rather than by
  literal existence, and that holds however many glob rows the map has.
- The illustration is `docs/research/*`, which is live today. It is an
  illustration and not the trigger, so the scenario survives that row being
  deleted in turn — which is the whole of what went wrong here.
- **A gitignored row** takes the same shape: a row whose path `.gitignore`
  covers. No row of today's map is one, so it names no illustration, and says
  which row it used to name.

## Capabilities

### Modified Capabilities

- `repo-onboarding`: *Every path the map names is real and shipped* keeps its
  behaviour and its other five scenarios; the **A glob row** and **A
  gitignored row** scenarios' `WHEN` stop naming rows that no longer fit them.

## Impact

- `openspec/specs/repo-onboarding/spec.md` — two scenarios' `WHEN` clauses. No
  requirement text changes, no scenario is added or removed.
- `checks/readme-map.test.ts` — unchanged. It never named `tasks/*.md`: it
  reads the live map and resolves whatever rows it finds, so nothing in it
  turns on which row illustrates the criterion.
- `README.md` — unchanged. The map keeps the two glob rows it has.
- No new dependency, no new gate, no behaviour change anywhere.

## Non-goals

- **Rewriting the requirement's other row-naming scenarios.** They name
  `docs/testing.md`, `spec-inbox/` and `openspec/config.yaml` → `context:`, all
  of which are live and still fit them. They carry the same latent defect — a
  concrete path in a trigger goes stale when a change moves it — and none of
  them has gone stale. Fixing a class at the sites where it bit is the smaller
  change; the reasoning is recorded in
  `design.md` so the next occurrence is recognised rather than re-derived.
- **A gate that would have caught this.** What would catch it is a check that
  every backticked path in a spec's scenarios resolves in the tree, and that is
  a capability of its own with its own false-positive problem: a scenario may
  legitimately name a path that does not exist, which is exactly what *A doc is
  renamed but the map is not* does.
