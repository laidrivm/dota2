# mutation-floor — tasks

Two steps, two pull requests, in this order. The split is by what ships
working: step 1 is the gate whole — tool, configuration, floor and CI job —
and step 2 adds the mechanism that admits a survivor on top of it. Splitting
step 1 further into "run Stryker" and "put a floor under it" would leave a
pull request whose job can only fail when Stryker itself breaks, and would
carry the first measurement from one PR's description into the next one's code.

Criteria are cited by their scenario heading; all ten belong to the
`mutation-floor` capability. Numbers in brackets are `/zombies` items.

Four of the 31 `/zombies` items fell out with the cuts a `/ponytail-review`
pass made to this plan: [13] and [17] concerned the check spawning Stryker,
which the workflow now does instead, and [27] and [28] guarded a
`stryker.config.json` that a reviewer reads whole.

Everything the check does is tested against synthetic input — a report object,
a script source. No *test* invokes Stryker: the real runs are 1.5, done once by
hand to obtain the first measurement, and the CI job. This is the shape
`scripts/no-suppressions.ts` and its test already use, and it is what keeps
`bun test` in milliseconds.

## 1. The gate

- [x] 1.1 Confirm the `/warm` verdict still holds before installing. It was run
      while this change was proposed and returned **Keep**: 9.6.1, Apache-2.0,
      `github.com/stryker-mutator/stryker-js`, first published 2019-02-13,
      latest 2026-04-10, 1.9 M weekly downloads, no install scripts,
      `engines.node >= 20`, 26 direct dependencies, 1.2 MB unpacked over 626
      files. The one advisory in this package family, CVE-2024-57085 in
      `@stryker-mutator/util` below 8.7.1, does not reach core 9.6.1, which
      pins that package at 9.6.1 exactly. The single ⚠️ was right-sizing: the
      `stryker init` wizard, the dashboard client and the IDE server ship with
      core and cannot be sliced off. Re-run it if the resolved version differs
      from 9.6.1; a rejection ends the change rather than being worked around.
      Record the date the verdict was confirmed against the version actually
      installed, in `design.md`'s provenance paragraph — a verdict without a
      date cannot be told from one nobody re-read
- [x] 1.2 Add `.stryker-tmp/` and `reports/` to `.gitignore` **before** the
      first run — Stryker creates both, and the sandbox holds a full copy of
      the working tree
- [x] 1.3 Install the dependency at exactly 9.6.1 — `bunfig.toml` pins exact
      versions, so confirm `package.json` and `bun.lock` both carry that
      version and no range; confirm `bun pm untrusted` is empty rather than
      assuming it from the manifest's absent install scripts
- [x] 1.4 Write `stryker.config.json`: `mutate` exactly `["src/model.ts"]`,
      `testRunner` left at its `command` default with
      `commandRunner.command` = `bun test src/model.test.ts`, `thresholds.break`
      explicitly `null`, `reporters` including `json`, and
      `jsonReporter.fileName` set to `reports/mutation/mutation.json`, which
      every task below resolves from the repository root. Both reporter
      settings are needed: the default `reporters` is `clear-text`, `progress`
      and `html`, so a filename alone names a path nothing writes to. Confirm
      after 1.5 that the file exists. Two further settings turned out to be
      load-bearing and are justified in `design.md`: `tsconfigFile` naming an
      absent file, without which Stryker's sandbox preprocessor crashes on a
      compiler API TypeScript 7.0.2 does not expose, and `ignorePatterns`
      excluding `.claude` and `spec-inbox`, whose gitignored symlinks break the
      sandbox copy. Leave `timeoutMS` at its default — 5000 ms plus
      `netTime × 1.5` against a 53 ms suite is already ~75× headroom, and
      tuning it now would be tuning against a flake nobody has seen
- [x] 1.5 Run Stryker for real once and record, in the pull request: the mutant
      total, the survivor count, the status histogram and the wall time. These
      are not knowable before this task — counting mutants needs a parser, and
      TypeScript 7.0.2 ships only a scanner
- [x] 1.6 Confirm from that run: at least one mutant is `Killed`
      (*A mutant the tests assert against*), no mutant names
      `src/app/session.ts` or `src/types.ts` (*A file outside the scope*), and
      the only command executed was `bun test src/model.test.ts`, with no
      Playwright test in the killing set (*The suite is the only killer*)
- [x] 1.7 Settle whether `bunx --no-install stryker run` works without Node by
      trying it — the package declares `engines.node >= 20` and this repository
      installs only Bun in CI. Record the answer; it decides whether
      `mutation.yml` needs `setup-node`. `--no-install` is not optional: a bare
      `bunx` would fetch a package on a miss and bypass the release-age gate,
      which `CLAUDE.md` forbids
- [x] 1.8 Write the survivor-count tests first, all failing: a report with zero
      mutants fails rather than reporting zero survivors [1], a report whose
      mutants are all `Killed` counts zero [2], one `Survived` among many
      `Killed` counts one [3], a report mixing `Killed`, `Survived`, `Timeout`,
      `Ignored`, `CompileError` and `RuntimeError` counts only the `Survived`
      ones [4], a `NoCoverage` mutant counts as surviving [5], and two
      survivors on one line count as two [6]
