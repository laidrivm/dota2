# Reviewable diff gates

## Why

Seven of this repo's 26 merged PRs exceed 800 changed lines, the largest at
3041 (#13), and five of the six implementation PRs that shipped product code
are in that group. A diff that size is unreadable first of all by this
project's own pipeline: `/zombies` in diff mode loses cases over three
thousand lines, and `/triage` exists precisely because the diff is larger than
anyone can read — its presence is the admission.

The cause is not at PR time. `openspec/config.yaml` already says "Scope a
proposal to one reviewable cycle", and Phase 2 *was* split into 2a/2b/2c — yet
2c still shipped the picker, the reset dialogue, the undo toast, the board
hotkeys, `usedAs`, the re-pick marker and three design tokens as one 1718-line
PR. "One reviewable cycle" is an adjective, and this project's own EARS rule
demands measurable values. The splitting rule breaks the repo's rule quality
bar.

Separately, one import arrow holds today by accident rather than by
enforcement: `src/model.ts` and `src/types.ts` do not import from
`src/app/**`. That arrow is what keeps the prediction model testable in
isolation, and nothing currently notices when it is crossed.

## What Changes

**Slicing — the cause**

- Flip the default in `CLAUDE.md` Git & PRs: the reviewable unit is the
  **step**, not the proposal. A proposal whose `tasks.md` holds more than one
  task group ships as a sequence of PRs on the `feat/<slug>-<step>` branches
  the convention already reserves.
- Make the slice measurable in `openspec/config.yaml`: a step closes **one to
  three acceptance criteria** and leaves the application working. The PR body
  names the criteria it closes.
- Promote the temporary-stub technique from a one-off `PLAN.md` decision into
  `docs/feature-workflow.md`: proposal 2b shipped a native `<select>` so the
  board worked before the picker existed, and 2c deleted it. A seam carries a
  working stub, never merged dead code — this is what makes a vertical slice
  possible rather than merely declared.

**Budget — the sensor**

- New `scripts/diff-budget.sh`: counts `git diff <base>...HEAD` excluding
  genuinely unreadable artefacts (`bun.lock`, `*.woff2`,
  `src/fixtures/snapshot.json`, and task-list checkbox flips), warns at 500
  changed lines and fails at 800, and reports the source/test split without
  gating on it.
- Wired hard in CI and soft in the pre-push hook. A failure is cleared by an
  `oversize: <reason>` line in the PR body, which must name the reason.

**Import direction — one arrow**

- `biome.json` gains `suspicious.noImportCycles`, and an override on
  `src/model.ts` and `src/types.ts` enabling `style.noRestrictedImports`
  against `./app/**`. Both already run in the pre-commit hook and `lint.yml`;
  no new tool, no new script.
- One line in the `CLAUDE.md` rules list states the arrow, so CodeRabbit reads
  it back through `code_guidelines`.

## Non-goals

- **A per-file line cap** (~300 for `.ts`/`.tsx`, ~200 for `.css`) — a second
  mechanism overlapping the PR budget. Revisit only if the PR budget alone
  fails to bite.
- **A "rule of two" for shared code** (lift a helper on the second consumer,
  never the first) — checkable and probably right, but it governs abstraction,
  not diff size. Its own one-line rule, separately.
- **A traceability script** matching criteria IDs named in a PR body against
  `tasks.md`. The naming is the checkable part; automation waits until reading
  the body demonstrably fails.
- **A layered architecture** (types → model → session → components). One
  arrow, not a lattice: the arrow that protects the model module is the only
  one with a reason behind it.
- **Retiring `/triage`** once PRs settle near the budget. An observation to
  re-check after a month of measurements, not a change to make now.
- **Exempting tests from the budget.** Considered and rejected: test code is
  where agent-written slop hides (`docs/testing.md` says so directly), so
  removing it from the review budget removes attention from the part that
  needs it most.

## Capabilities

### New Capabilities

- `change-slicing`: how work is cut into PRs — the step-per-PR default, the
  one-to-three-criteria slice, the stub-at-the-seam technique, and the diff
  budget that detects when the cut failed.
- `module-boundaries`: the import arrow protecting the prediction model, and
  the absence of import cycles, both enforced by the linter already in place.

### Modified Capabilities

None. `local-review-loop` covers the CodeRabbit passes only; the budget gate
is a hook and a CI job, not a review skill.

## Impact

- **Code**: new `scripts/diff-budget.sh`; `package.json` pre-push hook;
  `.github/workflows/` gains the gate (in `lint.yml` or its own job);
  `biome.json` gains one rule and one override.
- **Rules and docs**: `CLAUDE.md` (Git & PRs, Rules), `openspec/config.yaml`
  (`rules.proposal`, `rules.tasks`), `docs/feature-workflow.md`,
  `docs/review-toolkit.md`.
- **Existing code**: none moves. The arrow holds today, so the linter change
  is green on arrival and must be proved red against a deliberate violation.
- **Future work**: every PR after this one is measured. The seven historical
  over-budget PRs are already merged and are not revisited.
