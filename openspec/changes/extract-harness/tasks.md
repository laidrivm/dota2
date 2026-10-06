# extract-harness — tasks

Twelve steps, twelve pull requests, in this order, alternating between
repositories as `design.md` D11 sets out. A d2ass step pins the harness commit
its predecessor merged. Steps marked **harness** are opened in
`laidrivm/harness` (until step 1 lands, `laidrivm/skills`), on the same branch
names as here. Each d2ass step names the criteria it closes by their
`<capability>/<scenario-slug>` identifiers. A harness step closes none of this
change's criteria: its tests cite the harness's own specs once step 11 has
put them there.

The `MODIFIED` deltas carry these five criteria, which this change does not
close. Their wording is unchanged and the tests on `main` that close them
stay:

  `review-bot-config/a-context-save-point-exists`
  `review-bot-config/an-indexed-doc-is-added`
  `review-bot-config/a-defect-an-existing-rule-covers`
  `review-bot-config/a-rule-violated-outside-typescript`
  `review-bot-config/a-defect-no-rule-covers`

ZOMBIES items are numbered as in the proposal-stage report (34 items). Each
task that writes one names its number.

## 1. Restructure the skills repository (harness)

Closes none — infrastructure in another repository.

- [x] 1.1 Rename `laidrivm/skills` to `laidrivm/harness` on GitHub and verify
      `gh repo view laidrivm/skills` resolves to the new name.
- [x] 1.2 Move every skill to `core/skills/<name>/` with `git mv`. Update
      `link.sh` to read from `core/skills/` and re-link d2ass with it. Verify
      that a fresh d2ass session still lists `/triage`, `/warm` and `/zombies`.
- [x] 1.3 Add `package.json` (`"name": "harness"`, `"private": true`, no
      `scripts`, no dependencies) and verify with
      `bun pm pack --dry-run` from the harness root that no lifecycle script
      is declared.
- [x] 1.4 Rewrite the README's layout, linking and provenance sections for
      `core/`, and verify that every path the README names exists with
      `git ls-files`.

## 2. Pin the harness (d2ass)

Closes `harness-consumption/pinned-to-a-commit`,
`harness-consumption/pinned-to-something-that-moves`,
`harness-consumption/a-non-harness-git-specifier`.

- [x] 2.1 Teach `scripts/manifest-ranges.ts` to admit
      `github:laidrivm/harness#<40 lowercase hex>` for the `harness` entry
      alone. Add cases to `scripts/manifest-ranges.test.ts` citing the three
      criteria: ZOMBIES 1 (no harness entry passes), 2 and 3 (39 and 41
      characters rejected), 4 (upper-case hex rejected), 5 (`#main`),
      6 (no reference), 7 (tag-shaped), 8 (another Git specifier). Verify
      with `bun test scripts/manifest-ranges`.
- [x] 2.2 `bun add github:laidrivm/harness#<step-1 merge commit>`, after the
      user approves the prompt. Verify with `bun run lint` and
      `bun test checks/manifest-version-ranges`, which must both pass, and
      confirm that `bun.lock` records the same commit.

## 3. Skills from the package (d2ass)

Closes `repo-onboarding/a-fresh-clone`, `repo-onboarding/the-retired-linker`,
`repo-onboarding/the-skills-repository-is-referenced`.

- [x] 3.1 Replace the eleven ignored links with tracked relative links to
      `../../node_modules/harness/core/skills/<name>`, and drop
      `.claude/skills/` from `.gitignore`. Verify with
      `git ls-files -s .claude/skills` that every entry has mode `120000`.
      The check that closes the links' criterion arrives in step 7.
- [x] 3.2 Rewrite README §*Getting the review skills* around `bun install`, and
      make the ownership map's `.claude/skills/` row link to
      `https://github.com/laidrivm/harness`. Add cases to
      `checks/readme-map.test.ts` citing the three `repo-onboarding`
      criteria, including ZOMBIES 32 (a README naming `link.sh` fails).
      Verify with `bun test checks/readme`.
