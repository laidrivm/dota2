# Testing

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits.

- Prefer TDD for edge cases: turn `/zombies` output into failing tests first,
  then implement.
- Tests must assert behaviour, not mirror the implementation. A test that
  would pass against a broken implementation is not a test.
- Route `/zombies` findings by layer: Zero/One/Many/Boundaries/Interface/
  Exceptions → unit or integration tests; Simple scenarios marked
  `(e2e candidate)` → the Playwright smoke suite.
- Scaffolding tests are welcome but mortal: you may write throwaway tests
  to verify your own work during a build (that's how you close your loop),
  but before archive only tests that trace to the `/zombies` list and obey
  the rules above survive — delete the rest, especially negative tests
  ("feature X no longer exists") and implementation-detail assertions.

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
