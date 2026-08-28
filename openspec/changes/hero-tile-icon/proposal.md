# hero-tile-icon

## Why

The hero tile is a coloured square carrying a four-letter abbreviation, and it
is that because in Phase 2 there was no image to draw. There is one now: the
ingest mirrors each hero's portrait into `icons/` — 127 heroes, 127 files, none
missing — the bundle contract carries `heroes[].icon` (`src/types.ts:64`), and
`src/server/static-routes.ts` serves them from this origin under
`/icons/<slug>.png`. Nothing in `src/app/` reads any of it: `grep -rn '\.icon\b'
src/app/` returns nothing.

Meanwhile the placeholder it stands in for has decayed. `src/app/styles/tokens/
colors.css` carries 51 hero colours plus `--hero-fallback`, keyed on the
fixture's kebab-case `short` (`anti-mage`, `bounty-hunter`), where the ingest
writes STRATZ's `shortName` — snake_case, and Valve's internal names where the
two diverge (`antimage`, `nevermore`, `skeleton_king`, `zuus`, `rattletrap`,
`wisp`, `magnataur`, `life_stealer`, `doom_bringer`, `treant`). Against real
data 29 of 127 heroes resolve a colour, 22 of the 51 tokens are reachable by no
hero at all, and 86 heroes have none under any spelling. `draft-board` §*Hero
tile* admits the grey square, so those 98 tiles are not a defect — but they are
a placeholder whose reason has gone, and closing the gap by authoring 86 more
colours would entrench it. The colours are also not generatable: `format.ts`'s
`INK_THRESHOLD` decides the lettering from each colour's luminance, and the
palette belongs to the design project, which `PLAN.md` already records as out of
sync with `--tile-ink-*`.

## What Changes

- The hero tile draws `hero.icon` as its content. The palette becomes what
  stands behind the image and what is shown in its place when there is none.
- The abbreviation and the `--tile-ink-*` rule narrow to that fallback. When the
  image is there, it is the whole tile.
- The fallback covers two states, not one: a hero whose entry carries no `icon`,
  and an `icon` whose request does not resolve. The second is the ordinary state
  of a fresh clone and of the static build — `icons/` is gitignored and written
  only by a job run, and `bun run build` copies fonts and the snapshot into
  `dist/` but no images — so a tile that degrades to the square is what keeps
  `app-shell` §*Static production build* true.
- The source images are 256×144. The tile stays a square at its three fixed
  sizes and the image is cropped to it, so no row's geometry moves.
- The accessible name is unchanged: the wrapper keeps its `role="img"` and
  `aria-label` where it has one, and the image contributes no second name.
- The requirement is copied whole, so a drift inside it is corrected in the
  same move: it fixes the ink crossover at 0.22 where `format.ts` has held
  `INK_THRESHOLD = 0.18` since `1b85ee5`, and `format.test.ts` pins the code's
  value — `#2e7fd0`, luminance 0.203, is asserted to take dark lettering, which
  0.22 would refuse. The spec is what moves; no code and no colour does.
  `PLAN.md`'s entry on the design project's swatch pages already reads the
  threshold as 0.18, so nothing else restates 0.22.

## Non-goals

- **Repairing the slug mismatch.** The 22 unreachable tokens and the 86 heroes
  with no colour stay as they are. With an image for every hero the fallback is
  no longer on the common path, and deciding whose spelling of `short` is
  canonical — the client's kebab or Valve's internal name — reaches the
  fixture, the palette and the design project's swatch pages at once. It is its
  own change and stays in `PLAN.md`'s queue.
- **Authoring hero colours.** No token is added, removed or recoloured here.
- **The design project's guideline pages.** `PLAN.md` carries their desync from
  `--tile-ink-*` as a separate entry; narrowing where the ink rule applies does
  not make those pages this change's subject.
- **A second image size.** `hero-reference` mirrors exactly one and says why. A
  screen that needs another is the change that adds it.
- **Changing what the mirror stores or how it is served.** `icons.ts` and
  `static-routes.ts` are read by this change, not edited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `draft-board`: §*Hero tile* — what the tile draws, and what the palette, the
  abbreviation and the ink rule are demoted to.

## Impact

- `src/app/board/hero-tile.tsx` — the only component that renders a tile; its
  five call sites in `bans.tsx`, `panels.tsx`, `suggestions.tsx` and
  `picker/picker.tsx` pass a `HeroEntry` already and change none of their props.
- `src/app/board/hero-tile.module.css` — the image's box and crop.
- `src/app/board/format.ts` — `heroAbbr` and `tileInk` keep their callers and
  their tests; only the state they describe narrows.
- `e2e/` — the board and static-build specs run against a tree whose `icons/`
  may be empty, which is the fallback path they will exercise.
- No dependency, no route, no payload field, and no server change.
