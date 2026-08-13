# CSS modules on Bun — what step 1 of `file-size-cap` established

Written 2026-08-13, against Bun 1.3.14. For whoever picks up steps 2 and 3,
which move the board's and the shell's styles the same way step 1 moved the
hero tile's, the picker's and the dialogs'.

## What the bundler does, and what the dev server does not

`bun build` handles `.module.css` with no configuration: it emits the scoped
stylesheet **and** the class-name mapping the importing module reads.

`Bun.serve` with an HTML route is a **second implementation**. It emits the
scoped stylesheet correctly — same hashes as production — and never defines the
mapping, so every component reading one throws `ReferenceError:
import_<name>_module is not defined` and the page renders nothing.
oven-sh/bun#18258, open since 2026-03-17; its fix PR #33405 was unmerged at
1.3.14. Not HMR-specific: `development: { hmr: false }` behaves the same.

The consequence is in the tree already: `bun run dev` is `scripts/dev.ts`,
which builds into `dist/`, watches, and serves the result through `server.ts`.
Do not try to put the HTML entry point back on a route until #33405 ships.

## Bun behaviours measured this session, not recalled

- `Bun.build()` **rejects** on a failed build (`AggregateError`); it does not
  resolve with `success: false`. `scripts/dev.ts` relies on this — its cleanup
  step is in the `.then`, so a broken save leaves the last good bundle serving.
- `Bun.Glob().scanSync` does **not** follow symlinks; `followSymlinks` defaults
  to false. `dist-routes.ts`'s containment rests on that default, and
  `build.test.ts` pins it.
- `Bun.Transpiler({ loader: "tsx" }).transformSync` strips JSX while keeping
  the import statement verbatim and every property-access form —
  `s.a`, `s?.a`, `s["a"]`, `s?.["a"]`, and reads inside template expressions.
  It throws on anything that does not parse, which is how
  `module-classes.test.ts` tells source from the rest of the tracked tree.
- TypeScript picks the **first** matching ambient wildcard, so
  `declare module "*.module.css"` must come before `declare module "*.css"`.
  Reversed, every read off a module fails to compile.

## Decisions that will come up again in steps 2 and 3

- **A rule that reaches across a module boundary becomes a custom property.**
  The picker rings the tile `Enter` would take and fades the tile of a hero
  already drafted; a scoped class name cannot be written from another module's
  stylesheet. The tile reads `var(--tile-ring, …)` and `var(--tile-fade, 1)`.
  The alternative — a `class` prop — puts two single-class selectors on one
  declaration and lets emission order decide.
- **A bare element has no class to scope**, so it goes to `base.css`. The
  `<dialog>` panel went there.
- **A media query splits per module.** Rules left behind in a global sheet
  match nothing once their selectors are scoped, silently.
- **Do not verify a move by line count.** The block splits across more
  destinations than the task list expects. Compare the multiset of
  declarations and of selectors before and after and account for every
  difference; step 1's move came out at 494 against 495, differing only by the
  four the custom properties account for.

## Ruled out

- **Co-located plain CSS** instead of modules — `design.md` declined it before
  this session and nothing here reopens it.
- **A `.d.ts` twin per module** to make class names type-checked. It moves the
  errors to `tsc`, but every module then needs a hand-maintained twin and
  nothing checks the twin against the stylesheet.
- **Recursive listing in `dist-routes.ts`.** The cache key is one directory's
  mtime, and a write inside a child changes the child's. The listing spans
  exactly what the key covers.

## Where this stopped

Step 1 of eight is merged. Steps 2 and 3 move the board and the shell; step 3
also rescopes the token check in `src/app/styles/styles.test.ts` and deletes
`app.css`. Steps 4–8 do not touch CSS.

`src/app/styles/app.css` stands at 690 lines against a 200-line cap that step 8
introduces, so it has to reach zero before then.

## Open, and not this change's

- `.coderabbit.yaml` points `code_guidelines` at `**/CLAUDE.md`, so a rule
  moved out of that file stops reaching the bot. This blocked extracting
  `CLAUDE.md`'s rule sublists to `docs/rules.md`, together with the
  `context-budget` requirement that pins one rule to `CLAUDE.md`'s list. Both
  would have to move in one change, and the `code_guidelines` path resolution
  was never measured.
