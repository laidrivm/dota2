/**
 * What the search does to an anchor: how far it moves one, when it refuses to
 * move at all, and what it leaves alone.
 *
 * The inks are a parameter of every case rather than the shipped pair, and
 * deliberately so. Measured by scanning every colour on a 3-step grid, the
 * worst contrast reachable against pure black and white is 4.5652:1 — above
 * the floor — so with the inks the token file carries today the contrast
 * check can never reject a candidate. It binds only if somebody softens them,
 * which is the case the softened pairs below stand in for.
 */
import { describe, expect, test } from "bun:test";
import {
	contrast,
	deltaE76,
	hex,
	hsv,
	type Inks,
	lab,
	MIN_CONTRAST,
	MIN_DISTANCE,
	place,
} from "./hero-colour.ts";

const PURE: Inks = { dark: 0, light: 1 };
const FALLBACK = { slug: "fallback", colour: "#3a4250" };

/** The closest any two colours in a palette sit, in ΔE76. */
const closest = (colours: string[]) =>
	colours.reduce((least, colour, i) => {
		const here = colours
			.slice(i + 1)
			.map((other) => deltaE76(lab(colour), lab(other)));
		return Math.min(least, ...here);
	}, Number.POSITIVE_INFINITY);

// spec: hero-palette/two-heroes-whose-portraits-share-a-dominant-colour
describe("colours that arrive too close together", () => {
	test("two heroes anchoring on one colour are moved apart", () => {
		const { palette } = place(
			FALLBACK,
			[
				{ slug: "one", colour: "#9f5023" },
				{ slug: "two", colour: "#9f5023" },
			],
			PURE,
		);
		expect(palette[1]?.colour).toBe("#9f5023");
		expect(palette[2]?.colour).not.toBe("#9f5023");
		expect(closest(palette.map((p) => p.colour))).toBeGreaterThanOrEqual(
			MIN_DISTANCE,
		);
	});

	test("a colour already clear of every other is left where it is", () => {
		// The enumeration opens at the anchor itself, so nothing moves that
		// does not have to — which is what keeps a token traceable to its
		// portrait.
		const anchors = [
			{ slug: "one", colour: "#9f5023" },
			{ slug: "two", colour: "#2e7fd0" },
		];
		const { palette } = place(FALLBACK, anchors, PURE);
		expect(palette.slice(1)).toEqual(anchors);
	});

	test("a palette a colour cannot be found for is refused, not written", () => {
		// Measured: 104 anchors on one colour is what the grid holds at 15
		// ΔE76 against pure inks, so 150 of them runs it out. The failure
		// names the hero it gave up on, which is the only way a person
		// running this learns which one.
		const crowd = Array.from({ length: 150 }, (_, i) => ({
			slug: `hero${i}`,
			colour: "#9f5023",
		}));
		expect(() => place(FALLBACK, crowd, PURE)).toThrow(
			/^no colour within reach of hero\d+/,
		);
	});

	test("the minimum reported is the closest pair, the fallback included", () => {
		const { palette, minimum } = place(
			FALLBACK,
			[{ slug: "one", colour: "#3a4250" }],
			PURE,
		);
		expect(minimum).toBeCloseTo(closest(palette.map((p) => p.colour)), 10);
		expect(minimum).toBeGreaterThanOrEqual(MIN_DISTANCE);
	});
});

// spec: hero-palette/a-colour-that-would-not-clear-the-floor
describe("colours that would not be legible on their own square", () => {
	/** Softened, so the floor binds at all — see this file's opening note. */
	const SOFT: Inks = { dark: 0.15, light: 0.75 };

	test("an anchor below the floor is moved until it clears it", () => {
		const anchor = { slug: "one", colour: "#767676" };
		expect(contrast(anchor.colour, SOFT)).toBeLessThan(MIN_CONTRAST);
		const placed = place(FALLBACK, [anchor], SOFT).palette[1];
		expect(placed?.colour).not.toBe(anchor.colour);
		expect(contrast(placed?.colour ?? "", SOFT)).toBeGreaterThanOrEqual(
			MIN_CONTRAST,
		);
	});

	test("a fallback that does not clear the floor stops the run", () => {
		// It is the one colour no run may move, so it cannot be fixed by
		// searching and must not be written either.
		expect(() => place(FALLBACK, [], { dark: 0.9, light: 0.1 })).toThrow(
			"which no run may move",
		);
	});
});

describe("the fallback", () => {
	test("is placed first and never searched", () => {
		const { palette } = place(
			FALLBACK,
			[{ slug: "one", colour: "#3a4250" }],
			PURE,
		);
		expect(palette[0]).toEqual(FALLBACK);
	});
});

describe("the colour spaces the search measures in", () => {
	test.each([
		["#000000"],
		["#ffffff"],
		["#9f5023"],
		["#2e7fd0"],
		["#767676"],
		["#010203"],
	])("%s survives a trip through HSV and back", (colour) => {
		// Every token in the palette is written by `hex` out of coordinates
		// `hsv` produced, so a rounding error in either shifts all of them.
		const { hue, saturation, value } = hsv(
			Number.parseInt(colour.slice(1, 3), 16),
			Number.parseInt(colour.slice(3, 5), 16),
			Number.parseInt(colour.slice(5, 7), 16),
		);
		expect(hex(hue, saturation, value)).toBe(colour);
	});

	test("lightness runs from black at 0 to white at 100", () => {
		// The 15 ΔE76 floor is a distance in this space and nothing else pins
		// its scale, so a wrong white point would silently rescale it.
		expect(lab("#000000")[0]).toBe(0);
		expect(lab("#ffffff")[0]).toBeCloseTo(100, 4);
	});

	test.each([["#000000"], ["#808080"], ["#ffffff"]])(
		"%s sits on the neutral axis",
		(grey) => {
			// Not exactly zero: the sRGB matrix is the rounded four-decimal one,
			// which leaves white at a = 0.005, b = -0.010. That is a
			// fifteen-hundredth of the floor these numbers are compared against,
			// and the same rounding is in `format.ts`'s luminance — one
			// precision across both beats a closer white point in one of them.
			const [, a, b] = lab(grey);
			expect(Math.hypot(a, b)).toBeLessThan(0.05);
		},
	);

	test("a value that is not a colour is refused, not scored", () => {
		expect(() => contrast("no such colour", PURE)).toThrow("is not a colour");
	});
});
