# file-size-cap

## Why

`reviewable-diff-gates` recorded a per-file line cap as a deliberate non-goal:
"a second mechanism overlapping the PR budget. Revisit only if the PR budget
alone fails to bite." The revisit is now asked for, and the measurement says
why it is not redundant: the PR budget governs how much a *change* adds, and
nine files have grown past a readable size without any single change ever
exceeding 800 lines.

| file | lines | cap |
|---|---|---|
| `src/app/styles/app.css` | 943 | 200 |
| `src/app/session.test.ts` | 831 | 300 |
| `scripts/command-guard.test.ts` | 595 | 300 |
| `scripts/diff-budget.test.ts` | 448 | 300 |
| `src/app/board/board.tsx` | 436 | 300 |
| `src/model.test.ts` | 425 | 300 |
| `src/app/session.ts` | 422 | 300 |
| `agent-permissions.test.ts` | 347 | 300 |
| `scripts/command-guard.ts` | 333 | 300 |

A budget on the diff and a cap on the file answer different questions. The
first asks what a reviewer must read to approve a change; the second asks what
they must hold in their head to understand the file they are reading.

## What Changes

- A per-file cap: 300 lines for `.ts` and `.tsx`, 200 for `.css`, enforced by
  a check that ships as a test, the shape `scripts/no-suppressions.ts` already
  uses.
- **Every file over the cap is decomposed in this change.** The cap lands last,
  green on the day it lands. There is no exemption list and no floor with a
  backlog behind it — that shape was considered and rejected, because a cap
  whose first act is to grandfather nine violations gates nothing.
- `src/app/styles/app.css` is replaced by co-located CSS Modules: each
  component owns a `*.module.css` beside it and imports it, and class names are
  scoped by the bundler. Bun detects `.module.css` with no configuration.
- `index.html` stops linking `src/app/styles/styles.css`. Tokens, base and
  fonts stay global and are imported from the entry point; component styles
  arrive through the components that use them.
- The token check widens. `styles.test.ts` globs `**/*.css` under
  `src/app/styles/` only, so moving component CSS out of that directory would
  silently drop it from the "no colour literal outside `tokens/`" assertion.
  The glob becomes the whole tree minus `tokens/`, which is what `CLAUDE.md`
  already requires: scope a scan by what it exempts, never by an enumeration
  of what it covers.
- Five test files and three source files are split along seams named in
  `tasks.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-slicing`: gains the per-file cap beside the existing diff budget. The
  capability already owns "how work is cut into pull requests, and how a cut
  that failed is detected"; a file nobody can read whole is the same failure
  measured on the other axis.

`app-shell` is deliberately **not** modified. Its "Style values come from
design tokens" requirement already scopes itself to "the app's CSS outside
`src/app/styles/tokens/`", which stays true after the move — only the test
implementing it has to stop enumerating a directory.

## Non-goals

- **Editing `reviewable-diff-gates`.** It is archived. `PLAN.md`'s own protocol
  says an archived change is never edited and a fact discovered later is
  written where it is enforced, so the cap lands in the living
  `change-slicing` spec instead. The queue entry asking for an `/opsx:update`
  on that change is answered by this proposal and removed.
- **Exempting tests from the cap.** Five of the nine over-cap files are tests.
  `reviewable-diff-gates` rejected exempting tests from the *diff* budget
  because test code is where agent-written slop hides; the same reasoning
  holds one axis over.
- **A cap on any other file type.** Markdown is capped by the always-on
  context budget where it matters, and YAML and JSON configuration files are
  read by key, not by line.
- **Changing what the components render.** The decomposition is a move: same
  markup, same styles, same behaviour, with the e2e suite as the witness.
- **Retiring the diff budget.** The two gates measure different things and
  both stay.

## Impact

- New: a cap check and its test; one `*.module.css` beside each component; new
  modules for the eight splits; `src/css.d.ts` so TypeScript resolves a
  stylesheet import at all, and `src/app/cx.ts` to join the names a module
  hands back.
- New, and not foreseen when this was written, each shipping as its own pull
  request beside step 1: `scripts/dev.ts` and `dist-routes.ts`, because Bun's
  HTML dev server never defines a CSS module's class-name mapping
  (oven-sh/bun#18258) and development therefore builds and serves `dist/` — see
  `design.md`; and `src/app/module-classes.test.ts`, which checks that a
  component reads only names its module defines.
- Deleted: `src/app/styles/app.css`.
- Modified: `index.html`, every `.tsx` that carries a `class`, `styles.css`,
  `base.css` (the bare `dialog` panel has no class to scope),
  `src/app/styles/styles.test.ts`, `build.test.ts` (it globs `*.css` in `dist`
  and asserts on the single emitted stylesheet), `server.ts`, `package.json`,
  `playwright.config.ts`, `README.md`'s ownership map and its "Running it"
  section, `PLAN.md`'s bundler constraint, and
  `openspec/specs/change-slicing/`.
- The e2e suite is the safety net for the CSS migration, and it is a usable
  one: `docs/testing.md` forbids CSS and class selectors in e2e, and a grep of
  `e2e/smoke.spec.ts` finds none, so scoped class names cannot break a locator.
- No new dependency. Bun's bundler handles `.module.css` natively.
