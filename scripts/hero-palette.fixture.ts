/**
 * What the palette generator's tests build their inputs from: PNGs assembled
 * byte by byte, and a throwaway mirror directory to put them in.
 *
 * Assembled here rather than committed as binary fixtures, so a case that
 * needs a shape the mirror does not hold — 16-bit, interlaced, a row filter
 * that does not exist — is a line rather than a file somebody has to produce
 * with another tool and nobody can read in a diff.
 *
 * Its own module because the cases split across two test files. `afterAll` is
 * not registered here: a lifecycle hook belongs to the file it runs for, so
 * each test file registers `cleanup` itself.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import type { Portrait } from "./hero-palette.ts";

export const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * One PNG chunk: length, type, body, CRC.
 *
 * The CRC is left zero. The decoder does not check one — these files come off
 * this project's own mirror — so a fixture that computed one would be
 * asserting nothing and would need a CRC table to do it.
 */
export function chunk(type: string, body: number[] = []): number[] {
	const length = [
		(body.length >>> 24) & 0xff,
		(body.length >>> 16) & 0xff,
		(body.length >>> 8) & 0xff,
		body.length & 0xff,
	];
	const name = [...type].map((c) => c.charCodeAt(0));
	return [...length, ...name, ...body, 0, 0, 0, 0];
}

export type HeaderFields = {
	width: number;
	height: number;
	depth?: number;
	colour?: number;
	interlace?: number;
};

/** An IHDR body: 8-bit RGBA unless a case says otherwise. */
export function ihdr({
	width,
	height,
	depth = 8,
	colour = 6,
	interlace = 0,
}: HeaderFields): number[] {
	return chunk("IHDR", [
		(width >>> 24) & 0xff,
		(width >>> 16) & 0xff,
		(width >>> 8) & 0xff,
		width & 0xff,
		(height >>> 24) & 0xff,
		(height >>> 16) & 0xff,
		(height >>> 8) & 0xff,
		height & 0xff,
		depth,
		colour,
		0,
		0,
		interlace,
	]);
}

/**
 * A whole PNG: signature, IHDR, one IDAT holding the filtered scanlines, IEND.
 *
 * `rows` are the scanlines as they go on the wire — each opening with its
 * filter byte — so a case states the encoding it is testing rather than
 * asking this to perform one.
 */
export function png(header: HeaderFields, rows: number[][]): Uint8Array {
	const idat = [...deflateSync(Buffer.from(rows.flat()))];
	return Uint8Array.from([
		...SIGNATURE,
		...ihdr(header),
		...chunk("IDAT", idat),
		...chunk("IEND"),
	]);
}

/** A decoded portrait built straight from pixels, one row of them. */
export const portrait = (pixels: number[][]): Portrait => ({
	width: pixels.length,
	height: 1,
	rgba: Uint8Array.from(pixels.flat()),
});

const made: string[] = [];

/** Removes every mirror fabricated so far. */
export function cleanup(): void {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
	made.length = 0;
}

/** A throwaway mirror directory holding the named files. */
export function mirror(files: Record<string, Uint8Array>): string {
	const dir = mkdtempSync(join(tmpdir(), "hero-palette-"));
	made.push(dir);
	for (const [name, bytes] of Object.entries(files))
		writeFileSync(join(dir, name), bytes);
	return dir;
}

/** A one-pixel RGBA portrait, as a file the mirror can hold. */
export const solid = (r: number, g: number, b: number): Uint8Array =>
	png({ width: 1, height: 1 }, [[0, r, g, b, 255]]);
