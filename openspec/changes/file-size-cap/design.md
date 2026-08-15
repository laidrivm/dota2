# file-size-cap — design

## Context

`change-slicing` already owns one size gate: `scripts/diff-budget.sh`, warning
at 500 changed lines and failing at 800, measured over `<base>...HEAD`. It is
a property of a change. Nothing measures a property of a file, and the tree has
drifted: eleven files sit over the caps this change adopts, the largest at 4.7×.

The drift is invisible to the existing gate by construction. A 943-line
stylesheet reached that size across many changes, none of them large.

Current CSS delivery is a `<link rel="stylesheet" href="./src/app/styles/styles.css">`
in `index.html`; `styles.css` is five `@import` lines pulling three token files,
`base.css` and `app.css`. Nothing about styling passes through JavaScript today.

## Goals / Non-Goals

**Goals:**

- No file in the tree exceeds its cap on the day the cap lands, and none can
  afterwards.
- Component styles live beside the components and cannot leak into each other.
- The decomposition is behaviour-preserving, and something other than reading
  says so.

**Non-Goals:**

Carried from `proposal.md`, not restated here.

## Decisions

### The cap lands last, not first

Two orders were available. Land the gate first with the eleven files exempted and
shrink the exemption list; or decompose first and land the gate green.

The first is the shape `spec-test-traceability` uses for acceptance criteria,
and it is right there because that backlog is ~380 items nobody proposes to
clear. Here the backlog is eleven files and clearing it is the point of the
change. A cap whose first act is to grandfather every existing violation
enforces nothing for as long as the list survives, and the list is what gets
forgotten.

So the cap's own step is the last one, and it goes green the day it merges.
The cost is that during the intervening steps nothing stops a tenth file
crossing the line; the diff budget still applies throughout, and the window is
this change.

### 300 for `.ts`/`.tsx`, 200 for `.css`

Taken unchanged from the numbers `reviewable-diff-gates` recorded, rather than
re-derived. They were chosen once with reasons; re-picking them now would be
churn, and the measurement that matters — eleven files over, everything else
comfortably under — is the same either way. The next value below 300 that would
change the outcome is 254 (`src/app/app.tsx`), which is close enough to the
line to argue about and far enough from a reading problem not to.

Tests count. `reviewable-diff-gates` refused to exempt tests from the diff
budget on the grounds that test code is where agent-written slop hides, and
`docs/testing.md` says so directly. A 831-line test file is exactly that
hiding place.

### CSS Modules, not co-located plain CSS

The lazier option was to split `app.css` into `board/board.css`,
`picker/picker.css` and so on, keep the `@import` chain in `styles.css`, and
touch no component. It reaches the stated goal — styles beside components —
for a fraction of the diff.

It was declined because it leaves the property that made a 943-line stylesheet
possible: one global class namespace. Split or not, `.slot` is still reachable
from any file, so nothing prevents the next drift, and a reader still cannot
tell which rules a component actually depends on. `.module.css` makes the
dependency an import and the name local, which is what stops the file growing
back.

The cost is real and lands in one place: styles start arriving through the
JavaScript bundle. `index.html` no longer links `styles.css`; the entry point
imports the global layer (tokens and base) and each component imports its
own module. `build.test.ts` asserts on the single `*.css` file the bundler
emits into `dist`, so its expectations move with the mechanism.

Bun's bundler detects `.module.css` with no configuration and rewrites locally
scoped class names to unique identifiers — checked in Bun's bundler
documentation, not recalled.

### Development serves the built bundle

