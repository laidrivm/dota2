/**
 * What `png.ts` reads, and what it refuses.
 *
 * Apart from `hero-palette.test.ts`, which asks what colour a portrait yields
 * once it is decoded. The seam is where the pixels are: everything here is
 * bytes on the wire.
 */
import { describe, expect, test } from "bun:test";
import { chunk, ihdr, png, SIGNATURE } from "./hero-palette.fixture.ts";
import { decodePortrait } from "./png.ts";

/**
 * A 2×2 image and its five encodings, the filtered bytes worked out by hand
 * rather than produced by an encoder: a fixture the code under test could have
 * generated would agree with a decoder that got the arithmetic wrong.
 */
const PIXELS = [
	10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
];
const FILTERED: [string, number[][]][] = [
	[
		"none",
		[
			[0, 10, 20, 30, 255, 40, 50, 60, 255],
			[0, 70, 80, 90, 255, 100, 110, 120, 255],
		],
	],
	[
		"sub",
		[
			[1, 10, 20, 30, 255, 30, 30, 30, 0],
			[1, 70, 80, 90, 255, 30, 30, 30, 0],
		],
	],
	[
		"up",
		[
			[2, 10, 20, 30, 255, 40, 50, 60, 255],
			[2, 60, 60, 60, 0, 60, 60, 60, 0],
		],
	],
	[
		"average",
		[
			[3, 10, 20, 30, 255, 35, 40, 45, 128],
			[3, 65, 70, 75, 128, 45, 45, 45, 0],
		],
	],
	[
		"paeth",
		[
			[4, 10, 20, 30, 255, 30, 30, 30, 0],
			[4, 60, 60, 60, 0, 30, 30, 30, 0],
		],
	],
];

describe("what the decoder reads", () => {
	test.each(FILTERED)(
		"the %s filter un-filters to the same pixels",
		(_, rows) => {
			const portrait = decodePortrait(png({ width: 2, height: 2 }, rows));
			expect([...portrait.rgba]).toEqual(PIXELS);
		},
	);

	test("a three-channel file gets an opaque alpha", () => {
		const portrait = decodePortrait(
			png({ width: 2, height: 1, colour: 2 }, [[0, 10, 20, 30, 40, 50, 60]]),
		);
		expect([...portrait.rgba]).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
	});

	test("the size comes from the header, not from one the mirror happens to hold", () => {
		const rows = [[0, 1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255]];
		const portrait = decodePortrait(png({ width: 3, height: 1 }, rows));
		expect(portrait).toMatchObject({ width: 3, height: 1 });
		expect(portrait.rgba).toHaveLength(12);
	});

	test("the pixel data may be split across several IDAT chunks", () => {
		const whole = png({ width: 1, height: 1 }, [[0, 9, 8, 7, 255]]);
		// The one IDAT this builds, cut in two and re-framed: a decoder joining
		// the parts and one reading only the first differ here and nowhere else.
		const body = [...whole.subarray(41, whole.length - 12)];
		const split = Uint8Array.from([
			...whole.subarray(0, 33),
			...chunk("IDAT", body.slice(0, 2)),
			...chunk("IDAT", body.slice(2)),
			...chunk("IEND"),
		]);
		expect([...decodePortrait(split).rgba]).toEqual([9, 8, 7, 255]);
	});
});

// spec: hero-palette/a-portrait-the-decoder-cannot-read
describe("what the decoder refuses, by saying which shape arrived", () => {
	test.each([
		[
			"a 16-bit file",
			() =>
				png({ width: 1, height: 1, depth: 16 }, [[0, 0, 0, 0, 0, 0, 0, 0, 0]]),
			"bit depth is 16",
		],
		[
			"a palette file",
			() => png({ width: 1, height: 1, colour: 3 }, [[0, 0]]),
			"colour type is 3",
		],
		[
			"a greyscale file",
			() => png({ width: 1, height: 1, colour: 0 }, [[0, 0]]),
			"colour type is 0",
		],
		[
			"a greyscale file carrying alpha",
			() => png({ width: 1, height: 1, colour: 4 }, [[0, 0, 0]]),
			"colour type is 4",
		],
		[
			"an interlaced file",
			() => png({ width: 1, height: 1, interlace: 1 }, [[0, 1, 2, 3, 255]]),
			"interlaced",
		],
		[
			"a compression method PNG does not define",
			() => png({ width: 1, height: 1, compression: 1 }, [[0, 1, 2, 3, 255]]),
			"compression method is 1",
		],
		[
			"a filter method PNG does not define",
			() => png({ width: 1, height: 1, filterMethod: 1 }, [[0, 1, 2, 3, 255]]),
			"filter method is 1",
		],
		[
			"a file measuring nothing",
			() => png({ width: 0, height: 1 }, [[0]]),
			"measures 0×1",
		],
		[
			"a file that is not a PNG",
			() => new TextEncoder().encode("<html>this is not a portrait</html>"),
			"PNG signature",
		],
		[
			"a row filter PNG does not define",
			() => png({ width: 1, height: 1 }, [[5, 1, 2, 3, 255]]),
			"row filter 5",
		],
		[
			"pixel data shorter than the header promises",
			() => png({ width: 4, height: 4 }, [[0, 1, 2, 3, 255]]),
			"5 bytes where IHDR names 68",
		],
		[
			"pixel data longer than the header promises",
			() =>
				png({ width: 1, height: 1 }, [
					[0, 1, 2, 3, 255],
					[0, 9, 9, 9, 255],
				]),
			"10 bytes where IHDR names 5",
		],
		[
			"a file with no header at all",
			() => Uint8Array.from([...SIGNATURE, ...chunk("IEND")]),
			"no IHDR",
		],
		[
			"a file with a header and no pixels",
			() =>
				Uint8Array.from([
					...SIGNATURE,
					...png({ width: 1, height: 1 }, [[0, 1, 2, 3, 255]]).subarray(8, 33),
					...chunk("IEND"),
				]),
			"no IDAT",
		],
		[
			"a file carrying transparency this decoder does not apply",
			() =>
				Uint8Array.from([
					...SIGNATURE,
					...ihdr({ width: 1, height: 1, colour: 2 }),
					...chunk("tRNS", [0, 1, 0, 2, 0, 3]),
					...chunk("IDAT", [0]),
					...chunk("IEND"),
				]),
			"tRNS",
		],
		[
			"a chunk claiming more bytes than the file holds",
			() =>
				Uint8Array.from([...SIGNATURE, 0, 0, 0, 99, ...chunk("IHDR").slice(4)]),
			"past the end",
		],
	])("%s", (_, build, reason) => {
		expect(() => decodePortrait(build())).toThrow(reason);
	});
});