- [x] 3.3 Delete `docs/review-toolkit.md` §*Provenance* and
      `checks/skill-provenance.test.ts`. Verify that
      `git grep -n "Verified against"` finds nothing outside `openspec/` and
      `docs/context/`.

## 4. Gates read their values from the consumer (harness)

Closes none — infrastructure in another repository.

- [x] 4.1 Copy into `bun/` verbatim, with `git log` provenance in the commit
      body: `command-guard`, `command-parse`, `scan`, `diff-budget`,
      `file-size`, `no-suppressions`, `manifest-ranges`, `spec-coverage`,
      `spec-criteria`, `mutation-floor`, `repo-layout`, `board-state`,
      `check-yaml`, `root`, and their tests and fixtures. Verify with
      `bun test` in the harness, which passes unchanged before 4.2.
- [x] 4.2 Read every d2ass value from the consumer's `package.json`
      `"harness"` key (`design.md` D4) and fail naming any key that is
      absent. Add ZOMBIES 26 (missing `mutationFloor`) and 27 (missing
      `rootFiles`). Verify with `bun test`.
- [x] 4.3 Add `bun/check.ts`, the consumer entry point (D5). It runs the pin,
      skill-link, workflow and gate checks over the working directory's
      tree. Tests: ZOMBIES 9–13 (links), 29–31 (workflows). Verify with
      `bun test bun/check`.
- [x] 4.4 Add the canonical bootstrap text (D6) and a test that runs it
      against fabricated hook input with no package installed: ZOMBIES
      19–24. Move the `agent-permissions` settings check here, asserting
      the bootstrap text exactly. Verify with `bun test`.
- [x] 4.5 Delete `link.sh` and its README section. Nothing links through it
      after step 3. Verify that `git grep link.sh` is empty.
- [x] 4.6 Add a CI workflow that runs `bun test` on push and pull request, and
      verify it goes green on the step's PR.

## 5. The guard from the package (d2ass)

Closes `harness-consumption/a-fresh-clone`,
`harness-consumption/any-other-command-before-the-install`,
`harness-consumption/after-the-install`.

- [x] 5.1 Bump the pin to step 4's merge commit and replace the `PreToolUse`
      command in `.claude/settings.json` with the bootstrap text from 4.4.
      Verify that `bun node_modules/harness/bun/check.ts` passes the
      settings check.
- [x] 5.2 Add `checks/harness-consumption.test.ts` with cases citing the three
      criteria. They run the settings hook command in a fabricated clone with
      and without `node_modules/harness/`, including
      `bun install --registry <url>` blocked before install. ZOMBIES 25:
      after install, a commit on `main` is refused with the package guard's
      message. Verify with `bun test checks/harness-consumption`.
- [x] 5.3 Delete `scripts/command-guard*` and `scripts/command-parse*`. Verify
      that `git grep -n "scripts/command-guard"` finds nothing outside
      `openspec/changes/archive/` and `docs/context/`.

## 6. Gates and CI from the package (d2ass)

Closes `harness-consumption/raising-the-mutation-floor`,
`harness-consumption/a-d2ass-value-in-a-gate`,
`harness-consumption/a-workflow-running-a-gate`,
`harness-consumption/the-repository-as-it-stands`.

- [x] 6.1 Move the d2ass values into `package.json` `"harness"`: the
      mutation module and floor, the root files with their reasons, the
      suppression allowlist, the diff-budget exclusions. Verify that
      `bun node_modules/harness/bun/check.ts` passes on the tree.
- [x] 6.2 Point `package.json` scripts, the `pre-push` hook,
      `diff-budget.yml`, `lint.yml` and `mutation.yml` at
      `node_modules/harness/bun/`, and add `harness:check` where the moved
      checks ran. Verify with `actionlint` and a green CI run on the PR.