- [x] 1.9 Write the report-loading tests first: a missing report file fails
      rather than reading as zero survivors [14], a truncated or malformed
      report fails naming the file [16], and a mutant carrying a status the
      check does not recognise fails, naming the status
- [x] 1.10 Implement the report loading and the survivor count in
      `scripts/mutation-floor.ts` as exported functions over a parsed report;
      break each assertion above before it passes. The script runs no tool: a
      crashed Stryker is a non-zero exit the shell already reports
- [x] 1.11 Put staleness on the invoker rather than in the check [15]: the
      workflow deletes `reports/mutation/` before running Stryker, so a report
      from a previous run cannot be read as this one's. A reader cannot tell a
      stale file from a fresh one, and an absent report already fails by 1.9
- [x] 1.12 Write the comparison tests first: a count equal to the floor passes
      [7], one above fails [8] (*A branch added without a test*), one below
      fails [9] (*A survivor newly killed*), a floor of 0 with 0 survivors
      passes [10], the above-floor failure names both count and floor [11], and
      the below-floor failure names the value to write [12]
- [x] 1.13 Write the reason-line tests first: a floor line with no trailing
      comment fails, one whose comment is `//` with nothing after fails [19],
      one whose comment is whitespace only fails [20], and a floor constant
      absent from the script altogether fails [18] — all four under
      *The floor changed with no reason given*
- [x] 1.14 Add the environment test: run from a subdirectory the check still
      resolves the report, and in step 2 `src/model.ts`, from the repository
      root [29]. The exported functions take their input as an argument and
      resolve nothing; only the CLI entry point resolves paths, and it does so
      from the repository root rather than the working directory
- [x] 1.15 Implement the floor constant, the three comparisons **and** the
      reason-line validation — the check reads its own source to find the floor
      line and rejects one whose trailing comment is missing or blank. Break
      each assertion from 1.12 and 1.13 before it passes; the reason-line half
      is what closes *The floor changed with no reason given*, and 1.13 writes
      its tests but nothing else implements it
- [x] 1.16 Set the floor to the count measured in 1.5, with its reason on that
      line, and confirm the tree passes [30] (*The repository as it stands*)
- [x] 1.17 Add the round-trip test: killing a survivor with a new test leaves
      the count below the floor and fails until the floor is lowered [31]
      (*A survivor newly killed*)
- [x] 1.18 Add `.github/workflows/mutation.yml`, pinned by SHA like every other
      workflow here: `bun install --frozen-lockfile`, delete
      `reports/mutation/`, `bunx --no-install stryker run`, then the check —
      the job fails on any of them, and the shell keeps the failures apart
- [x] 1.19 Add `scripts/mutation-floor.ts` to the README's knowledge ownership
      map — `scripts/command-guard.ts` and `scripts/no-suppressions.ts` both
      have rows, and `readme-map.test.ts` only checks that a row's path
      resolves, never that a script has a row, so nothing catches the omission

## 2. Admitting a survivor

- [x] 2.1 Write the disable-comment tests first, all failing:
      `// Stryker disable next-line all` fails because no mutator is named [21]
      (*A blanket disable comment*), a file-scoped
      `// Stryker disable EqualityOperator` without `next-line` fails because it
      silences every line below it [22], a named mutator with nothing after the
      colon fails [23] and one with no colon at all fails [24] — both
      *An exemption with no reason*
- [x] 2.2 Write the accepting tests: a single named mutator with a reason
      passes, and so does a comma-separated list of named mutators with one
      reason — one line can carry two mutants equivalent for the same reason,
      and a scan that rejected the list would push the author towards `all`
- [x] 2.3 Write the scanner's negative tests: `// Stryker disable` inside a
      string literal or a block comment is not a disable comment [25], and a
      disable comment in a file other than `src/model.ts` does not fail the
      check [26]
- [x] 2.4 Implement the disable-comment scan over `src/model.ts`; break each
      assertion above before it passes
- [x] 2.5 Take the survivors from the run in 1.5 one at a time: judge each
      equivalent or real, mark the equivalent ones with
      `// Stryker disable next-line <Mutator>: <reason>` in `src/model.ts`, and
      lower the floor by however many became `Ignored`
      (*An equivalent mutant is marked*). A survivor judged real stays in the
      count — writing its test is not this change. Outcome: all 67 judged, none
      marked, floor unchanged at 67. Four are equivalent and each shares its
      line **and** its mutator with a mutant the tests kill, which a disable
      comment cannot separate; the 44 that could be marked without touching a
      killed sibling are all real. `design.md` records the reasoning
- [x] 2.6 Add the convention to `docs/testing.md`: what the floor counts, that
      an equivalent mutant is admitted at its line with a named mutator and a
      reason, and that the floor is lowered by a visible line
- [x] 2.7 Cite this change's criteria from the tests written above if
      `scripts/spec-coverage.test.ts` has landed by then; if it has not, note
      in the pull request that archiving this change will raise its floor by
      ten
- [x] 2.8 Grep the four sites that restate a claim like this one before calling
      the change done: this change's sibling artefacts, `openspec/specs/**`,
      `PLAN.md` and the README ownership map — searching the wording being
      replaced, not the wording replacing it. `PLAN.md`'s entry names
      `src/types.ts` in the scope and a hand-rolled AST mutator as the
      fallback; both are contradicted here
