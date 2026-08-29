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
import { dirname, join } from "node:path";
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
	compression?: number;
	filterMethod?: number;
	interlace?: number;
};

/** An IHDR body: 8-bit RGBA unless a case says otherwise. */
export function ihdr({
	width,
	height,
	depth = 8,
	colour = 6,
	compression = 0,
	filterMethod = 0,
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
		compression,
		filterMethod,
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

/**
 * A throwaway mirror directory holding the named files.
 *
 * The names a case may ask for are deliberately not slugs — a capital, a
 * `.part`, a wrong extension are what the refusals are tested with — so the
 * one thing checked is that the file lands under `dir`. `cleanup()` removes
 * `dir` alone, and a name climbing out of it would leave a file behind that
 * nothing here would ever remove.
 */
export function mirror(files: Record<string, Uint8Array>): string {
	const dir = mkdtempSync(join(tmpdir(), "hero-palette-"));
	made.push(dir);
	for (const [name, bytes] of Object.entries(files)) {
		const file = join(dir, name);
		if (dirname(file) !== dir)
			throw new Error(`${name} would land outside the mirror, at ${file}`);
		writeFileSync(file, bytes);
	}
	return dir;
}

/** A one-pixel RGBA portrait, as a file the mirror can hold. */
export const solid = (r: number, g: number, b: number): Uint8Array =>
	png({ width: 1, height: 1 }, [[0, r, g, b, 255]]);

/**
 * The generator run as a person runs it. Spawned rather than called, because
 * what the exit code and the two streams carry is the whole of what a person
 * gets, and none of it is observable from inside the module.
 */
export function run(...args: string[]) {
	const call = Bun.spawnSync(
		["bun", `${import.meta.dir}/hero-palette.ts`, ...args],
		// Started outside the repository and given the one variable the case
		// needs — `PATH`, to resolve `bun` — rather than inheriting the launch
		// environment: bun fills a variable a case left out from the `.env`
		// where the process starts, so an inherited cwd decides what the run
		// reads.
		{ cwd: tmpdir(), env: { PATH: process.env.PATH ?? "" } },
	);
	return {
		status: call.exitCode,
		out: call.stdout.toString(),
		err: call.stderr.toString(),
	};
}
