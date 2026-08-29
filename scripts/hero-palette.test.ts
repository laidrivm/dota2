/**
 * What colour a portrait yields, and what a mirror directory yields — the half
 * of `hero-palette.ts` above the pixels. `hero-palette-decode.test.ts` holds
 * the half below them.
 */
import { afterAll, describe, expect, test } from "bun:test";
import {
	cleanup,
	mirror,
	png,
	portrait,
	solid,
} from "./hero-palette.fixture.ts";
import { anchorColour, palette, readMirror } from "./hero-palette.ts";

afterAll(cleanup);

describe("the colour a portrait is about", () => {
	test("one saturated colour is its own anchor", () => {
		expect(anchorColour(portrait([[255, 0, 0, 255]]))).toBe("#ff0000");
	});

	test("the winning bucket is averaged, not sampled", () => {
		// Both sit in the first hue bucket, and the answer is neither of them.
		const two = portrait([
			[255, 0, 0, 255],
			[255, 30, 0, 255],
		]);
		expect(anchorColour(two)).toBe("#ff0f00");
	});

	test("weight decides the bucket, not how many pixels are in it", () => {
		// Three dull greens against one vivid red: by count the greens win.
		const mixed = portrait([
			[41, 51, 41, 255],
			[41, 51, 41, 255],
			[41, 51, 41, 255],
			[255, 0, 0, 255],
		]);
		expect(anchorColour(mixed)).toBe("#ff0000");
	});

	test("two buckets of equal weight resolve to the lower hue", () => {
		// Pure red and pure cyan weigh exactly the same, so which one comes back
		// is the order alone — and the order is what makes a run repeatable.
		const tied = portrait([
			[255, 0, 0, 255],
			[0, 255, 255, 255],
		]);
		expect(anchorColour(tied)).toBe("#ff0000");
	});
});

describe("the pixels a portrait's colour is not drawn from", () => {
	// Each case weighs its ignored pixels heavier than the one kept, so a floor
	// that stopped being applied would change the answer rather than survive it.
	test.each([
		[
			"near-transparent",
			[
				[0, 0, 255, 249],
				[0, 0, 255, 249],
				[255, 0, 0, 255],
			],
			"#ff0000",
		],
		[
			"too dark to have a hue",
			[
				[0, 0, 38, 255],
				[0, 0, 38, 255],
				[51, 0, 0, 255],
			],
			"#330000",
		],
		[
			"too grey to have a hue",
			[
				[180, 200, 180, 255],
				[51, 43, 43, 255],
			],
			"#332b2b",
		],
	])("a %s pixel is ignored", (_, pixels, expected) => {
		expect(anchorColour(portrait(pixels))).toBe(expected);
	});

	// spec: hero-palette/a-portrait-the-decoder-cannot-read
	test("a portrait with no pixel left is an error, not a default colour", () => {
		const nothing = portrait([
			[0, 0, 0, 255],
			[128, 128, 128, 255],
			[255, 0, 0, 100],
		]);
		expect(() => anchorColour(nothing)).toThrow("too dark or too grey");
	});
});

// spec: hero-palette/the-same-mirror-twice
describe("the mirror a palette is read from", () => {
	test("the order is the slug's, not the filename's", () => {
		// `-` sorts before `.`, so sorting the names would put the longer slug
		// first — the one place the two orders disagree.
		const dir = mirror({
			"abaddon-x.png": solid(1, 2, 3),
			"abaddon.png": solid(4, 5, 6),
			"axe.png": solid(7, 8, 9),
		});
		expect(readMirror(dir)).toEqual(["abaddon", "abaddon-x", "axe"]);
	});

	test.each([
		["a capital in the name", "Pudge.png"],
		["an extension the mirror does not write", "pudge.jpg"],
		["a download still in flight", ".pudge.png.part"],
		["a name with no extension at all", "pudge"],
	])("%s stops the run", (_, name) => {
		const dir = mirror({ [name]: solid(1, 2, 3) });
		expect(() => readMirror(dir)).toThrow(name);
	});

	test("the same mirror yields the same palette twice", () => {
		const dir = mirror({
			"axe.png": solid(197, 59, 48),
			"abaddon.png": solid(69, 196, 180),
		});
		expect(palette(dir)).toEqual([
			"\t--hero-abaddon: #45c4b4;",
			"\t--hero-axe: #c53b30;",
		]);
		expect(palette(dir)).toEqual(palette(dir));
	});

	test("a portrait that cannot be read names its own file", () => {
		const dir = mirror({
			"axe.png": solid(197, 59, 48),
			"pudge.png": png({ width: 1, height: 1, depth: 16 }, [[0, 0, 0, 0]]),
		});
		expect(() => palette(dir)).toThrow("pudge.png");
	});
});
