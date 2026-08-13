import type { HeroEntry } from "../../types.ts";
import { cx } from "../cx.ts";
import { heroAbbr, type Ink, tileInk } from "./format.ts";
import s from "./hero-tile.module.css";

type TileSize = "lg" | "md" | "sm";

/** The bundler owns the class names, so a variant is looked up rather than
 * spelled out from the prop — a name assembled here would match nothing. */
const SIZE: Record<TileSize, string | undefined> = {
	lg: s.tileLg,
	md: s.tileMd,
	sm: s.tileSm,
};

const INK: Record<Ink, string | undefined> = {
	dark: s.tileInkDark,
	light: s.tileInkLight,
};

/**
 * The palette lives in `tokens/colors.css` and is never restated here: the
 * background is a `var()` with the design's own fallback, and the lettering
 * colour is decided from the resolved value. Resolving costs a style read, so
 * each hero is looked up once per page.
 */
const inkBySlug = new Map<string, Ink>();

function inkFor(short: string): Ink {
	const known = inkBySlug.get(short);
	if (known !== undefined) return known;

	const root = getComputedStyle(document.documentElement);
	const resolved =
		root.getPropertyValue(`--hero-${short}`) ||
		root.getPropertyValue("--hero-fallback");
	const ink = tileInk(resolved);

	inkBySlug.set(short, ink);
	return ink;
}

/**
 * The coloured square that stands in for a hero icon. `label` is omitted
 * wherever the surrounding row already names the hero, so a screen reader
 * hears the name once rather than twice.
 */
export function HeroTile({
	hero,
	size,
	label,
}: {
	hero: HeroEntry | undefined;
	size: TileSize;
	label?: string;
}) {
	// A hero the snapshot no longer carries still gets its square, so the row it
	// sits in keeps its shape until proposal 2c can offer a re-pick. Its slug is
	// `fallback`, which resolves the fallback token through the same `var()`
	// every other slug goes through.
	const slug = hero?.short ?? "fallback";

	return (
		<span
			class={cx(s.tile, SIZE[size], INK[inkFor(slug)])}
			style={{ background: `var(--hero-${slug}, var(--hero-fallback))` }}
			{...(label === undefined
				? { "aria-hidden": true }
				: { role: "img", "aria-label": label })}
		>
			{heroAbbr(hero?.name ?? "")}
		</span>
	);
}
