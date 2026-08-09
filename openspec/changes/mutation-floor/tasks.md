# mutation-floor — tasks

Three steps, three pull requests, in this order. The split is by what ships
working: step 1 leaves mutation testing running and reporting in CI, step 2
puts a floor under its survivor count, step 3 guards the mechanism that admits
a survivor. Splitting step 2 into "parse the report" and "compare the number"
would leave a module no shipped code path calls, which `change-slicing`
forbids.

Criteria are cited by their scenario heading; all eleven belong to the
`mutation-floor` capability. Numbers in brackets are `/zombies` items.

Everything the floor check does is tested against synthetic input — a report
object, a script source, a config object. No test invokes Stryker; the only
real run is the CI job. This is the shape `scripts/no-suppressions.ts` and its
test already use, and it is what keeps `bun test` in milliseconds.

## 1. The tool and its scope

- [ ] 1.1 Confirm the `/warm` verdict still holds before installing. It was run
      while this change was proposed and returned **Keep**: 9.6.1, Apache-2.0,
      `github.com/stryker-mutator/stryker-js`, first published 2019-02-13,
      latest 2026-04-10, 1.9 M weekly downloads, no install scripts,
      `engines.node >= 20`, 26 direct dependencies, 1.2 MB unpacked over 626
      files. The one advisory in this package family, CVE-2024-57085 in
      `@stryker-mutator/util` below 8.7.1, does not reach core 9.6.1, which
      pins that package at 9.6.1 exactly. The single ⚠️ was right-sizing: the
      `stryker init` wizard, the dashboard client and the IDE server ship with
      core and cannot be sliced off. Re-run it if the resolved version differs
      from 9.6.1; a rejection ends the change rather than being worked around
- [ ] 1.2 Add `.stryker-tmp/` and `reports/` to `.gitignore` **before** the
      first run — Stryker creates both, and the sandbox holds a full copy of
      the working tree
- [ ] 1.3 Install the dependency exact-pinned; confirm `bun pm untrusted` is
      empty rather than assuming it from the manifest's absent install scripts
- [ ] 1.4 Write `stryker.config.json`: `mutate` exactly `["src/model.ts"]`,
      `testRunner` left at its `command` default with
      `commandRunner.command` = `bun test src/model.test.ts`, `thresholds.break`
      explicitly `null`, `jsonReporter.fileName` set, and `timeoutMS` raised
      well clear of a 53 ms suite so a slow runner cannot flip a mutant between
      `Timeout` and `Survived`
- [ ] 1.5 Run Stryker for real once and record, in the pull request: the mutant
      total, the survivor count, the status histogram and the wall time. These
      are not knowable before this task — counting mutants needs a parser, and
      TypeScript 7.0.2 ships only a scanner
- [ ] 1.6 Confirm from that run's report that at least one mutant is `Killed`
      (*A mutant the tests assert against*), and that no mutant names
      `src/app/session.ts` or `src/types.ts` (*A file outside the scope*)
- [ ] 1.7 Write the configuration-shape tests: `mutate` is exactly
      `["src/model.ts"]` (*A file outside the scope*) and the command is the
      model's own suite and runs no Playwright test (*The suite is the only
      killer*)
- [ ] 1.8 Settle whether `bunx stryker run` works without Node by trying it —
      the package declares `engines.node >= 20` and this repository installs
      only Bun in CI. Record the answer; it decides whether `mutation.yml`
      needs `setup-node`
- [ ] 1.9 Add `.github/workflows/mutation.yml` running Stryker on pull
      requests, pinned by SHA like every other workflow here. It reports only
      at this step: the job fails when Stryker fails, not when a mutant
      survives

## 2. The floor

- [ ] 2.1 Write the survivor-count tests first, all failing: a report with zero
      mutants fails rather than reporting zero survivors [1], a report whose
      mutants are all `Killed` counts zero [2], one `Survived` among many
      `Killed` counts one [3], a report mixing `Killed`, `Survived`, `Timeout`,
      `Ignored`, `CompileError` and `RuntimeError` counts only the `Survived`
      ones [4], a `NoCoverage` mutant counts as surviving [5], and two
      survivors on one line count as two [6]
