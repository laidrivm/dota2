# Design — reviewable diff gates

## Context

The repository's merged history, measured with `gh pr view --json files` and
the exclusions this change defines (`bun.lock`, `*.woff2`,
`src/fixtures/snapshot.json`):

| PR | counted | what it was |
|----|---------|-------------|
| #13 | 3041 | draft board |
| #10 | 2412 | UI foundation |
| #16 | 1718 | hero picker (Phase 2c) |
| #21 | 1688 | propose agent config improvements |
| #8 | 1437 | core prediction model |
| #19 | 1120 | Playwright smoke |
| #15 | 868 | propose hero picker |
| #30 | 678 | agent permission gaps |
| 18 others | 84–439 | archives, chores, config |

Median 194, upper third beginning near 380. Eight PRs (31%) exceed 500; seven
(27%) exceed 800. The thresholds this change adopts therefore bite roughly the
top third, which is what a sensor should do.

The enforcement surfaces already exist: a pre-commit hook running `biome
check --staged`, a pre-push hook running `typecheck` and `bun test`, and four
CI workflows. Biome 2.5.4 is installed and carries both rules this change
needs. Nothing new is added to the toolchain.

## Goals / Non-Goals

**Goals:**

- Make "one reviewable cycle" a number, so the splitting rule meets the
  project's own rule quality bar.
- Detect a failed slice at push and block it at merge.
- Enforce the one import arrow that keeps the prediction model isolated.
- Add no dependency and no new tool.

**Non-Goals:** as listed in the proposal — per-file caps, the rule of two, a
criteria-traceability script, a full layer lattice, retiring `/triage`,
exempting tests.

## Decisions

### The cap counts everything readable, tests included

Rejected: a separate budget for source and tests, with tests uncapped. That
heuristic belongs to teams where a human writes tests reluctantly, and a
combined cap creates pressure to write fewer. Here tests are written by an
agent, are nearly free to produce, and are the exact place agent slop hides —
`docs/testing.md` already says a test mirroring the implementation passes
against broken code. Exempting them would remove review attention from the
part that most needs it. The split is still printed, because a 3:1 ratio on
one slice says something; it just does not decide the verdict.

### The exclusion list is short and literal

