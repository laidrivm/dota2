/**
 * A pair response the reference does not admit. The criterion fixes *one* row
 * per other hero, not at least one, so a short matrix, a surplus row and a
 * hero the reference does not hold all end the run on the same terms.
 */
import { describe, expect, test } from "bun:test";
import { asking, failure, HEROES, row, WEEKS, whole } from "./pairs.fixture.ts";
import { pullPairs } from "./pairs.ts";
import type { Query } from "./stratz.ts";

describe("a response the reference does not admit", () => {
	/** What `pullPairs` failed with when `vs` is `rows`. */
	const refusing = (rows: unknown) =>
		failure(pullPairs(asking(() => ({ vs: rows })).query, HEROES, WEEKS));

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test("a matrix short of one row per other hero fails [30]", async () => {
		// Written as though it were whole, a partial matrix is a winrate
		// computed against the heroes that happened to answer.
		expect(await refusing([row(9002, 10, 4)])).toContain("1 of 2");
	});

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test.each([
		["a surplus row", [...whole(9001), row(9002, 1, 0)]],
		["a duplicated hero", [row(9002, 10, 4), row(9002, 10, 4)]],
		["a hero the reference does not hold", [row(9002, 10, 4), row(9404, 1, 0)]],
		["the hero itself", [row(9002, 10, 4), row(9001, 1, 0)]],
		["an id that is not one", [row(9002, 10, 4), row(Number.NaN, 1, 0)]],
		["nothing at all", [row(9002, 10, 4), null]],
	])("a matrix carrying %s fails on the same terms [82]", async (_, rows) => {
		// The criterion fixes *one* row per other hero, not at least one, so
		// each of these is refused rather than counted or ignored.
		expect(await refusing(rows)).toContain("does not admit once");
	});

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test.each([
		["more wins than matches", [row(9002, 4, 10), row(9003, 10, 4)]],
		["a fractional count", [row(9002, 10.5, 4), row(9003, 10, 4)]],
		["a negative count", [row(9002, -1, 0), row(9003, 10, 4)]],
		[
			"a count past what the column holds",
			[row(9002, 2_147_483_648, 0), row(9003, 10, 4)],
		],
	])("a row with %s fails rather than being summed [82]", async (_, rows) => {
		// Read on the week, because the sum over four of them is what the
		// staging table's own constraint sees.
		expect(await refusing(rows)).toContain("counts a week cannot have");
	});

	test("a matrix that is absent fails naming which", async () => {
		expect(await refusing(undefined)).toContain("no opponent rows");
	});

	test.each([
		["none", []],
		[
			"two",
			[
				{ vs: [], with: [] },
				{ vs: [], with: [] },
			],
		],
	])("a list carrying %s pairs fails naming how many", async (_, matchUp) => {
		// One hero was asked for, so a second entry is data the request did not
		// ask for; reading the first of two would discard it silently.
		const query: Query = async () => ({ data: { heroStats: { matchUp } } });

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"pairs for hero 9001",
		);
	});

	test("a pair that is not an object fails naming the hero", async () => {
		const query: Query = async () => ({
			data: { heroStats: { matchUp: [7] } },
		});

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"nothing for hero 9001",
		);
	});

	test("weeks summing past what the column holds fail", async () => {
		// Each week fits `int` and their sum does not, which is the total the
		// staging insert would refuse under a column's name rather than a
		// source's.
		const { query } = asking(() => ({ vs: whole(9001, 2_000_000_000, 0) }));

		expect(
			await failure(pullPairs(query, HEROES, [...WEEKS, ...WEEKS])),
		).toContain("sum past what the column holds");
	});

	test("a hero id that is not one is never asked for", async () => {
		const { query, asked } = asking(() => ({}));

		expect(await failure(pullPairs(query, [Number.NaN], WEEKS))).toContain(
			"no request can be built",
		);
		// The quota is not spent on a document naming `heroId: NaN`.
		expect(asked).toEqual([]);
	});

	test("a week that is not one is never asked for", async () => {
		const { query, asked } = asking(() => ({}));

		expect(
			await failure(pullPairs(query, HEROES, [new Date("not a date")])),
		).toContain("no request can be built");
		expect(asked).toEqual([]);
	});

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test("an ally matrix is refused as an opponent matrix is [82]", async () => {
		// Every case above drives `vs`; without this one the ally call could be
		// validating the opponent rows twice.
		const { query } = asking((heroId) => ({ with: [row(heroId + 400, 1, 0)] }));

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"the ally rows for hero 9001 carry one the reference does not admit once",
		);
	});

	test("a body of literal null fails rather than raising a type error", async () => {
		const query: Query = async () => null;

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"nothing for hero 9001",
		);
	});

	test("a query that has spent its attempts fails before any row", async () => {
		const query: Query = async () => {
			throw new Error("the API answered 500; 4 attempts made");
		};

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"4 attempts made",
		);
	});

	test("a pair answered outside a list is read all the same", async () => {
		// The probe recorded `HeroDryadType`'s fields and not whether `matchUp`
		// answers one of them or a list of one; both are read.
		const query: Query = async (sent) => {
			const named = /heroId: (\d+)/.exec(sent);
			if (named === null)
				throw new Error(`the request named no hero id: ${sent}`);
			const heroId = Number(named[1]);
			return {
				data: {
					heroStats: {
						matchUp: { vs: whole(heroId), with: whole(heroId) },
					},
				},
			};
		};

		const { matchups } = await pullPairs(query, HEROES, WEEKS);

		expect(matchups).toHaveLength(6);
	});
});