- [x] 6.3 Add cases to `checks/harness-consumption.test.ts` citing the three
      criteria. ZOMBIES 28: changing the floor in a fabricated consumer's
      `package.json` flips the verdict. A search of the installed gates'
      non-test source finds no `src/model.ts` or
      `src/fixtures/snapshot.json`. Every workflow gate path is under
      `node_modules/harness/`. Verify with `bun test checks/harness-consumption`.
- [x] 6.4 Delete the moved scripts and checks: the step 4.1 list less the
      guard, plus `checks/agent-permissions*`, `checks/commit-gates.test.ts`,
      `checks/rulebook.test.ts`, `checks/tracked-tree.test.ts` and
      `checks/manifest-version-ranges.test.ts`. Keep `scripts/root.ts`, which
      `scripts/test-db.test.ts` imports, and
      `scripts/mutation-floor-config.test.ts`, which tests d2ass's own Stryker
      configuration and has no copy in the package. Point
      `checks/readme-layout.test.ts` and `src/app/module-classes.test.ts` at
      the package's modules. Before deleting, add cases to
      `checks/harness-consumption.test.ts` re-citing what stays here and only
      a deleted test cited: the three `pinned-*` criteria, run through the
      package's pin check over this manifest and a fabricated one,
      `mutation-floor/a-mutant-the-tests-assert-against`, and
      `harness-consumption/the-repository-as-it-stands`. Verify that
      `bun test` and `bun run harness:check` pass, with
      `harness.uncitedFloor` raised in the deleting commit by exactly the
      criteria of capabilities leaving at the archive whose tests moved, and
      its `why` saying so. The PR body carries
      `oversize: deletes code moved verbatim to laidrivm/harness@<sha>` if
      it crosses 800 lines.

## 7. The skill links' contract (d2ass)

Closes `harness-consumption/a-link-into-the-package`,
`harness-consumption/a-link-into-another-checkout`,
`harness-consumption/a-link-the-package-no-longer-carries`.

- [x] 7.1 Add cases to `checks/harness-consumption-links.test.ts`, split from
      `checks/harness-consumption.test.ts` ahead of its 300-line cap, citing
      the three criteria. The first runs the package's exported link check over this
      tree. The other two run it on a fabricated tree (a link to a sibling
      checkout, a link the package lacks) and assert the named failure.
      Verify with `bun test checks/harness-consumption`.

## 8. Rules and docs in the package (harness)

Closes none — infrastructure in another repository.

- [x] 8.1 Write `core/rules.md` from d2ass's `CLAUDE.md` by the partition rule
      (D8): the loop, the quality bar, maintenance, Process, Safety, and the
      `Code` rules that move. Verify that every rule line of the d2ass
      `CLAUDE.md` at the pinned commit appears exactly once across
      `core/rules.md` and the step 9 `CLAUDE.md`, compared by normalised
      text.
- [x] 8.2 Copy `verification`, `git-and-prs`, `review-toolkit`,
      `feature-workflow`, `rulebook-growth`, `code-style` and `api-design` to
      `core/`, beside `core/rules.md`, verbatim, and the non-d2ass part of
      `testing` by D8. Verify
      with `git diff --no-index` against d2ass's copies, which must show only
      the `testing.md` cut.
- [x] 8.3 Add `bun/sync.ts`, which writes `core/rules.md` and the docs beside
      it in `core/` into a consumer's `harness/`, and its check in `check.ts`. Tests:
      ZOMBIES 14 (identical passes), 15 (three diffs all named), 16
      (missing from the copy), 17 (extra in the copy), 18 (one-byte
      difference). Verify with `bun test bun/sync`.
- [x] 8.4 Add the harness's own `CLAUDE.md`, importing `core/rules.md`, and
      verify that a session opened in the harness repository reads the rules
      (ask it to quote the first Process rule).
- [x] 8.5 Make the guard's two "HEAD is on main" refusals say that every
      directory the line may run in is checked, so a `cd` into a feature
      checkout from one on `main` is refused too, and name `git -C <path>` as
      the spelling that commits or pushes there. Verify with a case in
      `bun/command-guard.test.ts` asserting the reason names `git -C`.

