# Tasks — always-on context budget

Two groups, two pull requests on `feat/always-on-context-budget-<step>`, in
order. Group 2 follows group 1 because group 1 produces the list of fences
group 2 writes. Requirement citations are the `### Requirement:` headings in
`specs/context-budget/spec.md` and `specs/review-bot-config/spec.md`.

Applied after `reviewable-diff-gates` and `mechanised-prohibitions` are
merged. Before starting, confirm the two things this change takes as done:
`PLAN.md` has no "Gates (reminder)" section, and the `CLAUDE.md` rules list is
split into code / process / safety sublists.

## 1. PLAN.md and the trigger

- [ ] 1.1 Walk every entry under "Accepted decisions" and record its
      disposition in the PR body — fence, deleted, or kept — testing them in
      that order, since an entry can satisfy more than one — *An entry leaves
      PLAN.md by one of three routes*
- [ ] 1.2 For each entry marked **deleted**, open the archived change and
      confirm it states the fact before removing the line. The `aria-disabled`
      decision is in no archived change; assume nothing from a sample
- [ ] 1.3 For each entry marked **fence**, check whether the comment already
      stands: `src/model.ts:152-154`, `src/model.test.ts:344-345`,
      `index.html:7-8` and `src/app/snapshot.ts:1-18` already carry theirs, so
      those four entries are deletions, not moves. List the ones that do not
      for group 2 — *A fence stands where it is stepped on*
- [ ] 1.4 Leave the standing constraints — Preact, camelCase in every JSON
      payload, the snapshot URL, Bun's bundler without Vite, Dependabot over
      Renovate, Docker on a VPS — and nothing else — *PLAN.md holds the open
      queue and the standing constraints*
- [ ] 1.5 Collapse the completed queue entries to one line naming the archive,
      and drop from "Requirement sources" every source whose work is closed.
      Collapsing removes the numbering collision that made `7.` sit beside
      `Task 7`: what survives is one queue with one scheme
- [ ] 1.6 Add `PLAN.md`'s growth protocol: what lives there, what evicts an
      entry, where the evicted thing goes, and that an archived change is never
      edited to receive one — *An entry leaves PLAN.md by one of three routes*
- [ ] 1.7 Restate the `CLAUDE.md` trigger in *Structure & growth of this file*
      over the always-on set rather than over that file alone, naming the two
      files and saying why `docs/**` does not count — *The always-on set is
      named and measured as one budget*
- [ ] 1.8 Reconcile every site restating what this step changes: `README.md`'s
      ownership row for `PLAN.md`, which describes it as carrying accepted
      decisions; `spec-inbox/README.md`, which points at `PLAN.md` →
      Requirement sources; and `tasks/task-8.md`, whose acceptance criteria
      state the per-file 250-line figure. `readme-map.test.ts` pins the map's
      paths and not its descriptions, so the first drifts silently
- [ ] 1.9 Record the before and after line counts of both files in the PR body,
      so the next maintenance run has a figure to compare against
- [ ] 1.10 Do not add a CI check on the line counts — the trigger is a
      maintenance prompt, and a gate would be cleared by moving text

## 2. The fence rule and the bot instruction

- [ ] 2.1 Write `coderabbit-config.test.ts` asserting the `path_instructions`
      entry for `**/*.{ts,tsx}` exists and names an unchecked precondition (1),
      and that `docstrings.mode` is still `"off"` with no `threshold` beside it
      (2) — watch both fail before the config is edited — *The bot judges what
      a comment protects, not whether one exists*
- [ ] 2.2 Add the `path_instructions` entry to `.coderabbit.yaml`, worded so it
      cannot be satisfied by prose over every function, with its reason beside
      it as the other entries carry theirs
- [ ] 2.3 Add one line to the `CLAUDE.md` rules list, in the code sublist:
      comment what a reader would otherwise "fix" — a deliberate departure from
      the obvious implementation, or a precondition the code does not check —
      *A fence stands where it is stepped on*
- [ ] 2.4 Write the comments for the fences group 1 listed as having none
- [ ] 2.5 Confirm the rules list is still within its own ~20 trigger after the
      addition, and note the count in the PR body
