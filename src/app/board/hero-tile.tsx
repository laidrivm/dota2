import type { HeroEntry } from "../../types.ts";
import { heroAbbr, type Ink, tileInk } from "./format.ts";

export type TileSize = "lg" | "md" | "sm";

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
	// A hero the snapshot no longer carries still gets its square, so the row
	// it sits in keeps its shape until proposal 2c can offer a re-pick.
	const short = hero?.short;

	return (
		<span
			class={`tile tile-${size} tile-ink-${short === undefined ? "light" : inkFor(short)}`}
			style={{
				background:
					short === undefined
						? "var(--hero-fallback)"
						: `var(--hero-${short}, var(--hero-fallback))`,
			}}
			{...(label === undefined
				? { "aria-hidden": true }
				: { role: "img", "aria-label": label })}
		>
			{hero === undefined ? "" : heroAbbr(hero.name)}
		</span>
	);
}
