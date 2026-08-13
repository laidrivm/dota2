# mutation-floor — design

## Context

`src/model.ts` is 296 lines of scoring arithmetic behind one exported function,
`computeModel`. Two files import it: `src/model.test.ts` and `src/app/app.tsx`.
The app-side use has no unit test by design — `docs/testing.md` sends anything
needing a document to Playwright — so `src/model.test.ts` is the whole of the
model's unit-level guard, and `bun test src/model.test.ts` runs every test that
could kill a mutant in that file.

Measurements taken while scoping this change:

| probe | result |
|---|---|
| `bun test --coverage src/model.test.ts` | `src/model.ts` 100.00% funcs, 100.00% lines |
| `bun test src/model.test.ts` | 34 tests, 53 ms |
| `bun test` (whole repository) | 555 tests, 18 files, 10.1 s |
| `bun test src/app/session.test.ts` | 165 tests, 148 ms |

The first line is why this change exists: a coverage floor over `model.ts` has
nowhere to go, and 100% coverage on scoring arithmetic asserts nothing about
whether a wrong sign would be noticed.

The last line matters for scope. Test-suite speed is not a constraint anywhere
in this repository, which removes the usual reason to prefer a clever mutation
runner over a dumb one.

## Goals / Non-Goals

**Goals:**

- A mutant surviving in `src/model.ts` either fails the build or is admitted by
  a sentence someone wrote.
- The gate's number can be moved in either direction, and moving it leaves a
  reason in the diff.
- The floor is legible without opening a report: one integer in one script.

**Non-Goals:**

Carried from `proposal.md`, not restated here.

## Decisions

### Stryker, not a mutator of our own

`PLAN.md` recorded a hand-rolled AST mutator as the fallback, on the assumption
that the already-installed `typescript` package could parse. It cannot.
TypeScript 7.0.2 is the native port: its main export is `lib/version.cjs`, with
two keys and no `createSourceFile`. What remains is `typescript/unstable/ast`,
which exposes `createScanner` but no parser — and a scanner without a parser
cannot handle template literals, because `${` needs the parser to call
`reScanTemplateToken`. Run over `src/model.ts`, it reads the closing backtick of
`` Record<`${Role}`, number> `` at offset 8025 as the opening of a new template;
by offset 8074 it is swallowing the remaining 1188 characters of the file as
literal text, and the scan ends after 157 tokens.

So the fallback was never zero-dependency: it needed a real parser plus roughly
150 lines of mutator, runner and reporter that this repository would then own
forever. Against that, `@stryker-mutator/core` is one dependency and about
fifteen lines of configuration. It is not a cheap dependency — 26 direct
dependencies of its own — but the alternative is not cheaper, only differently
expensive, and the expensive part of it is ours to maintain.

Provenance, checked on the registry rather than recalled: `@stryker-mutator/core`
9.6.1, Apache-2.0, published 2026-04-10 from
`github.com/stryker-mutator/stryker-js`, first published 2019-02-13, 1.9 M
downloads in the week of 2026-08-02, no install scripts, `engines.node >= 20`.
`/warm` still runs before the install — this is the input to it, not a
substitute for it.

The `/warm` **Keep** verdict was re-confirmed on 2026-08-13 against 9.6.1, the
version installed: the registry still resolves `latest` to 9.6.1, so every
figure above stands, and `@stryker-mutator/util` is pinned at 9.6.1 in the
lockfile, out of CVE-2024-57085's `< 8.7.1` range. Weekly downloads for
2026-08-03→09 were 1 899 116.

### The command runner, in preference to the Bun runner plugins that exist

Stryker's own runner plugins cover Jest, Mocha, Karma, Jasmine, Vitest, Tap and
Cucumber — not Bun. Two third-party ones do exist, and both are ruled out on
what they are rather than on being absent:

| | `@hughescr/stryker-bun-runner` | `stryker-mutator-bun-runner` |
|---|---|---|
| latest | 1.3.8, 2026-07-17 | 0.4.0, 2025-07-07 |
| first published | 2026-01-16 | 2025-07-07 |
| versions | 18 | 1 |
| weekly downloads | 11 637 | 4 312 |

