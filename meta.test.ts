/**
 * The meta pull: what five requests name, what they sum into, and the answers
 * that end the run rather than being staged.
 *
 * The rows here are shaped from the `winDay` response recorded in
 * `docs/context/stratz-probe-2026-08.md`. No suite calls the live API.
 * The window arithmetic those requests are measured over is
 * `meta-window.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { metaWindow, pullMeta } from "./meta.ts";
import type { Query } from "./stratz.ts";

/** A patch a week old at the run instant, and the window it defines. */
const WEEK = metaWindow(
	new Date("2026-08-14T00:00:00.000Z"),
	new Date("2026-08-21T12:00:00.000Z"),
);

/**
 * A `query` answering `rows(call)` to each of the five position requests, and
 * the documents it was asked for.
 */
function asking(rows: (call: number) => unknown[]) {
	const asked: string[] = [];
	const query: Query = async (sent) => {
		asked.push(sent);
		return { data: { heroStats: { winDay: rows(asked.length - 1) } } };
	};
	return { query, asked };
}

/** The same rows whichever position is asked for. */
const same = (rows: unknown[]) => () => rows;

/** One hero's row for one day, as the endpoint returns it. */
const counted = (heroId: number, matches: number, wins: number) => ({
	heroId,
	matchCount: matches,
	winCount: wins,
});

/** The message `work` failed with, or `null` where it did not fail. */
const failure = (work: Promise<unknown>) =>
	work.then(
		() => null,
		(error: Error) => error.message,
	);

