/**
 * The contest formula: a hero's picks and bans over the window's matches,
 * where the matches are the summed pick counts divided by ten.
 *
 * The ban pull the second half of `contest.ts` holds is `bans.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { heroTotals } from "./contest.ts";
import type { PositionCount } from "./meta.ts";

/** One hero's row at one position, as the meta pull returns it. */
const picked = (
	heroId: number,
	position: number,
	matches: number,
	wins = 0,
): PositionCount => ({ heroId, position, matches, wins });

/** The contest rate `heroTotals` gives `heroId`, over `rows` and `bans`. */
const rateOf = (
	heroId: number,
	rows: PositionCount[],
	bans: Map<number, number> = new Map(),
) =>
	heroTotals(rows, bans).find((total) => total.heroId === heroId)?.contestRate;

describe("the position rows a hero's total is made of", () => {
	// spec: snapshot-ingest/a-hero-picked-in-every-match
	test("a hero's five positions sum into one row [32]", () => {
		const rows = Array.from({ length: 5 }, (_, n) =>
			picked(9001, n + 1, 10 * (n + 1), n + 1),
		);

		expect(heroTotals(rows, new Map())).toEqual([
			{ heroId: 9001, matches: 150, wins: 15, contestRate: 10 },
		]);
	});

	test("positions summing past what the column holds fail", () => {
		// Each position fits `int` and five of them need not, which is the
		// total the staging insert would refuse under a column's name.
		const rows = [
			picked(9001, 1, 2_000_000_000),
			picked(9001, 2, 2_000_000_000),
		];

		expect(() => heroTotals(rows, new Map())).toThrow(
			"past what the column holds",
		);
	});
});

describe("the rate a hero's picks and bans come to", () => {
	// spec: snapshot-ingest/a-hero-picked-in-every-match
	test("a hero picked in every match of the window rates 1 [32]", () => {
		// The counts sum to 100, so the window held 10 matches, and a hero with
		// 10 of them was in every one.
		const rows = [picked(9001, 1, 10), picked(9002, 1, 90)];

		expect(rateOf(9001, rows)).toBe(1);
	});

	// spec: snapshot-ingest/bans-count-towards-contest
	test("equal picks are ranked by bans [33]", () => {
		const rows = [picked(9001, 1, 50), picked(9002, 1, 50)];
		const bans = new Map([[9001, 5]]);

		expect(rateOf(9001, rows, bans)).toBe(5.5);
		expect(rateOf(9002, rows, bans)).toBe(5);
	});

	// spec: snapshot-ingest/a-hero-picked-in-every-match
	test("the divisor stays fractional where the sum is not a multiple of ten [34]", () => {
		// 105 picks is 10.5 matches. Rounding the divisor either way names a
		// different ratio from the one the requirement fixes.
		const rows = [picked(9001, 1, 5), picked(9002, 1, 50), picked(9003, 1, 50)];

		expect(rateOf(9001, rows)).toBeCloseTo(5 / 10.5, 12);
		expect(rateOf(9001, rows)).not.toBe(5 / 10);
		expect(rateOf(9001, rows)).not.toBe(5 / 11);
	});

	// spec: snapshot-ingest/a-hero-and-day-absent-from-the-ban-response
	test("a hero the ban response never named rates on its picks alone [75]", () => {
		const rows = [picked(9001, 1, 50), picked(9002, 1, 50)];

		// Absent is nil bans, not a missing rate: the map carries only heroes
		// with rows, and 169 pairs of 3810 were missing when this was measured.
		expect(rateOf(9002, rows, new Map([[9001, 5]]))).toBe(5);
	});

	// spec: snapshot-ingest/a-window-with-no-matches
	test("a window whose matches are 0 rates every hero 0 [35]", () => {
		const rows = [picked(9001, 1, 0), picked(9002, 1, 0)];

		const totals = heroTotals(rows, new Map([[9001, 3]]));

		// Zero rather than the `NaN` a 0/0 would give, and rather than the
		// `Infinity` a hero with bans and no picks would: no division happens.
		for (const total of totals) expect(total.contestRate).toBe(0);
	});

	test("no hero at all yields no row and no division", () => {
		expect(heroTotals([], new Map())).toEqual([]);
	});
});