The second has not been touched in thirteen months and has exactly one
published version, which fails **A** on sight. The first is genuinely
maintained — eighteen releases in seven months — but it is a seven-month-old
package under a personal scope, and taking it means a second supply-chain root
of trust beside `@stryker-mutator/core`.

What that trust would buy is per-test optimisation: the runner hooks into
`bun:test` so Stryker can run only the tests covering each mutant. The default
`testRunner` is `command`, which instead runs a configured shell command per
mutant and reads only the exit code, and whose documented drawback is exactly
that it cannot optimise and must run the whole suite every time.

That drawback costs 53 ms per mutant here. Even several hundred mutants run
serially would finish in under a minute, and Stryker parallelises across cores
by default. So the plugin's entire benefit is worth nothing at this suite size,
and it is declined for a reason that would reverse if the model's suite ever
grew by two orders of magnitude.

### One file, one command, one floor

`mutate` is `src/model.ts` and the command is `bun test src/model.test.ts`.

The tempting second target is `src/app/session.ts` — 422 lines of reducer, and
it imports only `types.ts` and `storage.ts`, so its mutants and the model's
could never kill each other. It is still left out, because the command runner
takes one fixed command regardless of which file was mutated. Two files under
one config means one command running both suites and, worse, **one floor over
both**: any edit to either file moves the shared number, and a floor that moves
for unrelated reasons cannot carry "raised by one, because X". Two floors need
two configs and two invocations, which is a second gate to design and is worth
doing only once the first one has caught something.

### The floor is an absolute survivor count, not Stryker's threshold

Stryker's `thresholds.break` compares the **mutation score** — a percentage —
and fails the build below it. A percentage is the wrong instrument here: its
denominator is the mutant total, which shifts whenever anyone edits
`model.ts`, so the same set of survivors yields a different score before and
after an unrelated refactor. Nobody can write "raised by one, because X" about
a number that moves on its own.

So `thresholds.break` stays `null` and `scripts/mutation-floor.ts` reads the
JSON report and counts the mutants that survived — `Survived` plus
`NoCoverage`, since a mutant no test ran against was not killed either. The
floor is a constant in that script.

Getting that report written takes two settings, not one: `reporters` must list
`json`, because its default is `clear-text`, `progress` and `html`, and
`jsonReporter.fileName` only names a path for a reporter that has to be
switched on separately. Setting the filename alone yields no file and a check
that fails on every run.

Its semantics are taken from `spec-test-traceability`'s coverage floor
deliberately, so the repository has one floor idiom rather than two:

- above the floor → fail, reporting count and floor;
- below the floor → fail, naming the lower value to write, so a gain is
  recorded rather than absorbed;
- the floor's line must carry a trailing comment with at least one
  non-whitespace character, whichever direction the number moved.

Always demanding the comment, rather than only on a rise, is the same trade
made there: detecting the direction would mean reading the previous committed
value out of git history, and the reason lands in the diff either way.

### An equivalent mutant is marked where it lives

Stryker offers four ways to make a mutant stop counting. Ranked by how much
they hide:

1. `// Stryker disable next-line <Mutator>: <reason>` immediately above the
   line. The reason travels into the report, the mutant becomes `Ignored`, and
   the whole thing is visible in the diff at the site it concerns.
2. `mutator.excludedMutations` in the config — turns a mutator off across every
   file. Stryker's own documentation calls this a shotgun approach.
3. An ignore-plugin: a JS module exporting `shouldIgnore(path)` over Babel AST
   nodes, plus a dependency on `@stryker-mutator/api`. It earns its keep when a
   pattern repeats — the documented example is every `console.debug` call. No
   such pattern exists in a 296-line file.
4. Nothing at all: let equivalent mutants sit inside the floor. This is what
   makes a floor rot — "we tolerate twelve survivors, which twelve is unknown".

