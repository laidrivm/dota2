/**
 * What colour a portrait yields, and what a mirror directory yields — the half
 * of `hero-palette.ts` above the pixels. `hero-palette-decode.test.ts` holds
 * the half below them.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	chunk,
	cleanup,
	FALLBACK_LINE,
	ihdr,
	mirror,
	png,
	portrait,
	run,
	SIGNATURE,
	solid,
	tokenFile,
} from "./hero-palette.fixture.ts";
import { anchorColour, anchors, readMirror } from "./hero-palette.ts";

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

	// The other side of each floor, at the last 8-bit value it admits: the
	// cases above would pass just as well against a floor set one step too
	// high, and these are what say where it actually sits.
	test.each([
		[
			"at the alpha floor",
			[
				[0, 0, 255, 250],
				[0, 0, 255, 250],
				[255, 0, 0, 255],
			],
			"#0000ff",
		],
		[
			"at the darkest value the floor admits",
			[
				[0, 0, 39, 255],
				[0, 0, 39, 255],
				[51, 0, 0, 255],
			],
			"#000027",
		],
		[
			"at exactly the saturation floor",
			[
				[100, 85, 85, 255],
				[43, 51, 43, 255],
			],
			"#645555",
		],
	])("a pixel %s is kept", (_, pixels, expected) => {
		expect(anchorColour(portrait(pixels))).toBe(expected);
	});

	test("a hue on a bucket edge falls in the higher bucket", () => {
		// 15° exactly, against pure red at 0°. Sharing a bucket would average
		// the two; separate buckets let the heavier one win outright.
		const edge = portrait([
			[200, 50, 0, 255],
			[255, 0, 0, 255],
		]);
		expect(anchorColour(edge)).toBe("#ff0000");
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

	test("the same mirror yields the same anchors twice", () => {
		const dir = mirror({
			"axe.png": solid(197, 59, 48),
			"abaddon.png": solid(69, 196, 180),
		});
		expect(anchors(dir)).toEqual([
			{ slug: "abaddon", colour: "#45c4b4" },
			{ slug: "axe", colour: "#c53b30" },
		]);
		expect(anchors(dir)).toEqual(anchors(dir));
	});

	test("a portrait that cannot be read names its own file", () => {
		const dir = mirror({
			"axe.png": solid(197, 59, 48),
			"pudge.png": png({ width: 1, height: 1, depth: 16 }, [[0, 0, 0, 0]]),
		});
		expect(() => anchors(dir)).toThrow("pudge.png");
	});

	test("pixel data that is not a zlib stream names its file too", () => {
		// Otherwise the run reports zlib's own message, which says nothing
		// about which of 127 portraits produced it.
		const broken = Uint8Array.from([
			...SIGNATURE,
			...ihdr({ width: 1, height: 1 }),
			...chunk("IDAT", [1, 2, 3, 4]),
			...chunk("IEND"),
		]);
		const dir = mirror({ "pudge.png": broken });
		expect(() => anchors(dir)).toThrow("pudge.png");
	});

	test("a directory inside the mirror stops the run", () => {
		const dir = mirror({ "axe.png": solid(1, 2, 3) });
		mkdirSync(join(dir, "thumbnails"));
		expect(() => readMirror(dir)).toThrow("thumbnails");
	});

	test("a mirror holding no portrait yields no anchor", () => {
		expect(anchors(mirror({}))).toEqual([]);
	});

	test("a fabricated name cannot write outside the mirror", () => {
		// `cleanup` removes the mirror directory and nothing else, so a case
		// naming a file above it would leave that file on the machine for good.
		expect(() => mirror({ "../escaped.png": solid(1, 2, 3) })).toThrow(
			"outside the mirror",
		);
	});
});

// spec: hero-palette/a-portrait-the-decoder-cannot-read
// spec: hero-palette/a-mirror-holding-every-hero-the-palette-knows
// spec: hero-palette/a-hero-the-mirror-has-no-portrait-for
describe("the generator as a person runs it", () => {
	test("a readable mirror is written into the token file", () => {
		const dir = mirror({ "axe.png": solid(197, 59, 48) });
		const tokens = tokenFile();
		const call = run(dir, tokens);
		expect(call.status).toBe(0);
		expect(call.out).toMatch(/2 colours, [0-9.]+ ΔE76/);
		expect(readFileSync(tokens, "utf8")).toContain("\t--hero-axe: ");
	});

	test("the fallback is carried through whatever the mirror holds", () => {
		const tokens = tokenFile();
		const before = readFileSync(tokens, "utf8");
		expect(run(mirror({}), tokens).status).toBe(0);
		const after = readFileSync(tokens, "utf8");
		expect(after).toContain(FALLBACK_LINE);
		// The one hero the mirror did not hold is gone, and nothing else moved.
		expect(after).not.toContain("--hero-axe:");
		expect(before.split("\n").length - after.split("\n").length).toBe(1);
	});

	test("one unreadable portrait leaves the committed palette alone", () => {
		// The other two decode. A run that wrote what it had before reaching
		// the third would leave two thirds of a palette in a tracked file.
		const dir = mirror({
			"abaddon.png": solid(69, 196, 180),
			"axe.png": solid(197, 59, 48),
			"pudge.png": png({ width: 1, height: 1, depth: 16 }, [[0, 0, 0, 0]]),
		});
		const tokens = tokenFile();
		const before = readFileSync(tokens, "utf8");
		const call = run(dir, tokens);
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("pudge.png");
		expect(readFileSync(tokens, "utf8")).toBe(before);
	});

	test("no token file to write is refused before anything is read", () => {
		const call = run(mirror({}));
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("usage:");
	});
});
