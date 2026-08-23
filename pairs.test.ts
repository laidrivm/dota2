/**
 * What a pair response has to carry to be summed: one row per other hero in
 * each matrix, and nothing the reference does not hold.
 *
 * Three heroes stand in for the reference's 127, so a whole matrix is two rows
 * rather than 126. The weeks the requests are measured over are
 * `pairs-weeks.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { pairWeeks, pullPairs, type Week } from "./pairs.ts";
import type { Query } from "./stratz.ts";

/** The reference this suite pulls over, and one complete week to pull it in. */
const HEROES = [9001, 9002, 9003];
const WEEKS: Week[] = pairWeeks(
	new Date("2026-08-13T00:00:00.000Z"),
	new Date("2026-08-21T12:00:00.000Z"),
);

/** One row of one matrix, as the endpoint returns it. */
const row = (heroId2: number, matches: number, wins: number) => ({
	heroId2,
	matchCount: matches,
	winCount: wins,
});

/** Every other hero's row, so a matrix the reference admits whole. */
const whole = (heroId: number, matches = 10, wins = 4) =>
	HEROES.filter((id) => id !== heroId).map((id) => row(id, matches, wins));

/**
 * A `query` answering each hero's request from `matrices`, and the documents
 * it was asked for. `vs` and `with` default to the whole matrix, so a case
 * about one of them names only that one.
 */
function asking(
	matrices: (heroId: number, call: number) => { vs?: unknown; with?: unknown },
) {
	const asked: string[] = [];
	const query: Query = async (sent) => {
		const heroId = Number(/heroId: (\d+)/.exec(sent)?.[1]);
		const answered = matrices(heroId, asked.length);
		asked.push(sent);
		return {
			data: {
				heroStats: {
					matchUp: [
						{
							// `in` rather than `??`, so a case can answer a matrix
							// that is absent as well as one that is wrong.
							vs: "vs" in answered ? answered.vs : whole(heroId),
							with: "with" in answered ? answered.with : whole(heroId),
						},
					],
				},
			},
		};
	};
	return { query, asked };
}

/** The message `work` failed with, or `null` where it did not fail. */
const failure = (work: Promise<unknown>) =>
	work.then(
		() => null,
		(error: Error) => error.message,
	);

describe("a response the reference admits", () => {
	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test("a request asks for every other hero rather than a page of ten [29]", async () => {
		const { query, asked } = asking(() => ({}));

		await pullPairs(query, HEROES, WEEKS);

		// One request per hero per week, each asking past the endpoint's own
		// default of ten so the whole matrix comes back in one.
		expect(asked).toHaveLength(3);
		for (const sent of asked) {
			expect(sent).toContain("take: 200");
			expect(sent).toContain("bracketBasicIds: [DIVINE_IMMORTAL]");
		}
	});

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test("both directions are kept, one row per ordered pair [29]", async () => {
		const { query } = asking(() => ({}));

		const { matchups, synergies } = await pullPairs(query, HEROES, WEEKS);

		// Six ordered pairs over three heroes, in each matrix: folding them into
		// one row is `snapshot-build`'s symmetry step, not this one's.
		expect(matchups).toHaveLength(6);
		expect(synergies).toHaveLength(6);
		expect(matchups).toContainEqual({
			heroId: 9001,
			otherId: 9002,
			matches: 10,
			wins: 4,
		});
		expect(matchups).toContainEqual({
			heroId: 9002,
			otherId: 9001,
			matches: 10,
			wins: 4,
		});
	});

	// spec: snapshot-ingest/a-patch-older-than-the-cap
	test("a pair's counts are summed across the weeks [24]", async () => {
		const weeks = pairWeeks(
			new Date("2026-07-01T00:00:00.000Z"),
			new Date("2026-08-21T12:00:00.000Z"),
		);
		// A different count per week, so a sum is told from an overwrite.
		const { query, asked } = asking((heroId, call) => ({
			vs: whole(heroId, 10 * (call + 1), call + 1),
			with: whole(heroId),
		}));

		const { matchups } = await pullPairs(query, HEROES, weeks);

		expect(weeks).toHaveLength(4);
		expect(asked).toHaveLength(12);
		// Hero 9001 is asked first, so its four weeks are the first four calls:
		// 10 + 20 + 30 + 40 matches, 1 + 2 + 3 + 4 wins.
		expect(matchups).toContainEqual({
			heroId: 9001,
			otherId: 9002,
			matches: 100,
			wins: 10,
		});
	});

	// spec: snapshot-ingest/a-patch-younger-than-the-cap
	test("no week means no request and no row [25]", async () => {
		const { query, asked } = asking(() => ({}));

		const { matchups, synergies } = await pullPairs(query, HEROES, []);

		// A patch with no complete week behind it leaves the pair statistics
		// absent rather than approximate; there is no floor here as the meta
		// window has one.
		expect(asked).toEqual([]);
		expect([...matchups, ...synergies]).toEqual([]);
	});
});

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
	])("a row with %s fails rather than being summed [82]", async (_, rows) => {
		// Read on the week, because the sum over four of them is what the
		// staging table's own constraint sees.
		expect(await refusing(rows)).toContain("counts a week cannot have");
	});

	test("a matrix that is absent fails naming which", async () => {
		expect(await refusing(undefined)).toContain("no opponent rows");
	});

	test("a body carrying no pair at all fails naming the hero", async () => {
		const query: Query = async () => ({ data: { heroStats: { matchUp: [] } } });

		expect(await failure(pullPairs(query, HEROES, WEEKS))).toContain(
			"nothing for hero 9001",
		);
	});

	test("a pair answered outside a list is read all the same", async () => {
		// The probe recorded `HeroDryadType`'s fields and not whether `matchUp`
		// answers one of them or a list of one; both are read.
		const query: Query = async (sent) => {
			const heroId = Number(/heroId: (\d+)/.exec(sent)?.[1]);
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
