/**
 * Which heroes a run stages, against a real database: the reference tables
 * decide, and they are not the reference response.
 *
 * What a repeat leaves, what a day's difference moves and what a failure
 * part-way leaves behind are `ingest.test.ts`'s; the staging write's own cases
 * are `staging.test.ts`'s.
 */

import { describe, expect, test } from "bun:test";
import { cleaner, opener, requiresDatabase, url } from "./db.fixture.ts";
import {
	COUNTS,
	HEROES,
	icons,
	PATCH,
	RUN_AT,
	run,
	sourceFetch,
	sourceQuery,
	staged,
} from "./ingest.fixture.ts";
import { ingest } from "./ingest.ts";

requiresDatabase();

/** A hero the tables hold that no response of this file's carries. */
const RETIRED = 9003;

describe.skipIf(url === undefined)("which heroes a run stages", () => {
	const clean = cleaner(opener());
	const dir = icons();

	/** `clean`, plus `RETIRED` held the way a previous run's upsert left it. */
	const withRetired = async () => {
		const sql = await clean();
		await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
			VALUES (${RETIRED}, 'Retired', 'retired', '/icons/retired.png', now())`;
		return sql;
	};

	// spec: snapshot-ingest/a-hero-the-meta-response-names-and-the-reference-does-not
	test("a hero the reference does not hold fails before the write [37] [98]", async () => {
		const sql = await clean();
		const { query } = sourceQuery(RUN_AT);
		// The meta pull names a hero the reference call never did — two calls to
		// one API disagreeing, which reaches the insert as a foreign key error
		// naming a column rather than a source. Kept as a run failure rather
		// than left to the totals, which now build from the reference and so
		// would drop such a hero without a word.
		const strayed: typeof query = async (sent) => {
			const answered = await query(sent);
			if (!sent.includes("winDay")) return answered;
			const body = answered as {
				data: { heroStats: { winDay: { heroId: number }[] } };
			};
			body.data.heroStats.winDay.push({ heroId: 9404, ...COUNTS });
			return body;
		};

		const failed = await ingest(
			{ sql, query: strayed, fetch: sourceFetch(), iconsDir: dir },
			RUN_AT,
		).then(
			() => null,
			(error: Error) => error.message,
		);

		expect(failed).toContain("the reference does not hold");
		expect((await staged(sql)).positions).toEqual([]);
	});

	// spec: snapshot-ingest/every-reference-hero-reaches-staging
	test("a hero the reference response omits still reaches staging [91]", async () => {
		const sql = await withRetired();

		await run(sql, dir, RUN_AT);

		// The tables are what "each hero" names, and they keep a hero a
		// response omits — so staging holds one more row than the response
		// carried heroes, rather than a hero count that falls and ends
		// `snapshot-build` at `failed`.
		const rows = await staged(sql);
		expect(rows.heroes).toHaveLength(HEROES.length + 1);
		expect(rows.heroes[2]).toEqual({
			patch_id: PATCH,
			hero_id: RETIRED,
			matches: 0,
			wins: 0,
			contest_rate: 0,
		});
	});

	// spec: snapshot-ingest/a-hero-the-meta-response-names-and-the-reference-does-not
	test("a hero only the tables hold is staged rather than refused", async () => {
		const sql = await withRetired();
		const { query } = sourceQuery(RUN_AT);
		// The meta response names a hero the reference response does not, which
		// the tables nonetheless hold: the guard reads the tables, so this is a
		// run that lands rather than the failure the case above pins.
		const retired: typeof query = async (sent) => {
			const answered = await query(sent);
			if (!sent.includes("winDay")) return answered;
			const body = answered as {
				data: { heroStats: { winDay: { heroId: number }[] } };
			};
			body.data.heroStats.winDay.push({ heroId: RETIRED, ...COUNTS });
			return body;
		};

		await ingest(
			{ sql, query: retired, fetch: sourceFetch(), iconsDir: dir },
			RUN_AT,
		);

		// Five position rows, one per position the meta pull asks for.
		const rows = await staged(sql);
		expect(
			rows.positions.filter(
				(row: { hero_id: number }) => row.hero_id === RETIRED,
			),
		).toHaveLength(5);
	});

	// spec: snapshot-ingest/every-reference-hero-reaches-staging
	test("a hero the window holds no picks for still reaches staging [91]", async () => {
		const sql = await clean();
		const { query } = sourceQuery(RUN_AT);
		// The meta response drops the second hero, which is what a hero nobody
		// played in the window looks like: the ban response still names it.
		const quiet: typeof query = async (sent) => {
			const answered = await query(sent);
			if (!sent.includes("winDay")) return answered;
			const body = answered as {
				data: { heroStats: { winDay: { heroId: number }[] } };
			};
			body.data.heroStats.winDay = body.data.heroStats.winDay.filter(
				(row) => row.heroId !== HEROES[1],
			);
			return body;
		};

		await ingest(
			{ sql, query: quiet, fetch: sourceFetch(), iconsDir: dir },
			RUN_AT,
		);

		const rows = await staged(sql);
		// One row per reference hero, whether or not the window held a pick —
		// the count `snapshot-build`'s validation reads.
		expect(rows.heroes).toHaveLength(HEROES.length);
		expect(rows.heroes[1]).toEqual({
			patch_id: PATCH,
			hero_id: HEROES[1],
			matches: 0,
			wins: 0,
			// The remaining hero's 350 picks are 35 matches, and this hero's
			// two bans are all it brings to them.
			contest_rate: Math.fround(2 / 35),
		});
		// The position rows are the meta response's, so the silent hero has
		// none of them.
		expect(rows.positions).toHaveLength(5);
	});
});
