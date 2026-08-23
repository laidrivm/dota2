/**
 * The ban pull: one request over the meta window's days, read through an
 * endpoint whose `heroId` does not filter, whose `day` is a day number, and
 * whose absent rows are the common case.
 *
 * The shapes are taken from the `banDay` response recorded in
 * `docs/context/stratz-probe-2026-08.md`; no suite calls the live API.
 */
import { describe, expect, test } from "bun:test";
import { pullBans } from "./contest.ts";
import { metaWindow } from "./meta.ts";
import type { Query } from "./stratz.ts";

/** A patch a week old at the run instant, and the window it defines. */
const WEEK = metaWindow(
	new Date("2026-08-14T00:00:00.000Z"),
	new Date("2026-08-21T12:00:00.000Z"),
);

/** The day numbers that window holds: 2026-08-14 through 2026-08-20. */
const FIRST = Math.floor(Date.parse("2026-08-14T00:00:00.000Z") / 86_400_000);
const LAST = FIRST + 6;

/** One row of the response: a hero's bans on one day. */
const banned = (heroId: number, day: number, bans: number) => ({
	heroId,
	day,
	matchCount: bans,
});

/** A `query` answering one ban response, and the documents it was asked for. */
function asking(rows: unknown[]) {
	const asked: string[] = [];
	const query: Query = async (sent) => {
		asked.push(sent);
		return { data: { heroStats: { banDay: rows } } };
	};
	return { query, asked };
}

/** The message `work` failed with, or `null` where it did not fail. */
const failure = (work: Promise<unknown>) =>
	work.then(
		() => null,
		(error: Error) => error.message,
	);

describe("what the one request asks for", () => {
	// spec: snapshot-ingest/the-ban-request-s-window
	test("the days are the meta window's and one request covers every hero [73]", async () => {
		const { query, asked } = asking([banned(9001, LAST, 3)]);

		await pullBans(query, WEEK);

		// One request, not one per hero: `heroId` is a token the query must
		// present and not a filter it may use, so a loop over the reference
		// would issue 127 requests for identical data.
		expect(asked).toHaveLength(1);
		const [sent] = asked;
		expect(sent).toContain("take: 7");
		expect(sent).toContain("groupByDay: true");
		expect(sent).toContain("bracketBasicIds: [DIVINE_IMMORTAL]");
		expect(sent).toMatch(/heroId: \d+/);
	});

	// spec: snapshot-ingest/the-ban-request-s-window
	test("a day outside the window is not counted [73]", async () => {
		// `take` is the only bound the request carries, so the window is read
		// back off the rows rather than trusted.
		const { query } = asking([
			banned(9001, FIRST - 1, 100),
			banned(9001, FIRST, 3),
			banned(9001, LAST, 4),
			banned(9001, LAST + 1, 100),
		]);

		expect(await pullBans(query, WEEK)).toEqual(new Map([[9001, 7]]));
	});

	// spec: snapshot-ingest/the-ban-request-s-window
	test("the days are day numbers, not the meta pull's timestamps [73]", async () => {
		// Two encodings of the same word: a row keyed by a Unix timestamp falls
		// outside every window this endpoint could describe, so a run that read
		// `day` the meta pull's way ends here rather than storing a contest
		// rate from picks alone.
		const { query } = asking([
			banned(9001, Date.parse("2026-08-18T00:00:00.000Z") / 1000, 100),
		]);

		expect(await failure(pullBans(query, WEEK))).toContain(
			"named no hero inside the window",
		);
	});

	// spec: snapshot-ingest/the-ban-request-s-window
	test("a one-day window asks for one day and counts it [73]", async () => {
		const day = metaWindow(
			new Date("2026-08-21T06:00:00.000Z"),
			new Date("2026-08-21T12:00:00.000Z"),
		);
		const { query, asked } = asking([banned(9001, LAST, 3)]);

		// The meta pull's floor: the single most recent complete UTC day, which
		// is 2026-08-20 — this suite's own window ends on the same day.
		expect(await pullBans(query, day)).toEqual(new Map([[9001, 3]]));
		expect(asked[0]).toContain("take: 1");
	});

	// spec: snapshot-ingest/a-hero-and-day-absent-from-the-ban-response
	test("two heroes banned on the same days keep their counts apart [75]", async () => {
		const { query } = asking([
			banned(9001, FIRST, 3),
			banned(9002, FIRST, 7),
			banned(9001, LAST, 4),
		]);

		expect(await pullBans(query, WEEK)).toEqual(
			new Map([
				[9001, 7],
				[9002, 7],
			]),
		);
	});
});

describe("what the response leaves out", () => {
	// spec: snapshot-ingest/a-hero-and-day-absent-from-the-ban-response
	test("a hero and day with no row contributes zero [75]", async () => {
		// 169 pairs of 3810 were missing when this was measured and no row
		// carried a count of zero, so requiring the full grid would fail on
		// nearly every window.
		const { query } = asking([banned(9001, FIRST, 3)]);

		const bans = await pullBans(query, WEEK);

		expect(bans.get(9001)).toBe(3);
		expect(bans.has(9002)).toBe(false);
	});

	// spec: snapshot-ingest/bans-cannot-be-read
	test("a request that has spent its attempts fails the run [74]", async () => {
		// Rather than storing a contest rate from picks alone, which would be
		// indistinguishable afterwards from heroes nobody banned.
		const query: Query = async () => {
			throw new Error("the API answered 500; 4 attempts made");
		};

		expect(await failure(pullBans(query, WEEK))).toContain("4 attempts made");
	});

	// spec: snapshot-ingest/bans-cannot-be-read
	test("a response naming no hero at all fails the run [74]", async () => {
		// Seven days at these brackets carry bans on nearly every hero, so an
		// empty list is a request that did not land rather than a ban-free
		// window — and storing a rate from picks alone is indistinguishable
		// afterwards from heroes nobody banned.
		const { query } = asking([]);

		expect(await failure(pullBans(query, WEEK))).toContain(
			"named no hero inside the window",
		);
	});

	// spec: snapshot-ingest/bans-cannot-be-read
	test("days summing past what the column holds fail [74]", async () => {
		const { query } = asking([
			banned(9001, FIRST, 2_000_000_000),
			banned(9001, LAST, 2_000_000_000),
		]);

		expect(await failure(pullBans(query, WEEK))).toContain("past a ban count");
	});

	// spec: snapshot-ingest/bans-cannot-be-read
	test("a body carrying no rows at all fails the run [74]", async () => {
		const query: Query = async () => ({ data: { heroStats: {} } });

		expect(await failure(pullBans(query, WEEK))).toContain("no rows");
	});

	// spec: snapshot-ingest/bans-cannot-be-read
	test("a body of literal null fails rather than raising a type error [74]", async () => {
		const query: Query = async () => null;

		expect(await failure(pullBans(query, WEEK))).toContain("no rows");
	});

	test.each([
		["no hero id", { day: FIRST, matchCount: 1 }],
		["a day that is not a number", banned(9001, Number.NaN, 1)],
		["a fractional day", banned(9001, FIRST + 0.5, 1)],
		["a negative ban count", banned(9001, FIRST, -1)],
		["a ban count past the column", banned(9001, FIRST, 2_147_483_648)],
		["nothing at all", null],
	])("a row with %s fails naming which", async (_, entry) => {
		const { query } = asking([banned(9002, FIRST, 1), entry]);

		expect(await failure(pullBans(query, WEEK))).toContain("entry 1");
	});
});
