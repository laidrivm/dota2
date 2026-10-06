# Testing

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits. The testing rules true of any project
are `harness/testing.md`'s; this file holds the two that name what only
d2ass has.

## The mutation floor

- The harness's `mutation-floor.ts` counts the mutants surviving in
  `src/model.ts` — those Stryker reports as `Survived` or `NoCoverage` — and
  compares that count against `package.json`'s `harness.mutationFloor`. A count
  above the floor fails, and so does one below it: the floor is a measurement,
  not an upper bound.
- The floor carries a `why` giving the reason it holds that value, whichever
  direction it last moved. A floor with no reason fails.
- An equivalent mutant — one no test could kill, because it does not change
  behaviour — is admitted at the line it occupies, with
  `// Stryker disable next-line <Mutator>[,<Mutator>…]: <reason>`. It then
  reports as `Ignored`, drops out of the count, and the floor is lowered by a
  visible line. There is no register of exempt mutants: the exemption and the
  code it excuses sit together in the diff.
- `all` in place of a mutator name is rejected, so is a comment without
  `next-line`, and so is one with no reason after its colon.
- Delete `reports/mutation/` before a local Stryker run — the workflow does it,
  a shell does not, and the check cannot tell last run's report from this one's.
- Stryker reads its directives from every comment, a `/* … */` one included and
  anywhere on the line. The check reads the same surface but accepts only the
  `//` spelling, so a block-comment directive fails however well it is formed —
  one spelling in `src/model.ts` is what stops an exemption hiding behind a
  comment that does not look like one.
- **A line may be exempted only when every mutant its named mutator produces
  there is equivalent.** The comment is addressed to a line and a mutator, not
  to one mutant, so exempting a line whose mutator also produces a mutant the
  tests kill retires that one too — buying a lower floor by discarding a
  guarded behaviour. Where a line carries both, the survivor stays in the count
  and the floor stays where it is.

## E2E (Playwright)

The e2e suite exists to prove agentic changes didn't break real user paths.
Rules — all checkable in a diff:

- Locator priority: `getByRole` → `getByLabel` → `getByText` →
  `getByTestId` as last resort. CSS/class selectors are forbidden.
- Never `page.waitForTimeout` — use web-first assertions that auto-wait.
- Never `test.describe.serial` without a comment justifying why isolation
  is impossible.
- Tests are parallel-safe from birth: no shared mutable state between
  tests. CI runs e2e with `workers >= 2` — a single CI worker hides
  exactly the bugs parallelism exists to catch.
- Shared setup lives in fixtures, not copy-pasted `beforeEach`.
  Worker-scoped fixtures only for expensive **immutable** setup; any test
  that mutates a shared resource gets a test-scoped instance instead.
- No cleanup code for what Playwright already cleans (contexts, pages).
  Teardown only for resources Playwright didn't create (e.g. DB rows).
- When writing or changing e2e tests, consult the official Playwright docs
  (fixtures, projects, locators) — not memory, and not patterns absent
  from this young codebase.
