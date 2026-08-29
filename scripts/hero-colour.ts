/**
 * The colour arithmetic the palette generator is built out of, and the search
 * that turns a portrait's anchor into a token nobody confuses with another.
 *
 * Apart from `hero-palette.ts` because that file is at its cap, and because
 * the seam is real: everything here is about a colour, nothing about a file.
 *
 * The two floors are what the search exists for. A tile's abbreviation has to
 * be legible on its square, and two squares side by side have to be tellable
 * apart — neither of which the portraits give on their own. Measured over 29
 * of them, the anchors bunch into two hue ranges and four heroes came out one
 * colour to the eye.
 */
import { inkFor, relativeLuminance } from "../src/app/board/format.ts";

/** Hue in [0, 360), saturation and value in [0, 1], from 8-bit channels. */
export function hsv(r: number, g: number, b: number) {
	const max = Math.max(r, g, b);
	const span = max - Math.min(r, g, b);
	let hue = 0;
	if (span !== 0) {
		if (max === r) hue = 60 * (((g - b) / span) % 6);
		else if (max === g) hue = 60 * ((b - r) / span + 2);
		else hue = 60 * ((r - g) / span + 4);
	}
	return {
		hue: (hue + 360) % 360,
		saturation: max === 0 ? 0 : span / max,
		value: max / 255,
	};
}

/** `#rrggbb` from hue, saturation and value, rounded to what a token holds. */
export function hex(hue: number, saturation: number, value: number): string {
	const chroma = value * saturation;
	const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const base = value - chroma;
	const sector = Math.floor(hue / 60) % 6;
	const rgb = [
		[chroma, second, 0],
		[second, chroma, 0],
		[0, chroma, second],
		[0, second, chroma],
		[second, 0, chroma],
		[chroma, 0, second],
	][sector] ?? [0, 0, 0];
	return `#${rgb
		.map((c) =>
			Math.round((c + base) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** CIELAB under D65, the space the distance below is defined in. */
export function lab(colour: string): [number, number, number] {
	const channel = (offset: number) =>
		Number.parseInt(colour.slice(offset, offset + 2), 16) / 255;
	const linear = (c: number) =>
		c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	const r = linear(channel(1));
	const g = linear(channel(3));
	const b = linear(channel(5));
	// Divided by the white point, so the neutral axis lands at a = b = 0.
	const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
	const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
	const f = (t: number) =>
		t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
	const fx = f(x);
	const fy = f(y);
	const fz = f(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Straight-line distance in CIELAB: ΔE76, which is what the floor is in. */
export const deltaE76 = (
	a: [number, number, number],
	b: [number, number, number],
) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The relative luminance of each ink, as the token file declares them. */
export type Inks = { dark: number; light: number };

/** How a colour contrasts with the ink its own luminance selects. */
export function contrast(colour: string, inks: Inks): number {
	const luminance = relativeLuminance(colour);
	if (luminance === null) throw new Error(`${colour} is not a colour`);
	const ink = inkFor(luminance) === "dark" ? inks.dark : inks.light;
	return (Math.max(luminance, ink) + 0.05) / (Math.min(luminance, ink) + 0.05);
}

/** Least ΔE76 any two placed colours may sit at, and least contrast with ink. */
export const MIN_DISTANCE = 15;
export const MIN_CONTRAST = 4.5;

/**
 * Where a colour may be moved to, nearest first.
 *
 * A fixed enumeration rather than a nearest-neighbour search, because what
 * makes a run repeatable is the order rather than the arithmetic. It opens at
 * the anchor itself, so a colour clearing both floors unmoved is returned
 * unmoved. After that it is not nearest-first and does not claim to be: the
 * dimensions are tried in the order `design.md` lists them — hue outermost,
 * then value, then saturation — so every value and saturation variant at one
 * hue is exhausted before the hue turns. Over the committed roster that puts
 * the furthest-moved colour 126 ΔE76 from its anchor.
 *
 * Sweeping hue innermost would move each colour less on its own, and does not
 * work: measured over the same 127 anchors it runs out before placing them
 * all. The two orders enumerate the same 1890 candidates and differ only in
 * sequence, so what decides the outcome is which colours the earlier heroes
 * take out of circulation.
 *
 * Every candidate is rounded to eight bits before it is measured, so no two
 * of them differ below the precision a token is written at.
 */
function* candidates(colour: string) {
	const { hue, saturation, value } = hsv(
		Number.parseInt(colour.slice(1, 3), 16),
		Number.parseInt(colour.slice(3, 5), 16),
		Number.parseInt(colour.slice(5, 7), 16),
	);
	// Read off `design.md`'s notation: `±` opens with the plus, `∓` with the
	// minus, and both alternate outwards from nothing.
	for (let turn = 0; turn < 90; turn++)
		for (const dv of [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24])
			for (const ds of [0, -0.12, 0.12])
				yield hex(
					(hue + turn * 4) % 360,
					Math.min(1, Math.max(0.15, saturation + ds)),
					Math.min(1, Math.max(0.06, value + dv)),
				);
}

export type Placed = { slug: string; colour: string };

/**
 * Every anchor moved to the nearest colour clearing both floors, in the order
 * given. `fallback` is placed first and never searched: `draft-board` resolves
 * it for a hero the palette has no token for, so a run that moved it would
 * change what an unknown hero looks like.
 *
 * Greedy, so the order decides the outcome — which is why the caller passes
 * slug order and why a hero added to the mirror is a palette diff to read
 * rather than a line appended.
 */
export function place(
	fallback: Placed,
	anchors: Placed[],
	inks: Inks,
): { palette: Placed[]; minimum: number } {
	if (contrast(fallback.colour, inks) < MIN_CONTRAST)
		throw new Error(
			`${fallback.slug} is ${fallback.colour}, which no run may move, and it does not clear ${MIN_CONTRAST}:1`,
		);
	const palette = [fallback];
	const labs = [lab(fallback.colour)];

	for (const anchor of anchors) {
		let taken: string | undefined;
		for (const candidate of candidates(anchor.colour)) {
			if (contrast(candidate, inks) < MIN_CONTRAST) continue;
			const point = lab(candidate);
			if (labs.some((other) => deltaE76(point, other) < MIN_DISTANCE)) continue;
			taken = candidate;
			labs.push(point);
			break;
		}
		if (taken === undefined)
			throw new Error(
				`no colour within reach of ${anchor.slug}'s ${anchor.colour} clears ${MIN_DISTANCE} ΔE76 from every colour already placed`,
			);
		palette.push({ slug: anchor.slug, colour: taken });
	}

	// Reported rather than asserted: the floor is enforced above, and what a
	// later roster needs to know is how much room it had left.
	let minimum = Number.POSITIVE_INFINITY;
	for (let i = 0; i < labs.length; i++)
		for (let j = i + 1; j < labs.length; j++)
			minimum = Math.min(
				minimum,
				deltaE76(labs[i] ?? [0, 0, 0], labs[j] ?? [0, 0, 0]),
			);
	return { palette, minimum };
}
