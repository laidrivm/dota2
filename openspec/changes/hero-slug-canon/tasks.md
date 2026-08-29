# hero-slug-canon — tasks

Criteria are cited by the `### Requirement:` heading they sit under, in
`specs/hero-palette/spec.md` unless another capability is named. ZOMBIES idea
numbers refer to the report run against this proposal.

## 1. The generator reads a mirror and prints a palette

Closes *A portrait the decoder cannot read* and *The same mirror twice*, both
under *The palette is generated from the mirrored portraits* — whose remaining
criterion is closed in step 3, where the script gains its write. This step
writes no file and changes no shipped behaviour.

- [ ] 1.1 Decode a mirrored portrait in `scripts/hero-palette.ts`: inflate the
      IDAT stream with `node:zlib`, un-filter the five PNG filter types, and
      read 8-bit colour types 2 and 6 at whatever size IHDR names. Refuse
      16-bit, palette, greyscale and interlaced by naming the file (*A portrait
      the decoder cannot read*).
- [ ] 1.2 Derive a portrait's anchor colour: 24 hue buckets weighted by
      saturation × value, ignoring pixels with alpha < 250, value < 0.15 or
      saturation < 0.15, averaging the winning bucket. A portrait every pixel
      of which is ignored is an error naming the file, not a default colour
      (*A portrait the decoder cannot read*).
- [ ] 1.3 Read a directory of `<slug>.png`, refuse a name that is not a slug
      under `^[a-z0-9_-]+$`, and print the token lines to stdout in slug order
      (*The same mirror twice*).
- [ ] 1.4 Tests for the decoder and the anchor, from PNGs the test builds
      itself: ZOMBIES 1, 2, 3, 5, 6, 10, 11, 15, 16, 17, 18, 19.

## 2. The palette and the fixture take the ingest's slug

Closes *The palette is keyed on the slug the ingest writes*. The 51 colours are
unchanged here — only their names — so no tile changes appearance.

- [ ] 2.1 Populate a mirror locally through the existing `fetchHeroes()` and
      `mirrorHeroImages()` — which needs a STRATZ key, the deployed database's
      `heroes.short_name` standing in for it — and take the slug for each of
      the 51 palette heroes and 33 fixture heroes from its file names. Nothing
      in `src/job/` is edited.
- [ ] 2.2 Rename the 51 hero tokens in `src/app/styles/tokens/colors.css` to
      those slugs (*A hero whose slug and display name diverge*).
- [ ] 2.3 Give each row of `src/fixtures/generate_fixture.py` an explicit slug,
      derive `icon` from it rather than from the display name, and regenerate
      `snapshot.json` (*The fixture agrees with the palette*; *The fixture's two
      derived spellings*).
- [ ] 2.4 Widen both token patterns in `src/app/board/format.test.ts` to the
      slug rule, and replace the `> 50` entry floor with one that describes the
      palette being read (*A slug carrying a separator*; ZOMBIES 22, 23).
- [ ] 2.5 Tests: ZOMBIES 21, 25, 26, 27, 28.

## 3. The computed palette replaces the hand palette

Closes *Every hero colour clears the ink floor*, *No two hero colours read as
the same*, and the one scenario of `draft-board` *Hero tile* this change moves,
*Ink follows the background* — the other five are carried unchanged by the
whole-requirement copy.

- [ ] 3.1 Place the anchors: slug order, `--hero-fallback` first, each colour
      searched over hue rotations and saturation/value offsets for the nearest
      candidate at least 15 CIELAB ΔE76 from every placed colour and at least
      4.5:1 against the ink its own luminance selects. Fail rather than write a
      palette any pair of which is closer than 15 (*A colour that would not
      clear the floor*; *Two heroes whose portraits share a dominant colour*).
- [ ] 3.2 Rewrite only the `--hero-*` block of `colors.css`, leaving the rest
      of the file byte-identical and needing no reformatting by `biome ci .`,
      and report the achieved minimum ΔE76 (ZOMBIES 12, 13, 14).
- [ ] 3.3 Run the generator over the full mirror and commit the palette: one
      token per mirrored portrait, plus `--hero-fallback` on every run whatever
      the mirror holds, which is what a hero released since the run resolves
      (*A mirror holding every hero the palette knows*; *A hero the mirror has
      no portrait for*). Re-check the file against the 200-line cap in
      `scripts/file-size.ts`.
- [ ] 3.4 Apply the `draft-board` delta: *Ink follows the background* cites the
      0.18 threshold instead of Bane's and Io's hex values, which the
      regenerated palette no longer carries, and the requirement's sentence
      says the ink follows whichever background resolved rather than the
      fallback token alone. Re-run the five criteria the whole-requirement copy
      carries — *The image is drawn*, *The image does not load*,
      *Abbreviation*, *Hero missing from the palette*, *Hero missing from the
      snapshot* — against the regenerated palette; the change delivers none of
      them anew and must leave all five passing.
- [ ] 3.5 Replace the two ink cases in `src/app/board/format.test.ts` that
      borrow `#4a3d85` and `#dce8f2` from the palette: after regeneration
      neither colour is in it, so the case chooses its own values either side
      of the threshold.
- [ ] 3.6 Re-read the comments over the palette block — `one unique color per
      hero` and the `--tile-ink-*` note — against what the generator now
      guarantees, and correct what has stopped being true.
- [ ] 3.7 Tests: ZOMBIES 4, 8, 9, 20, 24. ZOMBIES 7 — that adding a portrait
      moves no placed token — is not written: greedy placement in slug order
      does not hold it, and `design.md` says so under *Risks*.
- [ ] 3.8 Check `e2e/` for an assertion pinning a hero colour or a kebab slug,
      and move it to the property rather than the value if one exists.

## 4. The design project and the queue

Closes no acceptance criterion: nothing in this step is behaviour the
application exhibits.

- [ ] 4.1 Regenerate the design project's `guidelines/colors-hero-palette.html`
      and `guidelines/component-hero-tile.html` from the committed tokens
      through DesignSync, which also settles the `--tile-ink-*` desync those
      pages carry. If DesignSync is still refusing to authenticate, write what
      is stale into `PLAN.md` instead and say so in the pull request.
- [ ] 4.2 Close the open decision in `PLAN.md`, and fold in or delete the
      design-page entry according to what 4.1 achieved.
