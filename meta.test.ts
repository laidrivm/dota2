/**
 * The meta pull: the window a patch and a run instant define, what a request
 * over it names, and what five of them sum into.
 *
 * The rows here are shaped from the `winDay` response recorded in
 * `docs/context/stratz-probe-2026-08.md`. No suite calls the live API.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { metaWindow, pullMeta } from "./meta.ts";
import type { Query } from "./stratz.ts";

/** A patch released at a UTC midnight, and a run a week into its life. */
const RELEASED = new Date("2026-08-14T00:00:00.000Z");
const RUN_AT = new Date("2026-08-21T12:00:00.000Z");

/** The window that pair defines, which the pull tests all run over. */
const WEEK = metaWindow(RELEASED, RUN_AT);

/**
 * A `query` answering `rows(call)` to each of the five position requests, and
 * the documents it was asked for.
 */
function asking(rows: (call: number) => unknown[]) {
	const asked: string[] = [];
	const query: Query = async (document) => {
		asked.push(document);
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

describe("the window a run covers", () => {
	// spec: snapshot-ingest/a-patch-a-week-old
	test("a patch seven whole UTC days old is covered over seven days [20]", () => {
		expect(WEEK).toEqual({
			start: new Date("2026-08-14T00:00:00.000Z"),
			end: new Date("2026-08-21T00:00:00.000Z"),
			days: 7,
			cappedBySource: false,
		});
	});

	// spec: snapshot-ingest/the-day-in-progress
	test("the day the run instant falls inside is not part of it [64]", () => {
		// The last instant of the eighth day and the first of the ninth: the
		// window grows only once the day it would add has finished.
		expect(
			metaWindow(RELEASED, new Date("2026-08-21T23:59:59.999Z")).days,
		).toBe(7);
		expect(
			metaWindow(RELEASED, new Date("2026-08-22T00:00:00.000Z")).days,
		).toBe(8);
	});

	describe("read from a zone nine hours ahead of UTC", () => {
		const zone = process.env.TZ;
		beforeAll(() => {
			process.env.TZ = "Asia/Tokyo";
		});
		afterAll(() => {
			process.env.TZ = zone;
		});

		// spec: snapshot-ingest/the-day-in-progress
		test("a run instant whose local date is a day ahead adds no day [26]", () => {
			// 23:00 UTC is the next morning in Tokyo, so a window measured by the
			// machine's calendar would hold eight days here rather than seven.
			expect(
				metaWindow(RELEASED, new Date("2026-08-21T23:00:00.000Z")).days,
			).toBe(7);
		});
	});

	// spec: snapshot-ingest/a-patch-detected-today
	test("a patch with no complete day behind it covers the last complete one [18]", () => {
		const today = metaWindow(
			new Date("2026-08-21T06:00:00.000Z"),
			new Date("2026-08-21T12:00:00.000Z"),
		);

		expect(today).toEqual({
			start: new Date("2026-08-20T00:00:00.000Z"),
			end: new Date("2026-08-21T00:00:00.000Z"),
			days: 1,
			cappedBySource: false,
		});
	});

	// spec: snapshot-ingest/a-patch-older-than-the-source-will-serve
	test("a patch 150 days old covers thirty days, and the cap is recorded [70]", () => {
		const old = metaWindow(new Date("2026-03-24T00:00:00.000Z"), RUN_AT);

		expect(old.days).toBe(30);
		// Recorded rather than inferred from the length: a thirty-day patch and
		// a 150-day one both ask for thirty days, and only one of them is
		// covered whole.
		expect(old.cappedBySource).toBe(true);
		expect(old.start).toEqual(new Date("2026-07-22T00:00:00.000Z"));
	});
});

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
		for (const document of asked) expect(document).toContain("take: 7");
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
	// spec: snapshot-ingest/the-modes-the-product-does-not-model
	test("every request names the ranked All Pick game mode [27]", async () => {
		const { query, asked } = asking(same([]));

		await pullMeta(query, WEEK);

		// The filter is the whole reason this endpoint is the source: a request
		// without it is answered over every mode, and that answer is never what
		// this pull asked for.
		expect(asked).toHaveLength(5);
		for (const document of asked)
			expect(document).toContain("gameModeIds: [ALL_PICK_RANKED]");
	});

	// spec: snapshot-ingest/the-brackets-the-product-models
	test("every request names the Divine and Immortal brackets [28]", async () => {
		const { query, asked } = asking(same([]));

		await pullMeta(query, WEEK);

		expect(asked).toHaveLength(5);
		for (const document of asked)
			expect(document).toContain("bracketIds: [DIVINE, IMMORTAL]");
	});
});
