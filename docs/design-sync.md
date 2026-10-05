# Design sync

Indexed from `CLAUDE.md`. Read when the palette or the design project is
touched.

The board's screen design lives in the private claude.ai/design project
"Draft board screen design", reached through `DesignSync`.

## The swatch pages are derived, not authored

`guidelines/colors-hero-palette.html` and `guidelines/component-hero-tile.html`
are written from `src/app/styles/tokens/colors.css`: one swatch per token in
file order, background `var(--hero-<slug>)`, label the slug verbatim, letters
`heroAbbr` of the hero's display name, ink `var(--tile-ink-dark)` or
`var(--tile-ink-light)` by the 0.18 luminance threshold. The display name is
not in `colors.css`, which holds slugs and colours alone: it comes from the
same place the slugs do, `heroes.name` in the deployed database, or
`heroes[].name` in the published bundle for the subset that carries stats.
The fallback's swatch has no hero and so no letters. The project's own
`tokens/colors.css` carries the same hero block and nothing else of it is
the repository's to touch. Regenerating them is part of regenerating the
palette: CSS cannot pick an ink by its background's luminance, so a hero
that crosses 0.18 keeps the old ink on the page until somebody runs it
again.