- [ ] 2.2 Write the report-loading tests first: a missing report file fails
      rather than reading as zero survivors [14], a report left behind by a
      previous run is not accepted as this run's result [15], a truncated or
      malformed report fails naming the file [16], and Stryker exiting non-zero
      fails the check with its output rather than a floor verdict [17]
- [ ] 2.3 Implement the report loading and the survivor count in
      `scripts/mutation-floor.ts` as exported functions over a parsed report;
      break each assertion above before it passes
- [ ] 2.4 Write the comparison tests first: a count equal to the floor passes
      [7], one above fails [8] (*A branch added without a test*), one below
      fails [9] (*A survivor newly killed*), a floor of 0 with 0 survivors
      passes [10], the above-floor failure names both count and floor [11], and
      the below-floor failure names the value to write [12]
- [ ] 2.5 Write the reason-line tests first: a floor line with no trailing
      comment fails, one whose comment is `//` with nothing after fails [19],
      one whose comment is whitespace only fails [20], and a floor constant
      absent from the script altogether fails [18] — all four under
      *The floor changed with no reason given*
- [ ] 2.6 Write the two remaining behaviour tests: a gate failure and Stryker
      failing to run are distinguishable from the check's exit [13], and the
      check run from a subdirectory still resolves `src/model.ts`, the config
      and the report from the repository root [29]
- [ ] 2.7 Implement the floor constant and the three comparisons; break each
      before it passes
- [ ] 2.8 Set the floor to the count measured in 1.5, with its reason on that
      line, and confirm the tree passes [30] (*The repository as it stands*)
- [ ] 2.9 Add the round-trip test: killing a survivor with a new test leaves the
      count below the floor and fails until the floor is lowered [31]
      (*A survivor newly killed*)
- [ ] 2.10 Make `mutation.yml` run the check rather than Stryker directly, so
      the job now gates

## 3. Admitting a survivor

- [ ] 3.1 Write the disable-comment tests first, all failing:
      `// Stryker disable next-line all` fails because no mutator is named [21]
      (*A blanket disable comment*), a file-scoped
      `// Stryker disable EqualityOperator` without `next-line` fails because it
      silences every line below it [22], a named mutator with nothing after the
      colon fails [23] and one with no colon at all fails [24] — both
      *An exemption with no reason*
- [ ] 3.2 Write the scanner's negative tests: `// Stryker disable` inside a
      string literal or a block comment is not a disable comment [25], and a
      disable comment in a file other than `src/model.ts` does not fail the
      check [26]
- [ ] 3.3 Implement the disable-comment scan over `src/model.ts`; break each
      assertion above before it passes
- [ ] 3.4 Write the configuration-guard tests first:
      `mutator.excludedMutations` present in `stryker.config.json` fails,
      naming the entry [27] (*A mutator excluded in configuration*), and
      `thresholds.break` set to a number fails [28] — a percentage gate
      alongside an absolute one is a second floor nobody declared
- [ ] 3.5 Implement the configuration guard
- [ ] 3.6 Take the survivors from the run in 1.5 one at a time: judge each
      equivalent or real, mark the equivalent ones with
      `// Stryker disable next-line <Mutator>: <reason>` in `src/model.ts`, and
      lower the floor by however many became `Ignored`
      (*An equivalent mutant is marked*). A survivor judged real stays in the
      count — writing its test is not this change
- [ ] 3.7 Add the convention to `docs/testing.md`: what the floor counts, that
      an equivalent mutant is admitted at its line with a named mutator and a
      reason, and that the floor is lowered by a visible line
- [ ] 3.8 Cite this change's criteria from the tests written above if
      `scripts/spec-coverage.test.ts` has landed by then; if it has not, note
      in the pull request that archiving this change will raise its floor by
      eleven
- [ ] 3.9 Grep the four sites that restate a claim like this one before calling
      the change done: this change's sibling artefacts, `openspec/specs/**`,
      `PLAN.md` and the README ownership map — searching the wording being
      replaced, not the wording replacing it. `PLAN.md`'s entry names
      `src/types.ts` in the scope and a hand-rolled AST mutator as the
      fallback; both are contradicted here
