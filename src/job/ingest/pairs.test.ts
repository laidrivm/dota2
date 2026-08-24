/**
 * A pair response the reference admits: what the request asks for, and what
 * one row per other hero per week sums into.
 *
 * The refusals are `pairs-refusals.test.ts`'s and the weeks the requests are
 * measured over are `pairs-weeks.test.ts`'s; the fixtures both share are
 * `pairs.fixture.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { asking, HEROES, WEEK_MS, WEEKS, whole } from "./pairs.fixture.ts";
import { pairWeeks, pullPairs } from "./pairs.ts";

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

	// spec: snapshot-ingest/a-patch-older-than-the-cap
	test("each request names its own week, in seconds, from inside it [24]", async () => {
		const weeks = pairWeeks(
			new Date("2026-07-01T00:00:00.000Z"),
			new Date("2026-08-21T12:00:00.000Z"),
		);
		const { query, asked } = asking(() => ({}));

		await pullPairs(query, HEROES, weeks);

		// Heroes are the outer loop, so the first four calls are hero 9001's.
		const anchors = asked
			.slice(0, 4)
			.map((sent) => Number(/week: (\d+)/.exec(sent)?.[1]));
		// Four distinct buckets, not one bucket asked four times and summed
		// fourfold — which every count assertion above would still accept.
		expect(new Set(anchors).size).toBe(4);
		// Seconds, not milliseconds, and strictly inside the bucket: the probe
		// records the same word meaning a day number on `banDay` and a Unix
		// timestamp on `winDay`, so which one this is has to be pinned.
		for (const [n, anchor] of anchors.entries()) {
			const opened = (weeks[n] as Date).getTime();
			expect(anchor * 1000).toBeGreaterThanOrEqual(opened);
			expect(anchor * 1000).toBeLessThan(opened + WEEK_MS);
		}
	});

	// spec: snapshot-ingest/every-opponent-not-the-default-page
	test("the opponent matrix becomes matchups and the ally one synergies [29]", async () => {
		// Told apart by their counts: identical fixtures would not notice the
		// two being read into each other's table.
		const { query } = asking((heroId) => ({
			vs: whole(heroId, 10, 4),
			with: whole(heroId, 20, 9),
		}));

		const { matchups, synergies } = await pullPairs(query, HEROES, WEEKS);

		expect(matchups[0]).toMatchObject({ matches: 10, wins: 4 });
		expect(synergies[0]).toMatchObject({ matches: 20, wins: 9 });
	});

	test("a hero listed twice is asked for once and summed once", async () => {
		const { query, asked } = asking(() => ({}));

		const { matchups } = await pullPairs(query, [...HEROES, 9001], WEEKS);

		expect(asked).toHaveLength(3);
		expect(matchups).toContainEqual({
			heroId: 9001,
			otherId: 9002,
			matches: 10,
			wins: 4,
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
