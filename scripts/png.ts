/**
 * Just enough PNG to read a mirrored hero portrait: the shapes the mirror
 * actually holds, and a named refusal for every other.
 *
 * Its own module because `hero-palette.ts` is at its cap and because nothing
 * here is about heroes — it reads bytes and answers pixels.
 *
 * Decoded in the repository rather than by a dependency: `node:zlib` inflates
 * the pixel stream, and un-filtering 8-bit RGB and RGBA is the rest of it.
 */
import { inflateSync } from "node:zlib";

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