Only `bun.lock`, `*.woff2`, `src/fixtures/snapshot.json` and checkbox-only
lines are subtracted. `openspec/**` is deliberately **not** excluded, even
though it dominates most diffs (1581 of #21's 1688 lines, 933 of #13's 3041).
A 1688-line proposal is genuinely unreadable, and the remedy the gate points
at — sequenced proposals — is the remedy `openspec/config.yaml` already
prescribes. Excluding the directory would exempt the artefact where the
project's own analysis locates the root cause.

Consequence to accept: archive PRs (94–423 openspec lines) stay comfortably
under 500, and proposal PRs will have to get smaller. That is the intent, not
a side effect.

### The cap is a sensor, not the mechanism

A 2000-line horizontal task under a 500-line ceiling yields four horizontal
stumps — "added the model", "added the reducer", "added the markup", "wired it
up" — none of which works alone or can be judged alone. That is strictly worse
than one large PR. So the causal fix sits at propose: a step closes one to
three acceptance criteria and leaves the application working. The line count
is insurance for the case where one criterion turned out thicker than it
looked on paper.

### The slice is counted in acceptance criteria, not in lines

Lines are a crude proxy for review cost: 500 lines of mechanical rename are
cheaper than 150 lines of subtle reducer logic. Criteria are the unit the
project already writes in EARS form and already requires each task to cite
(`rules.tasks` in `openspec/config.yaml`), so the count is available without
new machinery. Phase 2c would have been six such slices — picker, undo toast,
reset dialogue, hotkeys, `usedAs` with the re-pick marker, tokens — each a few
hundred lines including tests.

### One override marker, not two

Considered: separate `oversize:` and `mechanical:` markers, the latter for
homogeneous transformations. Collapsed to one. `mechanical:` is a *reason*,
not a category, and the requirement that already carries the weight is
"name the reason". Two markers would be a second thing to remember and a
second thing to check for identical effect.

### Bash over TypeScript for the budget script

`git diff` and `grep` do the whole job in about twenty lines. A `bun` script
would need the same shell-out plus a test harness. The script reads the patch
rather than `--numstat`, because the checkbox rule is about line content:

```sh
patch() {
	git diff "$base...HEAD" -- . ':(exclude)bun.lock' ':(exclude)*.woff2' \
		':(exclude)src/fixtures/snapshot.json' "$@" \
		| grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'
}
```

Counting is then: every line that is not a task-list checkbox, plus every
checkbox line that finds no partner on the other side of the diff. Two
checkbox lines pair only when all three conditions hold — they come from the
same file, their text is identical once the box is normalised to one token,
and their boxes are opposite. That is a tick, or its reverse, and nothing
else.

Each condition earns its place. The path belongs in the pairing key, or a
ticked task in one file cancels an identically worded task deleted from
another. The boxes must differ, or an identical task line moved between two
files cancels itself although neither half changed state. And the text must
match after normalisation, or the earlier netting bug returns.

So: sixty newly authored task lines pair with nothing and count sixty; a task
whose text was rewritten pairs with nothing either, and counts; a task line
moved verbatim counts on both sides. Pairing is two `comm` passes over sorted
streams keyed by `path + normalised text` — removed `[ ]` against added `[x]`,
then removed `[x]` against added `[ ]` — with the path taken from the
enclosing `+++` header.

Rejected: netting the counts, `|added − removed|`. It is shorter, but it
cancels a rewritten task line against an unrelated tick, which is precisely
the "differ solely in the checkbox state" the requirement excludes.

Rejected: dropping every checkbox line unconditionally. It is one `grep -v`
shorter and wrong in the direction that matters — a proposal PR authoring
`tasks.md` would have its largest artefact deducted from the very budget meant
to keep proposals small.

The source/test split runs the same pipeline twice with the pathspec narrowed
to and away from `*.test.ts`, `*.test.tsx` and `e2e/**`. Classification is by
pathspec, not by substring, so `src/app/latest.ts` stays source.

Per the project's testing rules the script gets one runnable check of its own,
against fabricated diffs rather than the live repository — a test measuring
the real branch would change its verdict with every commit.

### Biome, not a grep and not a custom test

Verified against Biome 2.5.4 before this design was written, on a scratch
project with the exact configuration shape:

- `suspicious.noImportCycles` reported a two-file cycle on both files.
- A `style.noRestrictedImports` override on `src/model.ts` and `src/types.ts`
  with `patterns: [{ group: ["./app/**", "**/app/**"], message: … }]` reported
  the violation and printed the custom message.
- The same override flagged `import type { S } from "./app/session.ts"`, so
  the boundary covers type-only imports without extra configuration. This is
  the opposite of `noImportCycles`, whose `ignoreTypes` defaults to true —
  correctly, since a type-only import is erased at runtime.

Rejected: fifteen lines of grep in CI, and an `imports.test.ts` walking the
graph in the style of `readme-map.test.ts`. Both are code this project would
own and maintain; the linter is already installed, already runs in the
pre-commit hook and `lint.yml`, and reports at the exact line.

### One arrow, not a layer lattice

The import graph today is already clean — `types.ts` is a leaf, `model.ts`
imports only it, and the app modules fan out from `session.ts`/`storage.ts`.
Writing that shape down as an enforced lattice would encode an accident.
`src/app/picker/picker.tsx` importing `../board/hero-tile.tsx` is a sideways
import a lattice would have to permit by name. The one arrow with a stated
reason — the model must stay testable in isolation, and is the module a
mutation-testing pass would target — is the one worth enforcing.
`noImportCycles` is enabled repository-wide because it costs one line and
catches the wrong-way import the arrow does not cover.

## Risks / Trade-offs

- **Horizontal stumps.** A tight cap can produce four unreviewable fragments
  instead of one large PR → the criteria rule and the stub-at-the-seam
  requirement are what prevent it; the cap is checked after them, not instead.
- **The threshold is wrong for this repo's next phase.** Phase 3 (data
  pipeline) may have a different natural slice size → the numbers live in one
  place in the script, and the gate line prints the count on every run, so a
  month of readings is available before adjusting.
- **`oversize:` becomes routine.** An override used on most PRs is a rule
  nobody follows → the reason is in the PR body and therefore in the merge
  history; if it recurs, the threshold is wrong and gets moved rather than
  ignored.
- **CI needs the full history.** `actions/checkout` defaults to a shallow
  clone, so `<base>...HEAD` fails without `fetch-depth: 0` → the workflow sets
  it, and the script exits non-zero with a stated reason when it cannot
  measure, so an unresolvable base fails the check instead of silently
  retiring the gate. Softness lives at the call site: the pre-push hook
  absorbs any non-zero exit, which is the same mechanism that already keeps a
  FAIL from blocking a push.
- **`/triage` may lose its purpose.** If PRs settle near 500 lines, a diff can
  be read whole → not removed here; re-check after a month of measurements.

## Migration plan — four sequenced steps

Applied as four PRs, one per task group, which is the default this change
introduces:

1. `feat/reviewable-diff-gates-slicing` — the rules only: `CLAUDE.md`,
   `openspec/config.yaml`, `docs/feature-workflow.md`,
   `docs/review-toolkit.md`. Independently applyable; changes no code.
2. `feat/reviewable-diff-gates-budget` — `scripts/diff-budget.sh`, its test
   and the `package.json` entry. Runnable by hand; wired to nothing yet.
3. `feat/reviewable-diff-gates-wiring` — the `oversize:` override, the CI job
   and the pre-push call, plus the gate's line in `docs/review-toolkit.md`.
4. `feat/reviewable-diff-gates-arrow` — `biome.json` and the one rule line in
   `CLAUDE.md`.

Steps 2 and 3 are separate because bundling them would have closed four
acceptance criteria in one PR, which is the limit this change introduces.

Rollback for each is a revert; nothing carries state.

## Open questions

None blocking. The threshold is a measurement, revisited from the gate lines
after a month.
