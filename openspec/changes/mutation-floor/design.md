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
`` Record<`${Role}`, number> `` at offset 8025 as the opening of a new template
and swallows the remaining 1200 characters of the file as literal text, ending
the scan after 157 tokens.

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

### The command runner, because there is no `bun:test` plugin and none is needed

Stryker's runner plugins cover Jest, Mocha, Karma, Jasmine, Vitest, Tap and
Cucumber. There is no Bun runner on the registry under any name. The default
`testRunner` is `command`: it runs a configured shell command per mutant and
reads only the exit code. Its documented drawback is that Stryker can do no
per-test optimisation and must run the whole suite for every mutant.

That drawback costs 53 ms per mutant here. Even several hundred mutants run
serially would finish in under a minute, and Stryker parallelises across cores
by default. The optimisation the plugins exist to provide is worth nothing at
this suite size, so the missing plugin is not a gap.

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
JSON report (`jsonReporter.fileName`) and counts mutants with status
`Survived`. The floor is a constant in that script.

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

Stryker declares `engines.node >= 20`, so the job may need `setup-node`
alongside `setup-bun`. Whether `bunx stryker run` works without Node is a
genuine unknown and is resolved by trying it in the first task, not by
guessing here.

### Sandbox and report directories

Stryker copies the project into `.stryker-tmp` (its `tempDirName` default) and
symlinks `node_modules` into it, and the JSON reporter writes under `reports/`
by default. Both are new untracked output directories, so `.gitignore` covers
them before the tool runs for the first time.

## Risks / Trade-offs

- **A `Timeout` mutant counts as killed, and timeouts are timing-dependent.**
  → A mutant that loops near the timeout boundary could be killed on one runner
  and survive on another, which under a floor that fails in both directions is
  a CI flake rather than a warning. Mitigated by raising `timeoutMS` well above
  the default relative to a 53 ms suite; if a flip is observed anyway, it is a
  fact about a specific mutant and gets a disable comment with that as its
  reason.
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
