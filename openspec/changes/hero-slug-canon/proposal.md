# hero-slug-canon

## Why

Two spellings of a hero's `short` are in the tree and nothing says which is
right. `src/app/styles/tokens/colors.css` keys 51 hero colours on the fixture's
kebab (`--hero-anti-mage`), where every row the ingest writes carries STRATZ's
slug (`antimage`): `src/job/ingest/heroes.ts` reads `shortName` and
`src/job/export/render.ts` passes `short_name` into the bundle unchanged, so
the board looks up a token under a name the data never uses. `hero-tile-icon`
measured the result — against live data 29 of 127 heroes resolve a colour, 22
of the 51 tokens are reachable by no hero, and 86 heroes have none under any
spelling — and left the decision open, because settling it reaches the fixture,
the palette and the design project's swatch pages at once. It covered the
square with the mirrored portrait, which narrowed where the mismatch shows —
an image that fails to load, a fresh clone, the static build, all three of
which draw the square — rather than removing it. `PLAN.md` has carried the
decision since.

The ingest's spelling is the one that cannot move. `heroes.ts` derives both the
mirrored file's name and the Valve CDN address the portrait is fetched from
out of `shortName`, and the two diverge from the display name by different
words rather than by punctuation (`nevermore`, `wisp`, `doom_bringer`), so a
kebab-canonical client would need a hand-maintained 127-row mapping to keep
either working. The palette is load-bearing for nothing but its own tokens.

## What Changes

- The slug the ingest writes is canonical. The palette, the fixture and the
  design project's swatch pages move to it; no ingest, export or bundle code
  changes.
- Every hero the mirror holds gets a colour, not 51 of them. The colours are
  computed from the mirrored portraits by a script and committed, so the
  palette is reproducible rather than maintained by hand, and a hero released
  after the last run still falls back the way the board already allows.
- **BREAKING for the palette's provenance**: all 127 colours are computed,
  including the 51 authored by hand today. The design project stops being the
  palette's source and becomes its mirror.
- Each computed colour is lifted or darkened until it clears 4.5:1 against the
  ink `format.ts`'s threshold picks for it, which is the floor
  `src/app/board/format.test.ts` already holds the current 52 to.
- The contrast test's own token pattern widens to the slug rule in
  `src/job/ingest/icons.ts`: `--(hero-[a-z0-9-]+)` matches no underscore, so
  `--hero-bounty_hunter` would leave the test silently.
- `draft-board` §*Hero tile* stops naming two colours by hex. The scenario that
  pins the ink crossover cites the threshold instead, so a regenerated palette
  does not put a spec and a token file into disagreement.

## Non-goals

- **Changing what the ingest writes, mirrors or serves.** `heroes.ts`,
  `icons.ts` and `static-routes.ts` are read by this change, not edited.
- **A colour for a hero the mirror does not hold.** The roster is whatever the
  last mirror run wrote; `--hero-fallback` and `draft-board`'s *Hero missing
  from the palette* scenario stay exactly as they are for a hero released after
  it.
- **Running the generator in CI or in the snapshot job.** It is a script a
  person runs when the roster changes, and its output is committed.
- **The `--tile-ink-*` desync `PLAN.md` records separately.** Regenerating the
  swatch pages from the new palette reaches those pages, and that entry is
  settled by this change's last step or by nothing.
- **A second image size, or reading the portrait at runtime.** The colour is
  computed once, offline, into a token.

## Capabilities

### New Capabilities

- `hero-palette`: what the palette is keyed on, which heroes it covers, the
  contrast floor every token clears, and how it is regenerated from the
  mirrored portraits.

### Modified Capabilities

- `draft-board`: §*Hero tile* — the ink-crossover scenario stops citing two
  hero colours by hex and cites the luminance threshold it is testing.

## Impact

- `src/app/styles/tokens/colors.css` — 52 hero tokens become 128, keyed on the
  ingest slug. 97 lines today, ~173 after, against the 200-line cap in
  `scripts/file-size.ts`.
- `scripts/hero-palette.ts` (new) and its test — the generator.
- `src/fixtures/generate_fixture.py`, `src/fixtures/snapshot.json` — the 33
  fixture heroes carry the ingest's slug.
- `src/app/board/format.test.ts` — the token pattern.
- `openspec/specs/draft-board/spec.md` — one scenario.
- The design project's `guidelines/colors-hero-palette.html` and
  `guidelines/component-hero-tile.html`, via DesignSync.
- `PLAN.md` — the open decision closes.
- No new dependency: the portraits are PNGs and `node:zlib` inflates them.