describe("what the five requests sum into", () => {
	// spec: snapshot-ingest/a-patch-a-week-old
	test("a row holds the hero's sum over the window's days [20]", async () => {
		const days = Array.from({ length: 7 }, (_, n) =>
			counted(9001, 100 + n, 50),
		);
		const { query, asked } = asking(same(days));

		const rows = await pullMeta(query, WEEK);

		expect(rows).toContainEqual({
			heroId: 9001,
			position: 1,
			matches: 721,
			wins: 350,
		});
		// The window is asked for by its length, one request per position.
		expect(asked).toHaveLength(5);
		for (const sent of asked) expect(sent).toContain("take: 7");
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("days returned out of order sum to the same row [21]", async () => {
		const days = [counted(9001, 10, 4), counted(9001, 20, 9)];
		const forwards = await pullMeta(asking(same(days)).query, WEEK);
		const backwards = await pullMeta(
			asking(same([...days].reverse())).query,
			WEEK,
		);

		expect(backwards).toEqual(forwards);
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("a hero the source returns no row for gets no row [19]", async () => {
		const { query } = asking(same([counted(9001, 10, 4)]));

		const rows = await pullMeta(query, WEEK);

		// No sample is not a sample of zero: 9002 is absent rather than nil.
		expect(rows.map((row) => row.heroId)).toEqual([
			9001, 9001, 9001, 9001, 9001,
		]);
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("two heroes in one response keep their counts apart [19]", async () => {
		const { query } = asking(
			same([counted(9001, 10, 4), counted(9002, 20, 9)]),
		);

		const rows = await pullMeta(query, WEEK);

		expect(rows.filter((row) => row.position === 1)).toEqual([
			{ heroId: 9001, position: 1, matches: 10, wins: 4 },
			{ heroId: 9002, position: 1, matches: 20, wins: 9 },
		]);
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("five pulls leave one row per hero and position [22]", async () => {
		const { query } = asking((call) => [counted(9001, 10 * (call + 1), call)]);

		const rows = await pullMeta(query, WEEK);

		expect(rows).toEqual([
			{ heroId: 9001, position: 1, matches: 10, wins: 0 },
			{ heroId: 9001, position: 2, matches: 20, wins: 1 },
			{ heroId: 9001, position: 3, matches: 30, wins: 2 },
			{ heroId: 9001, position: 4, matches: 40, wins: 3 },
			{ heroId: 9001, position: 5, matches: 50, wins: 4 },
		]);
	});
});

describe("what a request names", () => {
	/** The five documents a pull over `WEEK` issues. */
	const documents = async () => {
		const { query, asked } = asking(same([counted(9001, 10, 4)]));
		await pullMeta(query, WEEK);
		expect(asked).toHaveLength(5);
		return asked;
	};

	// spec: snapshot-ingest/the-modes-the-product-does-not-model
	test("every request names the ranked All Pick game mode [27]", async () => {
		// The filter is the whole reason this endpoint is the source: a request
		// without it is answered over every mode, and that answer is never what
		// this pull asked for.
		for (const sent of await documents())
			expect(sent).toContain("gameModeIds: [ALL_PICK_RANKED]");
	});

	// spec: snapshot-ingest/the-brackets-the-product-models
	test("every request names the Divine and Immortal brackets [28]", async () => {
		for (const sent of await documents())
			expect(sent).toContain("bracketIds: [DIVINE, IMMORTAL]");
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("each request names a position of its own [22]", async () => {
		// The rows above carry five distinct positions whether or not the
		// requests did: a pull asking POSITION_1 five times would label the same
		// statistic five ways, and only the documents show it.
		expect(
			(await documents()).map(
				(sent) => /positionIds: \[(\w+)\]/.exec(sent)?.[1],
			),
		).toEqual([
			"POSITION_1",
			"POSITION_2",
			"POSITION_3",
			"POSITION_4",
			"POSITION_5",
		]);
	});

	// spec: snapshot-ingest/a-patch-a-week-old
	test("every request groups by hero [20]", async () => {
		// Any other grouping returns a different statistic under the same field
		// names, which the sum above would stage as though it were this one.
		for (const sent of await documents())
			expect(sent).toContain("groupBy: HERO_ID");
	});
});

describe("an answer that is not a pull", () => {
	test("a response carrying no rows at all fails, naming the position", async () => {
		const query: Query = async () => ({ data: { heroStats: {} } });

		expect(await failure(pullMeta(query, WEEK))).toContain("position 1");
	});

	test("a body of literal null fails rather than raising a type error", async () => {
		const query: Query = async () => null;

		expect(await failure(pullMeta(query, WEEK))).toContain("position 1");
	});

	test("a row with no hero id fails rather than being staged", async () => {
		const { query } = asking(same([{ matchCount: 10, winCount: 4 }]));

		expect(await failure(pullMeta(query, WEEK))).toContain("no hero id");
	});

	test("five empty responses fail rather than emptying staging", async () => {
		const { query } = asking(same([]));

		// A window with no matches in it and a pull that did not happen are the
		// same empty list; the staging write deletes before it inserts, so the
		// second one would take the previous patch's rows with it.
		expect(await failure(pullMeta(query, WEEK))).toContain(
			"no rows at any position",
		);
	});

	test.each([
		["a fractional match count", 10.5, 4],
		["a negative match count", -1, 0],
		["a match count that is not a number", "10", 4],
		["a missing win count", 10, undefined],
		["more wins than matches", 4, 10],
	])(
		"a day with %s fails rather than being summed",
		async (_, matches, wins) => {
			// The sum is what the staging table's own constraint sees, and a day
			// like this one is hidden inside it — 4 wins of 10 matches added to
			// 10 of 4 satisfies the constraint that neither day does.
			const { query } = asking(
				same([
					counted(9001, 10, 4),
					{ heroId: 9001, matchCount: matches, winCount: wins },
				]),
			);

			expect(await failure(pullMeta(query, WEEK))).toContain(
				"counts a day cannot have",
			);
		},
	);

	test("a query that has spent its attempts fails before any row", async () => {
		const query: Query = async () => {
			throw new Error("the API answered 500; 4 attempts made");
		};

		expect(await failure(pullMeta(query, WEEK))).toContain("4 attempts made");
	});
});
