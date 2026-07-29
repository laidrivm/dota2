# Tasks — reviewable diff gates

Four groups, four pull requests on `feat/reviewable-diff-gates-<step>`, in
order. Each group leaves the repository working on its own. Requirement
citations are the `### Requirement:` headings in
`specs/change-slicing/spec.md` and `specs/module-boundaries/spec.md`.

## 1. Slicing rules

- [x] 1.1 Flip the reviewable unit in `CLAUDE.md` Git & PRs: the step is the
      default, the whole proposal is the exception for a single-group
      `tasks.md` — *The reviewable unit is the step, not the proposal*
- [x] 1.2 Replace "Scope a proposal to one reviewable cycle" in
      `openspec/config.yaml` `rules.proposal` with the one-to-three-criteria
      slice, and add to `rules.tasks` that each task group is a shippable step
      — *A step closes one to three acceptance criteria*
- [x] 1.3 Amend the PR-description rule in `CLAUDE.md` Git & PRs — the one
      forbidding "a restatement of the acceptance criteria" — so it requires
      the closed criteria by identifier and forbids only their text. Placing a
      new sentence beside the prohibition would leave the two reading as a
      contradiction — *A step closes one to three acceptance criteria*
- [x] 1.4 Add the stub-at-the-seam rule to `docs/feature-workflow.md` Stage 1,
      citing 2b's native `<select>` as the worked example — *A seam between
      steps carries a working stub*
- [x] 1.5 Grep every site restating the old "unit is the proposal" default —
      `CLAUDE.md`, `docs/feature-workflow.md`, `docs/review-toolkit.md`,
      `PLAN.md`, `README.md`, `openspec/config.yaml` — and reconcile each
- [x] 1.6 Record the accepted decisions in `PLAN.md` and queue the remaining
      three steps

## 2. The budget script

- [ ] 2.1 Write `scripts/diff-budget.sh`: resolve the base, read the patch
      with the three pathspec exclusions, count non-checkbox lines plus every
      checkbox line that does not pair with one on the other side, where a
      pair requires the same file, identical text once the box is normalised,
      and opposite boxes — the path comes from the enclosing `+++` header, so
      the pairing key is per-file — split source against test by pathspec —
      *The diff budget is measured over a defined set of lines*
- [ ] 2.2 Emit the single gate line `DIFF gate: <VERDICT> — <N> lines (<S>
      source / <T> test)`, PASS below 500, WARN from 500, FAIL from 800, exit
      non-zero only on FAIL — *The budget warns at 500 lines and fails at 800*
- [ ] 2.3 Exit non-zero with a stated reason when the base ref cannot be
      resolved, so no caller can pass on an unmeasured diff — *The gate is
      hard in CI and soft before the push*
- [ ] 2.4 Write `scripts/diff-budget.test.ts` driving the script against
      fabricated repositories, never the live branch. Cover the `/zombies`
      ideas: empty diff (1); only excluded artefacts (2); only checkbox flips
      (3); `src/app/latest.ts` counted as source (4); `e2e/*.spec.ts` counted
      as test (5); a root-level `*.test.ts` counted as test (6); a rename
      contributing zero (7); 499/500 and 799/800 (8, 9); sixty newly authored
      task lines counted (10); a binary marker contributing zero (11); the
      gate line's exact shape (12); exit codes (13); the split summing to the
      total (14); an unreachable base exiting non-zero (15); a task line whose
      text was rewritten counted, not cancelled against an unrelated tick; an
      identical task line deleted from one file and added ticked to another
      counted on both sides; a task line moved with its box unchanged counted
      on both sides
- [ ] 2.5 Watch each threshold assertion fail before it passes, by moving the
      thresholds rather than by editing the assertion
- [ ] 2.6 Add `"diff-budget": "bash scripts/diff-budget.sh"` to
      `package.json` scripts so the gate is runnable by hand

## 3. Wiring the budget

- [ ] 3.1 Read the `oversize:` marker from the pull request body, clear a FAIL
      only when a reason follows it, and name that reason in the gate line —
      *An over-budget pull request is admitted only with a named reason*
- [ ] 3.2 Extend `scripts/diff-budget.test.ts` with the marker cases: a reason
      clearing a FAIL (16), an empty marker not clearing it (17)
- [ ] 3.3 Add the CI job against `github.event.pull_request.base.ref` with
      `fetch-depth: 0`, pinning the action by SHA per the repo convention, and
      confirm it fails rather than passes when the base cannot be resolved —
      *The gate is hard in CI and soft before the push*
- [ ] 3.4 Add the script to the `pre-push` hook in a form that absorbs every
      non-zero exit, and confirm a deliberately over-budget push still
      completes (18) — *The gate is hard in CI and soft before the push*
- [ ] 3.5 Add the gate to the pre-PR sequence in `docs/review-toolkit.md`,
      naming it a measurement rather than a review skill
- [ ] 3.6 Run the script over the four most recent merged PRs and check the
      counts against the table in `design.md`

## 4. The import arrow

- [ ] 4.1 Enable `suspicious.noImportCycles` in `biome.json` — *No module
      import cycles*
- [ ] 4.2 Add the `overrides` entry for `src/model.ts` and `src/types.ts`
      enabling `style.noRestrictedImports` against `./app/**` with a message
      naming the boundary — *The prediction model never imports from the
      application layer*
- [ ] 4.3 Prove both rules red by hand before relying on them: a value import
      from the app layer in `src/model.ts` (19), a type-only import (20), and
      a two-file cycle inside `src/app/` — then revert the probes
- [ ] 4.4 Confirm `src/app/app.tsx` importing `../model.ts` stays green (21)
      and that `bun run lint` is clean over the untouched tree
- [ ] 4.5 Confirm the pre-commit hook rejects a staged violation, not only CI
      (22)
- [ ] 4.6 Add the one-line arrow rule to the `CLAUDE.md` rules list so
      CodeRabbit reads it through `code_guidelines`, and check the list
      against its own ~20-rule maintenance trigger
