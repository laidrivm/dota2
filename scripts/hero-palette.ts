/**
 * The hero palette generator: a colour per mirrored portrait.
 *
 * The board draws a hero's square in `--hero-<short>`, and `<short>` is the
 * slug the ingest writes — the same name `icons.ts` gives the mirrored file,
 * which is why the mirror is what this reads. Run by hand when the roster
 * changes, never in CI and never in the snapshot job; its output is committed,
 * and it writes no file of its own. The portraits are decoded here rather than
 * by a dependency: `node:zlib` inflates the pixel stream, and un-filtering
 * 8-bit RGB and RGBA is the rest.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { relativeLuminance } from "../src/app/board/format.ts";
import { isSlug } from "../src/job/ingest/icons.ts";
import { hsv, type Placed, place } from "./hero-colour.ts";
import { decodePortrait, type Portrait } from "./png.ts";

/** A byte, or 0 outside the array — the pixels below are read in fours. */
const at = (bytes: Uint8Array, i: number) => bytes[i] ?? 0;

const FALLBACK = /--hero-fallback:\s*(#[0-9a-f]{6});/;

const BUCKETS = 24;
/** A pixel too transparent, too dark or too grey to say anything about hue. */
const MIN_ALPHA = 250;
const MIN_VALUE = 0.15;
const MIN_SATURATION = 0.15;

/**
 * The colour a portrait is about: its pixels bucketed by hue and weighted by
 * saturation × value, the heaviest bucket averaged.
 *
 * Weighting by saturation × value rather than by pixel count keeps a large dim
 * background from outvoting the small vivid subject a hero portrait mostly is.
 * The average is of the winning bucket alone, so the answer is a colour that
 * occurs in the portrait rather than a blend of the whole of it.
 */
export function anchorColour(portrait: Portrait): string {
	const weights = new Float64Array(BUCKETS);
	const sums = new Float64Array(BUCKETS * 3);
	const counts = new Uint32Array(BUCKETS);
	const { rgba } = portrait;
	for (let i = 0; i + 3 < rgba.length; i += 4) {
		if (at(rgba, i + 3) < MIN_ALPHA) continue;
		const r = at(rgba, i);
		const g = at(rgba, i + 1);
		const b = at(rgba, i + 2);
		const { hue, saturation, value } = hsv(r, g, b);
		if (value < MIN_VALUE || saturation < MIN_SATURATION) continue;
		// Clamped: a hue a hair under 360 rounds to exactly 360 in a double,
		// which would index one bucket past the end.
		const bucket = Math.min(BUCKETS - 1, Math.floor(hue / (360 / BUCKETS)));
		weights[bucket] = (weights[bucket] ?? 0) + saturation * value;
		sums[bucket * 3] = (sums[bucket * 3] ?? 0) + r;
		sums[bucket * 3 + 1] = (sums[bucket * 3 + 1] ?? 0) + g;
		sums[bucket * 3 + 2] = (sums[bucket * 3 + 2] ?? 0) + b;
		counts[bucket] = (counts[bucket] ?? 0) + 1;
	}

	// Ascending and strictly greater, so two buckets of equal weight resolve to
	// the lower hue rather than to whichever the loop saw last: the palette has
	// to be the same on every run over the same mirror.
	let winner = -1;
	let heaviest = 0;
	for (let bucket = 0; bucket < BUCKETS; bucket++) {
		const weight = weights[bucket] ?? 0;
		if (weight > heaviest) {
			heaviest = weight;
			winner = bucket;
		}
	}
	if (winner < 0)
		throw new Error(
			"every pixel of it is transparent, too dark or too grey to draw a colour from",
		);

	const count = counts[winner] ?? 1;
	const channel = (offset: number) =>
		Math.round((sums[winner * 3 + offset] ?? 0) / count)
			.toString(16)
			.padStart(2, "0");
	return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * The slugs a mirror directory holds, in slug order.
 *
 * Sorted by slug rather than by filename: the two differ wherever one slug is
 * a prefix of another, since `.` sorts after `-` and `_`. Sorted by code unit
 * rather than by a collator, which is locale state the palette must not carry.
 *
 * A directory holding anything else — a half-written download, a second image
 * size — is one this cannot describe, so it stops the run rather than quietly
 * covering the part of it it recognises.
 */
export function readMirror(dir: string): string[] {
	return readdirSync(dir)
		.map((name) => {
			const slug = name.slice(0, -".png".length);
			if (!name.endsWith(".png") || !isSlug(slug))
				throw new Error(
					`${join(dir, name)} is not a mirrored portrait: a file here is named <slug>.png`,
				);
			return slug;
		})
		.sort();
}

/** Each mirrored portrait's own colour, before any of them is moved apart. */
export function anchors(dir: string): Placed[] {
	return readMirror(dir).map((slug) => {
		const file = join(dir, `${slug}.png`);
		try {
			return { slug, colour: anchorColour(decodePortrait(readFileSync(file))) };
		} catch (cause) {
			throw new Error(
				`${file} could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
			);
		}
	});
}

/** A token declaration, as the file already writes them. */
const line = ({ slug, colour }: Placed) => `\t--hero-${slug}: ${colour};`;

const DECLARATION = /^\t--hero-[^:]+:.*$/;

/**
 * `css` with its hero block replaced and every other byte left alone.
 *
 * The fallback's own line is carried through untouched rather than rewritten:
 * its value is not the run's to change, and copying the line keeps whatever
 * comment it carries without this script having to know what that says.
 */
export function render(css: string, palette: Placed[]): string {
	const lines = css.split("\n");
	const block = lines.flatMap((l, i) => (DECLARATION.test(l) ? [i] : []));
	const first = block[0];
	const last = block.at(-1);
	if (first === undefined || last === undefined)
		throw new Error("the token file declares no hero colour to replace");
	if (last - first + 1 !== block.length)
		throw new Error("the token file's hero declarations are not contiguous");

	const fallback = lines
		.slice(first, last + 1)
		.find((l) => l.startsWith("\t--hero-fallback:"));
	if (fallback === undefined)
		throw new Error("the token file declares no --hero-fallback to keep");

	lines.splice(first, block.length, fallback, ...palette.slice(1).map(line));
	return lines.join("\n");
}

if (import.meta.main) {
	const [, , dir, tokens] = process.argv;
	if (dir === undefined || tokens === undefined) {
		console.error(
			"usage: bun scripts/hero-palette.ts <mirror directory> <token file>",
		);
		process.exit(2);
	}
	try {
		const css = readFileSync(tokens, "utf8");
		const read = (name: string) =>
			relativeLuminance(
				new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? "",
			);
		const dark = read("tile-ink-dark");
		const light = read("tile-ink-light");
		const fallback = FALLBACK.exec(css)?.[1];
		if (dark === null || light === null || fallback === undefined)
			throw new Error(
				`${tokens} declares no ink pair and fallback to place against`,
			);

		// Placed before anything is written, so a mirror that cannot be placed
		// leaves the committed palette exactly as it was.
		const { palette, minimum } = place(
			{ slug: "fallback", colour: fallback },
			anchors(dir),
			{ dark, light },
		);
		writeFileSync(tokens, render(css, palette));
		// A palette of one has no pair, and `Math.min` of nothing is infinite:
		// reporting that verbatim would read as a measurement.
		const pair = Number.isFinite(minimum)
			? `${minimum.toFixed(2)} ΔE76 between the closest pair`
			: "no pair to measure";
		console.log(
			`${palette.length} colour${palette.length === 1 ? "" : "s"}, ${pair}`,
		);
	} catch (cause) {
		console.error(cause instanceof Error ? cause.message : String(cause));
		process.exit(1);
	}
}