(1) is the mechanism; the others are named here so they are not re-proposed.
The named-mutator form is required rather than `all`, because `disable
next-line all` would also silence a future mutant on that line that nobody has
judged.

Only (1) is enforced by a scan. An earlier draft also had the check reject
`mutator.excludedMutations` in the configuration, and that was cut: a
fifteen-line JSON file is read whole by whoever reviews an edit to it, while a
disable comment is one line inside 296 lines of arithmetic. The scan exists for
the thing that hides, and mechanising the other one buys a guarantee review
already gives.

The residual hole is that a disable comment can be used to bury a real
survivor. Nothing mechanical distinguishes the two — it is the same trust a
test name already carries — but the comment must name the mutator and give a
reason, and both appear in the diff beside the code they excuse.

### Its own workflow job, not a `*.test.ts` file

`spec-test-traceability` ships its gate as `scripts/spec-coverage.test.ts`,
which is blocking in CI for free because CI already runs `bun test`. That
shape is wrong here: this gate spawns a process per mutant, and `bun test` is
what `pre-push` runs on every push. A separate `mutation.yml` keeps the pushes
fast and keeps a Stryker failure legible as itself.

The job runs Stryker and the check as two commands rather than having the
script spawn Stryker. That keeps the script's own work to reading files —
testable against synthetic input with no process management — and it means a
crashed Stryker fails the job through the shell instead of through a branch in
our code that has to tell "the tool broke" apart from "the floor was exceeded".

Reading files, not one file: the script has three inputs, and they are three
separate exported functions over three separate strings. The report gives the
survivor count; the script's own source gives the floor line and its reason;
and from step 2, `src/model.ts` gives the disable comments. Each takes its text
as an argument and resolves nothing, so all three are testable without a
filesystem. Only the CLI entry point resolves paths, and it resolves them from
the repository root.

Stryker declares `engines.node >= 20`, and the job does need `setup-node`
alongside `setup-bun` — measured, not assumed. With no `node` on `PATH`, `bunx`
falls back to running `bin/stryker.js` on Bun instead of honouring its
`#!/usr/bin/env node` shebang, and `@stryker-mutator/instrumenter` then throws
`generator is not a function` constructing its first mutant, because
`@babel/generator`'s CommonJS default resolves differently under Bun. With
`node` present the shebang is honoured and the run completes. `--no-install` is
required, not incidental: a bare `bunx` fetches on a cache miss and so bypasses
the release-age gate, which is the `playwright-cli` rule in `CLAUDE.md` applied
to a second tool.

Deleting `reports/mutation/` is the job's first step, because it is where
staleness can actually be prevented. A check that only reads a file cannot tell
last run's report from this one's; the invoker can guarantee there is no last
run's report at all.

### Two settings whose reason is not visible at the setting

`stryker.config.json` carries two entries that look like noise and are not.
JSON has no comments, so the reason lives here; the alternative — a
`stryker.config.js` that could hold them inline — was declined to keep the
configuration data rather than code.

**`tsconfigFile` points at `tsconfig.stryker-none.json`, a file the project does
not contain.** Stryker's `TSConfigPreprocessor` is the only place in the whole
package that imports `typescript`, and it calls `ts.parseConfigFileTextToJson`,
which TypeScript 7.0.2 does not expose — the same missing compiler API that
ruled out a mutator of our own, arriving a second time from inside the tool
that replaced it. The preprocessor exists to rewrite `extends`, `references`,
`include`, `exclude` and `files` when the sandbox moves them out of reach;
`tsconfig.json` here has none of the five, so its entire work would be to parse
the file and write it back unchanged. It skips itself when the configured root
tsconfig is not among the project's files, which is what naming an absent one
buys. The sandbox still receives the real `tsconfig.json` untouched — the
narrower-looking alternative, adding `tsconfig.json` to `ignorePatterns`, would
skip the preprocessor by removing the file from the sandbox instead, and a
later `paths` alias or JSX in the model's tests would then run against a
different configuration than a developer sees.

