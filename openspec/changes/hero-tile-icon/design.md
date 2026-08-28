# hero-tile-icon — design

## Context

`src/app/board/hero-tile.tsx` is the only component that draws a hero, and its
five call sites (`bans.tsx`, `panels.tsx` twice, `suggestions.tsx`,
`picker/picker.tsx`) pass a `HeroEntry` and a size. It renders one `<span>`
whose inline style is `background: var(--hero-<short>, var(--hero-fallback))`
and whose text is `heroAbbr(hero.name)`, with `role="img"` plus `aria-label`
where the surrounding row does not already name the hero and `aria-hidden`
where it does. `inkFor` reads the resolved custom property once per slug through
`getComputedStyle` and caches the ink in a module-level `Map`.

What the image side already provides, and what this change consumes:

- `src/job/ingest/icons.ts` mirrors one 256×144 PNG per hero into `icons/`,
  under the hero's `shortName`, and `iconPath` writes `/icons/<slug>.png` into
  the `heroes.icon` column. Measured on the current mirror: 127 files, 8.6 MB,
  68 KB mean.
- `src/server/static-routes.ts` serves that directory, resolving the listing per
  request so a hero mirrored tonight is reachable without a restart, and answers
  anything not in the listing `404` with no body. The bytes under a name never
  change, so they carry `max-age=31536000, immutable`.
- `icons/` is gitignored. A clone that has never run the ingest has no directory
  at all, and `bun run build` copies `src/app/styles/fonts` and
  `src/fixtures/snapshot.json` into `dist/` but no images — so `dist/` served by
  a plain file host, which `app-shell` §*Static production build* requires to
  work, has no image for any hero.

So the fallback is not an edge: it is the whole of the static build and of every
fresh clone, and it is what `e2e/static-build.spec.ts` runs against.

## Goals / Non-Goals

**Goals:**

- The tile shows the hero, not four letters standing in for it.
- The tile behaves identically whether or not the mirror is populated, with no
  broken-image affordance in the empty case.
- No new dependency, no new route, no new payload field, no call-site change.
- Opening the picker does not fetch 8.6 MB.

**Non-Goals:** as `proposal.md` §*Non-goals* sets out — the slug mismatch, the
palette's contents, the design project's swatch pages, a second mirrored size,
and the mirror and route themselves.

## Decisions

### An `<img>` over the existing square, not a `background-image`

The square keeps its background and its abbreviation, and the image is an
absolutely positioned `<img>` filling the tile.

A `background-image` on the same span is the smaller diff and was tried on
paper first: it needs no element and no error path, because a background that
fails to load silently leaves the background colour showing. It is rejected for
one reason — a background image paints *below* the element's content, so the
abbreviation would sit on top of every hero portrait. Hiding it would need CSS
to know whether the image loaded, which CSS cannot ask.

That leaves the image above the text, which is what an overlaid `<img>` is.
`object-fit: cover` with the default centre `object-position` crops the 256×144
source to the square at each of the three sizes; nothing in any row's geometry
moves, because the tile's own box is unchanged.

### The failure is handled in code, not left to the user agent's rendering

An `<img alt="">` whose request fails is widely said to render nothing visible,
which would make the fallback free. That has not been measured here and is not
relied on: `playwright.config.ts` runs one project, `chromium`, so a behaviour
that differs per engine would be asserted in one engine and unchecked in the
rest. The criterion *The image does not resolve* says the
tile presents no broken-image affordance, and that is made true by not rendering
the element.

The state is the `src` that failed, not a boolean: Preact reuses a tile's
component instance when the hero in that slot changes, so a boolean would leave
the next hero's image suppressed by the previous hero's failure. Comparing the
failed `src` against the current one resets itself and needs no `key` at any
call site.

### `hero.icon` is validated before it becomes a `src`, in `format.ts`

`src/app/snapshot.ts`'s `isHeroEntry` checks `id` and `name` only, so `icon`
reaches the component as an unvalidated string from the payload. Rendering it
into `src` unchecked would put `app-shell` §*No third-party runtime requests* at
the mercy of the payload's contents.

`format.ts` gains the predicate — it is where the board's non-DOM branches
already live, and it is covered by `format.test.ts` without a browser. The
pattern is anchored at both ends and mirrors `isSlug` in `src/job/ingest/
icons.ts`, which is the one rule for what a slug may be, checked where the name
arrives: `/^\/icons\/[a-z0-9_-]+\.png$/`. A value that does not match is treated
exactly as an absent one — the tile falls back — rather than throwing, because a
malformed path for one hero must not cost the board its other nine slots.

Rejected: validating in `snapshot.ts`. Its failure mode is refusing the whole
payload, which trades a wrong square for no board at all.

### `loading="lazy"`

The picker renders one `lg` tile per match, and an empty query matches every
hero: 127 images, 8.6 MB, in one paint. `loading="lazy"` is one attribute and
holds the fetch until the tile is near the viewport, inside the scrolling grid
as well as on the page. It goes on every tile rather than on the picker's alone
— a bans row of twelve and two panels of five are the same argument at smaller
scale, and one attribute is cheaper than a prop that says which.

`decoding="async"` rides with it so a slow decode does not block the frame that
opens the picker.

### The ink threshold is corrected where the requirement is copied

The live requirement fixes the crossover at 0.22; `format.ts` has held
`INK_THRESHOLD = 0.18` since `1b85ee5`, and `format.test.ts` asserts `#2e7fd0`
(luminance 0.203) takes dark lettering, which 0.22 refuses. A `MODIFIED`
requirement is copied whole, so the number is either corrected here or
re-published wrong. The spec moves to the code; no colour and no threshold
changes.

## Risks / Trade-offs

- **A 68 KB image drawn at 26px.** → The mirror holds one size, and
  `hero-reference` says why; a second is its own change. What this change pays
  is bounded instead: lazy loading defers everything off-screen, and the route's
  `immutable` year means each hero is fetched once per browser, ever.
- **`loading="lazy"` defers an image the user is looking at.** The attribute is
  a hint, and a browser that defers too eagerly shows the palette square for a
  moment. → That state is a specified one, not a defect: it is what every tile
  shows before its image arrives, and it carries the hero's abbreviation.
- **The abbreviation stays in the DOM under every image.** → It costs a text
  node and is what the fallback needs; `role="img"` on the wrapper already makes
  the tile's contents presentational, so no screen reader gains a second
  reading of it.
- **A hero whose portrait is dark centre-left crops to something unreadable at
  26px.** → Unmeasured across 127 heroes and not measurable from here; the crop
  is the same one Valve's own client uses for these files. If a hero reads
  badly, `object-position` is a per-tile knob this design leaves in place.
- **The delta narrows where the ink rule applies, and the design project's
  swatch pages describe it unnarrowed.** → Those pages are already recorded in
  `PLAN.md` as out of sync with `--tile-ink-*`; this adds a second reason to the
  same open entry rather than a new one.

## Open Questions

None. The one decision that was the user's — whether the abbreviation survives
over a loaded image — was put and answered: it does not.
