# hero-slug-canon — design

## Context

The palette in `src/app/styles/tokens/colors.css` is keyed on the fixture's
kebab spelling of a hero's `short`; the bundle carries the slug the hero source
publishes. `src/job/ingest/heroes.ts` builds two locations out of that slug —
the mirrored file's name and the Valve CDN address the portrait is fetched
from — so the ingest's spelling is the one that cannot move, and the palette is
the side that does.

Facts this design was measured against, not assumed. A portrait fetched from
the source is a non-interlaced 8-bit PNG, but not one shape: of 29 fetched,
24 are colour type 6 (RGBA) and 5 are type 2 (RGB), and while most are
256×144, `drow_ranger` is 128×72. `hero-tile-icon` recorded the single size it
saw; the decoder reads the header rather than trusting it.

`src/app/board/format.test.ts` already holds every hero colour to 4.5:1 against
the ink `format.ts`'s 0.18 luminance threshold picks. The token pattern it uses
today, `--(hero-[a-z0-9-]+)`, matches no underscore — a palette keyed on
`bounty_hunter` would leave that test silently — so it widens to the slug rule,
underscore included. No capability states that floor
today; `hero-palette` gives it one.

## Goals / Non-Goals

**Goals:**

- One spelling of `short` in the tree, and it is the one the data carries.
- A colour for every hero the mirror holds, reproducible from the portraits
  rather than maintained by hand.
- Colours that stay legible (4.5:1 with their ink) and distinguishable from one
  another.

**Non-Goals:**

- Endpoints: this change adds and changes none, so `/docs/api-design.md` has
  nothing to fix here.
- Fetching portraits. The generator reads a directory the existing mirror
  wrote; `fetchHeroes()` and `mirrorHeroImages()` populate it and are not
  touched.
- Running the generator automatically. It runs when the roster changes, by
  hand, and its output is committed.

## Decisions

### The slug the ingest writes is canonical

The alternative is a kebab-canonical client, which needs a hand-maintained
127-row mapping: the two spellings diverge by whole words rather than by
punctuation (`nevermore` for Shadow Fiend, `wisp` for Io, `doom_bringer` for
Doom), so no transform recovers one from the other. The palette is load-bearing
for nothing but its own tokens, so it is what moves.

### The portraits are decoded in-repo, with no new dependency

`node:zlib` inflates the IDAT stream; un-filtering the five PNG filter types
and reading 8-bit RGB/RGBA is about seventy lines. `sharp` would decode
anything, at the cost of a native dependency pulled in for one offline script
— which the WARM check would rightly ask about. The decoder refuses what it
does not implement (16-bit, palette, greyscale, interlaced) by naming the file
rather than guessing at it.

### The colour is an anchor, not the answer

Each portrait's dominant colour is taken by bucketing pixels into 24 hue
buckets weighted by saturation × value, ignoring near-transparent, very dark
(V < 0.15) and very grey (S < 0.15) pixels, and averaging the winning bucket.
Measured over 29 portraits, that is not enough on its own: 15 land in hue
0–40 and 13 in hue 127–235, with nothing in yellow, green, purple or pink, and
Anti-Mage (`#9f5023`), Bane (`#502d17`), Juggernaut (`#a54c13`) and Techies
(`#95562f`) are one colour to the eye. So the anchor is then moved: colours are
placed in slug order, `--hero-fallback` first at its committed value, and each
is searched for the nearest candidate that clears both floors.

*Nearest* is a fixed enumeration, because byte-determinism is a property of the
order rather than of the arithmetic: candidates are generated in HSV — hue
offset ascending from 0° in 4° steps, then value offset over
0, ±0.08, ±0.16, ±0.24, then saturation offset over 0, ∓0.12, with saturation
clamped to [0.15, 1] and value to [0.06, 1] — and each is rounded to 8-bit
channels before anything is measured, so two candidates never differ below the
precision the token is written at. Distance is ΔE76 in CIELAB, contrast is
against the ink the 0.18 threshold picks. The first candidate clearing both is
taken; ties cannot arise, since the enumeration is ordered and the first match
wins. A hero for which the enumeration runs out fails the run before any file
is written, which is what `hero-palette` requires.

### The floors are 15 ΔE76 and 4.5:1, because 15 is what fits

Simulated over 127 anchors drawn from the 29 measured ones: ΔE76 ≥ 20 is
infeasible under this search, ≥ 15 places all 127 and moves 115 of them off
their anchor. The contrast floor rarely binds — no anchor of the 29 needed
lifting, and the tightest was 4.74:1 — so the ΔE floor is what shapes the
palette. The generator reports the minimum it achieved, so a later roster makes
its own headroom visible rather than silently failing.

### The palette stays in `colors.css`

97 lines today, about 173 with 128 hero tokens, against the 200-line cap in
`scripts/file-size.ts`. A separate `tokens/hero-palette.css` buys nothing until
the roster grows by 27 more heroes; the cap is the sensor that will say so.

### The fixture carries slugs, not derived kebab

`src/fixtures/generate_fixture.py` builds `short` from the display name.
A slug it cannot derive is spelled out: each of the 33 rows gains an explicit
slug, taken from the mirror's own file names, and `snapshot.json` is
regenerated from it.

## Risks / Trade-offs

- **The palette loses its lore association.** Anti-Mage is violet today and
  anchors brown-orange; after the spread it is neither. → The square is what
  stands in for a portrait that is not there, so a colour drawn from that
  portrait is the closer stand-in; and the 15 ΔE floor is a property the hand
  palette never had — its closest pair, `--hero-bounty-hunter` against
  `--hero-undying`, sits at 6.9.
- **The design project stops being the palette's source.** → Its swatch pages
  are regenerated from the committed tokens in this change's last step, which
  also settles the `--tile-ink-*` desync `PLAN.md` records for those pages.
  That step is gated on DesignSync authenticating, which it currently does not
  (HTTP 403); if it stays down the step ships as a `PLAN.md` entry naming what
  is stale, rather than silently.
- **A greedy placement depends on its order.** → The order is the slug order
  and the generator is byte-deterministic, so the same mirror always yields the
  same palette. A hero added to the mirror can still move the colours of heroes
  placed after it, because they are placed against a set that now holds it:
  the run that adds a hero is a palette diff to read, not a one-line addition.
- **The 4.5:1 fit changes a colour the spread already placed.** → Contrast is
  checked inside the candidate search, not after it, so a candidate that
  cannot clear both floors is never chosen.