**`ignorePatterns` holds `.claude` and `spec-inbox`.** The sandbox is a copy of
the working tree, and `.claude/skills/*` are symlinks into a skills directory
outside the repository; copying them fails `ENOTSUP` and takes the run with it.
Both paths are gitignored, so this never reaches CI — it breaks local runs only,
which is the harder failure to diagnose, since the tool works for the job and
not for the developer. `spec-inbox` is excluded on its own terms: a sandbox copy
of private product specs is worth not making. `node_modules`, `.git`, `/reports`
and `.stryker-tmp` are ignored by Stryker unconditionally and need no entry.

### An override for a transitive advisory the tool pins shut

`package.json` gains `overrides: { "qs": "6.15.3" }`. Stryker reaches `qs`
through `typed-rest-client@2.3.1`, which pins it at exactly `6.15.1` — inside
GHSA-q8mj-m7cp-5q26's `>= 6.11.1 <= 6.15.1` range, fixed in 6.15.2. An exact
pin one level down is not something resolution can climb past, so without the
override `bun audit` exits 1 and `audit.yml`, which triggers on any pull
request touching `package.json` or `bun.lock`, fails on this very change.

The override is the narrowest instrument available: it names one package and
one version, leaves the rest of Stryker's 26-dependency subtree alone, and
reverts by deleting two lines once `typed-rest-client` moves. Silencing the
audit job instead was not on the table — `CLAUDE.md` forbids clearing a gate by
editing its configuration. 6.15.3 was published 2026-06-24, carries no install
script and comes from `ljharb/qs`, the canonical repository.

### Sandbox and report directories

Stryker copies the project into `.stryker-tmp` (its `tempDirName` default) and
symlinks `node_modules` into it, and the JSON reporter writes under `reports/`
by default. Both are new untracked output directories, so `.gitignore` covers
them before the tool runs for the first time.

## Risks / Trade-offs

- **A `Timeout` mutant counts as killed, and timeouts are timing-dependent.**
  → A mutant that loops near the timeout boundary could be killed on one runner
  and survive on another, which under a floor that fails in both directions is
  a CI flake rather than a warning. The default already carries the margin —
  `netTime × timeoutFactor + timeoutMS` is 5000 ms plus change against a 53 ms
  suite, ~75× headroom — so `timeoutMS` is left alone rather than tuned against
  a flake nobody has seen. A flip that does happen is fixed by raising
  `timeoutMS` or by stabilising the test, never by a disable comment: a mutant
  that flips is a live mutant with a timing problem, not an equivalent one, and
  marking it `Ignored` would retire a real mutant on a false description.
- **The command runner reruns the whole model suite per mutant, so cost is
  linear in both.** → 53 ms and ~34 tests today. A slow test added to
  `src/model.test.ts` later multiplies by the mutant count. Acceptable while
  the suite is milliseconds; the answer if it ever stops being so is a smaller
  command, not a cleverer runner.
- **`src/app/app.tsx` also calls `computeModel`, and its behaviour is not in
  the killing set.** → Correct and intended: that path is covered by Playwright,
  which the command deliberately does not run. A mutant killed only by an e2e
  test counts as a survivor here, which overstates the gap rather than hiding
  it.
- **26 direct dependencies enter a tree that had seven.** → The largest
  supply-chain expansion in the repository so far, in a repository whose
  premise is hardening. It is a devDependency, never shipped to a client, and
  `bunfig.toml`'s three-day release-age gate and `exact = true` apply to the
  whole subtree. `/warm` runs before the install and can still reject it.
- **The floor is one number over one file, so citing an unrelated equivalent
  mutant can pay for a real new survivor.** → Accepted, on the same terms
  `spec-test-traceability` accepted it: net traceability is unchanged, and the
  disable comment for the equivalent one is itself in the diff.
- **Stryker mutates the TypeScript source, and no type-checker prunes
  impossible mutants.** → Under Bun the types are stripped before execution, so
  a type-invalid mutant simply runs and is killed or survives on behaviour.
  Nothing is lost; `typescript-checker` is not installed.
