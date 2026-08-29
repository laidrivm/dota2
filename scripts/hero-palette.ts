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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { isSlug } from "../src/job/ingest/icons.ts";

/** The eight bytes every PNG opens with. */
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** A decoded portrait, always four channels whatever the file carried. */
export type Portrait = { width: number; height: number; rgba: Uint8Array };

/**
 * A byte, or 0 outside the array — not a short-read guard, the callers below
 * having checked their lengths, but the filter definition: the byte above the
 * first row and the byte left of the first pixel are zero.
 */
const at = (bytes: Uint8Array, i: number) => (i < 0 ? 0 : (bytes[i] ?? 0));

/** How many bytes a pixel occupies, per colour type this reads. */
const CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

type Header = { width: number; height: number; channels: number };

/**
 * What IHDR says, refusing every shape this decoder does not implement by
 * saying which one arrived. A mirrored portrait is a non-interlaced 8-bit PNG
 * of colour type 2 or 6 — measured over the mirror rather than assumed — and
 * anything else stops the run instead of being guessed at.
 */
function readHeader(body: Uint8Array): Header {
	if (body.length !== 13) throw new Error("its IHDR is not 13 bytes long");
	const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
	const width = view.getUint32(0);
	const height = view.getUint32(4);
	const depth = view.getUint8(8);
	const colour = view.getUint8(9);
	if (width === 0 || height === 0)
		throw new Error(`it measures ${width}×${height}`);
	if (depth !== 8)
		throw new Error(`its bit depth is ${depth}, and only 8 is read`);
	const channels = CHANNELS[colour];
	if (channels === undefined)
		throw new Error(
			`its colour type is ${colour}, and only 2 (RGB) and 6 (RGBA) are read`,
		);
	// All seven header fields are ruled on: compression and filter method have
	// one defined value each, and a file naming another is refused by name
	// rather than reached as a zlib error or an unknown row filter.
	for (const [offset, what] of [
		[10, "compression"],
		[11, "filter"],
	] as const) {
		const method = view.getUint8(offset);
		if (method !== 0)
			throw new Error(`its ${what} method is ${method}, and only 0 is read`);
	}
	if (view.getUint8(12) !== 0) throw new Error("it is interlaced");
	return { width, height, channels };
}

/** What a filtered byte is added to, by the filter its row declares. */
function predictor(filter: number, a: number, b: number, c: number): number {
	switch (filter) {
		case 0:
			return 0;
		case 1:
			return a;
		case 2:
			return b;
		case 3:
			return (a + b) >> 1;
		case 4: {
			// Paeth: whichever neighbour the linear estimate lands nearest.
			const p = a + b - c;
			const pa = Math.abs(p - a);
			const pb = Math.abs(p - b);
			const pc = Math.abs(p - c);
			return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
		}
		default:
			throw new Error(
				`its row filter ${filter} is not one of the five PNG defines`,
			);
	}
}

/** The inflated stream, one filter byte per row, un-filtered into raw pixels. */
function unfilter(raw: Uint8Array, header: Header): Uint8Array {
	const { width, height, channels } = header;
	const stride = width * channels;
	const want = height * (stride + 1);
	if (raw.length !== want)
		throw new Error(
			`its pixel data is ${raw.length} bytes where IHDR names ${want}`,
		);
	const out = new Uint8Array(height * stride);
	for (let y = 0; y < height; y++) {
		const row = y * (stride + 1);
		const filter = at(raw, row);
		const line = y * stride;
		const above = line - stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= channels ? at(out, line + x - channels) : 0;
			const b = y > 0 ? at(out, above + x) : 0;
			const c = x >= channels && y > 0 ? at(out, above + x - channels) : 0;
			out[line + x] =
				(at(raw, row + 1 + x) + predictor(filter, a, b, c)) & 0xff;
		}
	}
	return out;
}

/**
 * A portrait's pixels, as RGBA whatever the file's colour type.
 *
 * Chunk CRCs are not checked: these files came off this project's own mirror,
 * and corruption a CRC would catch is corruption `inflateSync` fails on.
 */
export function decodePortrait(bytes: Uint8Array): Portrait {
	if (bytes.length < 8 || SIGNATURE.some((byte, i) => at(bytes, i) !== byte))
		throw new Error("it does not open with a PNG signature");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let header: Header | undefined;
	const parts: Uint8Array[] = [];
	// 8 signature bytes, then chunks of length, type, body and CRC.
	for (let cursor = 8; cursor + 8 <= bytes.length; ) {
		const length = view.getUint32(cursor);
		if (cursor + 12 + length > bytes.length)
			throw new Error("a chunk in it runs past the end of the file");
		const type = String.fromCharCode(...bytes.subarray(cursor + 4, cursor + 8));
		const body = bytes.subarray(cursor + 8, cursor + 8 + length);
		if (type === "IHDR") header = readHeader(body);
		else if (type === "IDAT") parts.push(body);
		else if (type === "IEND") break;
		cursor += 12 + length;
	}
	if (header === undefined) throw new Error("it carries no IHDR chunk");
	if (parts.length === 0) throw new Error("it carries no IDAT chunk");

	const raw = unfilter(
		new Uint8Array(inflateSync(Buffer.concat(parts))),
		header,
	);
	const { width, height, channels } = header;
	const rgba = new Uint8Array(width * height * 4);
	for (let pixel = 0; pixel < width * height; pixel++) {
		const from = pixel * channels;
		const to = pixel * 4;
		rgba[to] = at(raw, from);
		rgba[to + 1] = at(raw, from + 1);
		rgba[to + 2] = at(raw, from + 2);
		rgba[to + 3] = channels === 4 ? at(raw, from + 3) : 255;
	}
	return { width, height, rgba };
}

/** Hue in [0, 360), saturation and value in [0, 1], from 8-bit channels. */
function hsv(r: number, g: number, b: number) {
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

/** The palette a mirror yields: one `--hero-<slug>` line per portrait. */
export function palette(dir: string): string[] {
	return readMirror(dir).map((slug) => {
		const file = join(dir, `${slug}.png`);
		try {
			return `\t--hero-${slug}: ${anchorColour(decodePortrait(readFileSync(file)))};`;
		} catch (cause) {
			throw new Error(
				`${file} could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
			);
		}
	});
}

if (import.meta.main) {
	const dir = process.argv[2];
	if (dir === undefined) {
		console.error("usage: bun scripts/hero-palette.ts <mirror directory>");
		process.exit(2);
	}
	try {
		// Built whole before printing, so a mirror this cannot read leaves no
		// half a palette to paste; an empty one prints nothing at all.
		const lines = palette(dir);
		if (lines.length > 0) console.log(lines.join("\n"));
	} catch (cause) {
		console.error(cause instanceof Error ? cause.message : String(cause));
		process.exit(1);
	}
}