The documentation describes `bun build`. Bun's *other* implementation — the
HTML entry point served by `Bun.serve` — emits the scoped stylesheet correctly
and never defines the class-name mapping the components import, so every
component reading one throws and the page renders nothing (oven-sh/bun#18258,
open since March 2025; fix PR #33405 unmerged as of Bun 1.3.14). Only the dev
path is affected.

So `bun run dev` is `scripts/dev.ts`: it bundles into `dist/`, rebuilds on a
change under `src/`, and starts `server.ts` over the result. `server.ts` no
longer routes the HTML entry point; it serves `dist/` in development and in
production alike. It ships ahead of step 1 rather than inside it: it changes
how the application is served, which is its own reviewable unit.

That costs hot module replacement and buys a development page that is the
bundle production ships — so a defect the bundler introduces is under the e2e
suite rather than only under `build.test.ts`. The asset lookup is
`dist-routes.ts` rather than inline in `server.ts`, for the reason
`static-routes.ts` is its own file: its listing guard, which is what keeps a
request from naming a path outside `dist/`, can then be exercised without
starting a server.

### A picker rule that reaches into the hero tile becomes a custom property

Two rules crossed what became a module boundary: the picker rings the tile
`Enter` would take and fades the tile of a hero already drafted. A scoped class
name cannot be written from another module's stylesheet, so the tile reads
`box-shadow: var(--tile-ring, …)` and `opacity: var(--tile-fade, 1)`, and the
picker sets those two on its own classes.

Custom properties inherit, so nothing crosses the boundary and specificity
never enters it. The alternative — a `class` prop on `HeroTile` carrying one of
the picker's classes — puts two single-class selectors on the same declaration
and lets emission order decide, which the source does not state.

Fonts are the exception and do not move at all. `index.html` owns
`@import url("/fonts/fonts.css")` in an inline `<style>`, so the faces are
requested from the document rather than from the bundle; `build.test.ts`
asserts that import survives the build and `static-routes.test.ts` asserts the
served file's `content-type` and revalidation. `styles.css` never imported
`fonts.css` and still does not. Nothing about fonts changes here.

### The global layer stays global

Tokens, `base.css` and `fonts.css` are not modules. A design token is a custom
property on `:root` whose whole purpose is to be reachable everywhere, and
scoping it would defeat it. `base.css` styles bare elements, which have no
class to scope. Only component rules become modules.

### The token check is rescoped, not extended

`styles.test.ts` builds its file list with `Bun.Glob("**/*.css")` rooted at
`src/app/styles/`, then asserts no colour literal outside `tokens/`. Move
component CSS to `src/app/board/` and those files leave the glob silently — the
assertion still passes, over a smaller set, which is the failure mode that
looks most like success.

`CLAUDE.md` already has the rule: scope a scan by what it exempts, never by an
enumeration of what it covers. The glob becomes every tracked `*.css` in the
repository minus `tokens/`, so a stylesheet added anywhere is covered by
default. The same test also gains the guard that its own sweep found more than
zero files.

### `spec-coverage` gives up its implementation before its tests are cut

It is the largest file in the tree and the seam is not a matter of taste. Its
two siblings are a script and a test — `no-suppressions.ts`,
`mutation-floor.ts` — and this one is a test carrying both roles: the parser,
the citation reader, the sweep and the floor gauge all sit above the first
`describe`. Extracting `scripts/spec-coverage.ts` moves the larger half out,
matches the shape twice established, and leaves a test file small enough that
what remains splits by what it exercises rather than by where a line fell.

Splitting the tests without extracting first would have produced three test
files each carrying a copy of the implementation, or one of them exporting it
to the others — which is a script file with a test file's name.

### The e2e suite is the witness for the CSS move

A rename of every class in the application is the kind of change that type
checking cannot see. What can see it is the e2e suite, and it is fit for the
job by an existing rule rather than by luck: `docs/testing.md` forbids CSS and
class selectors in e2e in favour of `getByRole`/`getByLabel`/`getByText`, and a
grep of `e2e/smoke.spec.ts` finds no class selector. Scoped names therefore
cannot break a locator, and a rule that stopped applying to a moved component
shows up as a failing assertion about what the user sees.

That is weaker than a visual diff and is stated as such in the risks.

## Risks / Trade-offs

- **The e2e suite covers user paths, not appearance.** A component that loses a
  rule in the move keeps working and looks wrong. → Accepted for now; the
  mitigation is that each component moves in its own step, so the diff for any
  one of them is small enough to read against the block it came from. A visual
  regression tool is a separate proposal, not a precondition for this one.
- **The cap can be satisfied by moving lines rather than by simplifying.** A
  700-line module becomes three 250-line modules with the same tangle. → No
  mechanism prevents this and none is proposed; `/ponytail-review` and the diff
  budget are what read the split. The cap buys a ceiling on what one file
  demands at once, not good decomposition.
- **Nothing enforces the cap during the change's own steps.** Two files crossed
  the line inside that window — `scripts/spec-coverage.test.ts` and
  `scripts/mutation-floor.test.ts`, both written by changes that merged after
  this one was proposed. → The window is bounded by this change, and the diff
  budget still applies to every step in it. A file that crosses it is given a
  step of its own, never an exemption at the cap's step: the tree is
  re-measured against the caps before that step runs, because the list a
  proposal writes down is a measurement and measurements go stale.
- **`app.css` carries comments that explain design decisions** (why the radio
  covers the whole chip, why the design tints one button separately). Splitting
  a file is where comments get orphaned from the rules they explain. → Each
  comment moves with the rules it describes; the reviewer's check is that no
  comment lands in a module whose rules it does not mention.
- **Styles moving into the JS bundle changes what a broken build looks like.**
  A missing stylesheet becomes a missing import rather than a 404. → The
  existing `build.test.ts` assertions on `dist` move with it, and
  `static-routes.test.ts` continues to cover `fonts.css`, which stays served as
  a file.