## 9. The rules copy (d2ass)

Closes `harness-consumption/a-copy-in-step-with-the-pin`,
`harness-consumption/a-copy-edited-by-hand`,
`harness-consumption/a-pin-bumped-without-refreshing-the-copy`.

- [ ] 9.1 Bump the pin to step 8's merge commit, run
      `bun node_modules/harness/bun/sync.ts`, and commit `harness/`. Verify
      that `bun run harness:check` passes.
- [ ] 9.2 Reduce `CLAUDE.md` to d2ass's own: the overview, the `Code` rules
      that stay, and `@harness/rules.md` with links to `harness/<doc>.md`.
      Delete the moved docs from `docs/`, and keep a d2ass `docs/testing.md`
      holding the database suites and the e2e mechanics.
      Verify that `git grep -n "docs/\(verification\|git-and-prs\|review-toolkit\|feature-workflow\|rulebook-growth\|code-style\|api-design\)\.md"`
      finds nothing outside the archive, `docs/context/` and the moving
      changes.
- [ ] 9.3 Add cases to `checks/harness-consumption.test.ts` citing the three
      criteria, run over a fabricated consumer: the copy as synced, a copy
      with one edited byte, and a pin bumped with the copy left stale.
      Verify with `bun test checks/harness-consumption`.
- [ ] 9.4 Update the README ownership map and §*Where files live* for
      `harness/`, and verify with `bun test checks/readme`.

## 10. Review and CI config point at the package (d2ass)

Closes `review-bot-config/a-harness-rule-arrives-with-a-pin-bump`,
`review-bot-config/a-harness-rule-violated`,
`harness-consumption/a-second-checkout`.

- [ ] 10.1 Add `harness/*.md` to `knowledge_base.code_guidelines.filePatterns`
      with its reason beside it, and widen the rules-list instruction to the
      harness rules. Add cases to `checks/coderabbit-config.test.ts` citing
      both criteria: ZOMBIES 34 (`harness/*.md` present), 33
      (`harness/**/*.md` absent). Verify with
      `bun test checks/coderabbit-config`.
- [ ] 10.2 Add a case to `checks/harness-consumption.test.ts` citing
      `a-second-checkout`. It runs the package's workflow check on a
      fabricated workflow that checks out `laidrivm/harness` and asserts the
      failure names it. Verify with `bun test checks/harness-consumption`.

## 11. Specs and changes in the package (harness)

Closes none — infrastructure in another repository.

- [ ] 11.1 Run `openspec init` in the harness. Copy the ten moving
      capabilities, `mutation-floor`'s moving requirements, and the seven
      moving changes verbatim. Verify with
      `openspec validate --all` there.
- [ ] 11.2 Point the moved tests' `// spec:` citations at the harness's specs,
      and verify that the harness's `spec-coverage` reports a floor no higher
      than d2ass's share of it before the move.

## 12. Hand over (d2ass)

Closes none — removals and board.

- [ ] 12.1 Delete the seven moved change directories. Verify that
      `openspec list` no longer shows them and that
      `bun node_modules/harness/bun/board-state.ts` reports no
      dangling `after:`.
- [ ] 12.2 Move `glob-row-example`'s card from `Harness` to `D2ASS` and verify
      it through each board's `Board view`.
- [ ] 12.3 Re-read every moving capability's live requirement list and bring
      the REMOVED deltas level through `/opsx:update`, so that a change
      applied in the meantime strands nothing. Verify with
      `openspec validate extract-harness`.
- [ ] 12.4 Run the archive's sync preview and confirm that the ten
      capabilities retire cleanly (`design.md` Risks, stray prose). Verify
      that the preview reports no `content the merge cannot name`. The
      archive commit lowers `harness.uncitedFloor` by the uncited criteria
      the REMOVED deltas take with them, re-measured in that commit.
