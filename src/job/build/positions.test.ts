/**
 * A hero's positions: the share of its own picks each one took, and the two
 * sample thresholds that decide whether it may be suggested at all.
 */
import { describe, expect, test } from "bun:test";
import { heroSufficient, pickShares, positionSufficient } from "./positions.ts";

describe("the share of a hero's picks each position took", () => {
	test("a hero picked on one position gets that position alone [3]", () => {
		expect(pickShares([{ position: 3, matches: 940 }])).toEqual(
			new Map([[3, 1]]),
		);
	});

	// spec: snapshot-build/shares-over-the-positions-played
	test("a hero picked on three gets three rows and no others [4]", () => {
		const shares = pickShares([
			{ position: 1, matches: 500 },
			{ position: 2, matches: 0 },
			{ position: 3, matches: 300 },
			{ position: 4, matches: 0 },
			{ position: 5, matches: 200 },
		]);

		expect(shares).toEqual(
			new Map([
				[1, 0.5],
				[3, 0.3],
				[5, 0.2],
			]),
		);
	});

	test("shares over an inexact division still sum to 1 [65]", () => {
		// Every other case here divides exactly. The criterion is written to a
		// 1e-6 tolerance because this one cannot be.
		const shares = pickShares([
			{ position: 1, matches: 1 },
			{ position: 2, matches: 1 },
			{ position: 3, matches: 1 },
		]);

		expect(shares.size).toBe(3);
		expect(
			[...shares.values()].reduce((sum, share) => sum + share, 0),
		).toBeCloseTo(1, 6);
	});

	test("a hero whose picks total zero yields no rows and no division [53]", () => {
		expect(
			pickShares([
				{ position: 1, matches: 0 },
				{ position: 4, matches: 0 },
			]),
		).toEqual(new Map());
	});
});

describe("the sample a suggestion needs behind it", () => {
	// spec: snapshot-build/at-the-position-threshold
	// snapshot-build/below-the-position-threshold
	test.each([
		[500, true],
		[499, false],
	])("a hero-position at n_eff %i is sufficient: %s [10]", (nEff, expected) => {
		expect(positionSufficient(nEff)).toBe(expected);
	});

	// spec: snapshot-build/at-the-hero-threshold
	test("a hero whose positions sum to 1000 is sufficient [11]", () => {
		expect(heroSufficient([400, 400, 200])).toBe(true);
	});

	test("a hero whose positions sum to 999 is not [11]", () => {
		expect(heroSufficient([400, 400, 199])).toBe(false);
	});

	test("a hero the window never picked has no positions to sum [66]", () => {
		// The reference holds every hero, so this one still gets a `hero_stats`
		// row and still has to answer.
		expect(heroSufficient([])).toBe(false);
	});
});
