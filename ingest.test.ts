/**
 * A whole run against a real database: what a repeat leaves, what a day's
 * difference moves, and what a failure part-way leaves behind.
 *
 * The staging write's own cases — retention and the rollback of one bad
 * row — are `staging.test.ts`'s.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { SQL } from "bun";
import { opener, requiresDatabase, url } from "./db.fixture.ts";
import {
	HEROES,
	icons,
	PATCH,
	sourceFetch,
	sourceQuery,
} from "./ingest.fixture.ts";
import { ingest } from "./ingest.ts";

requiresDatabase();

/** A run a week into the patch's life, and one a day later. */
const RUN_AT = new Date("2026-08-21T12:00:00.000Z");
const NEXT_DAY = new Date("2026-08-22T12:00:00.000Z");

/** What one meta row carries, whichever hero it names. */
const COUNTS = { matchCount: 10, winCount: 5 };

describe.skipIf(url === undefined)("one run, and the next", () => {
	const open = opener();
	const dir = icons();
	/** A second one, for the case that asserts what a run left in it. */
	const ownDir = icons();

	/** A connection holding none of this file's rows. */
	const clean = async () => {
		const sql = await open();
		await sql`DELETE FROM staging_hero_position_stats WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_stats WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_matchups WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_synergies WHERE hero_id >= 9000`;
		await sql`DELETE FROM heroes WHERE hero_id >= 9000`;
		await sql`DELETE FROM patches WHERE patch_id LIKE 'z9.%'`;
		return sql;
	};

	/** Every staging row this file's heroes have, in a comparable shape. */
	const staged = async (sql: SQL) => ({
		positions: await sql`SELECT patch_id, hero_id, position, matches, wins
			FROM staging_hero_position_stats WHERE hero_id >= 9000
			ORDER BY hero_id, position`,
		heroes: (
			await sql`SELECT patch_id, hero_id, matches, wins, contest_rate
				FROM staging_hero_stats WHERE hero_id >= 9000 ORDER BY hero_id`
		).map((row: { contest_rate: number }) => ({
			...row,
			// Compared as the `real` it is stored as. Measured on this driver
			// (bun 1.3.14): the first read of a `real` column on a connection
			// answers 5.0285716 and every read after it answers
			// 5.028571605682373 — one float4 value, two JS renderings, so a raw
			// comparison of two reads fails on representation alone.
			contest_rate: Math.fround(row.contest_rate),
		})),
		matchups: await sql`SELECT patch_id, hero_id, enemy_id, matches, wins
			FROM staging_hero_matchups WHERE hero_id >= 9000
			ORDER BY hero_id, enemy_id`,
		synergies: await sql`SELECT patch_id, hero_id, ally_id, matches, wins
			FROM staging_hero_synergies WHERE hero_id >= 9000
			ORDER BY hero_id, ally_id`,
	});

	/** A run over the source this file scripts, at `at`. */
	const run = (sql: SQL, at: Date, options: { pairsFail?: boolean } = {}) =>
		ingest(
			{
				sql,
				query: sourceQuery(at, options).query,
				fetch: sourceFetch(),
				iconsDir: dir,
			},
			at,
		);

	// spec: snapshot-ingest/two-runs-over-unchanged-data
	test("two runs over the same source and instant leave identical rows [36]", async () => {
		const sql = await clean();

		const first = await run(sql, RUN_AT);
		const once = await staged(sql);
		await run(sql, RUN_AT);
		const twice = await staged(sql);

		expect(first.patchId).toBe(PATCH);
		// Identical rather than doubled: the write replaces the patch's rows
		// rather than adding to them, so a repeat is not an accumulation.
		expect(twice).toEqual(once);
		expect(once.positions).not.toEqual([]);
	});

	// spec: snapshot-ingest/two-runs-over-unchanged-data
	test("one run writes rows to every staging table it fills [36]", async () => {
		const sql = await clean();

		await run(sql, RUN_AT);

		// Asserted per table, because every other case here compares one run
		// against another — and two runs that both wrote nothing to a table
		// agree exactly as well as two that filled it.
		const rows = await staged(sql);
		// Two heroes over five positions, one hero row each, and one ordered
		// pair each way between the two.
		expect(rows.positions).toHaveLength(10);
		expect(rows.heroes).toHaveLength(2);
		expect(rows.matchups).toHaveLength(2);
		expect(rows.synergies).toHaveLength(2);
	});

	// spec: snapshot-ingest/two-runs-over-unchanged-data
	test("a run reports the window and the weeks it covered [36]", async () => {
		const sql = await clean();

		const covered = await run(sql, RUN_AT);

		// What the requirement asks a run to record, and what group 12 has to
		// have in hand to report it.
		expect(covered.window.days).toBe(7);
		expect(covered.window.cappedBySource).toBe(false);
		expect(covered.weeks.map((week) => week.toISOString())).toEqual([
			"2026-08-13T00:00:00.000Z",
		]);
	});

	// spec: snapshot-ingest/a-run-that-fails-part-way
	test("a run whose patch source fails writes nothing at all [37]", async () => {
		const sql = await clean();

		const failed = await ingest(
			{
				sql,
				query: sourceQuery(RUN_AT).query,
				fetch: sourceFetch([]),
				iconsDir: dir,
			},
			RUN_AT,
		).then(
			() => null,
			(error: Error) => error.message,
		);

		// The patch is detected before anything else, so a run that cannot date
		// itself has not upserted a hero either.
		expect(failed).toContain("listed no patch");
		const heroes = await sql`SELECT hero_id FROM heroes WHERE hero_id >= 9000`;
		expect(heroes).toEqual([]);
		expect((await staged(sql)).positions).toEqual([]);
	});

	// spec: snapshot-ingest/a-run-that-fails-part-way
	test("a hero the reference does not hold fails before the write [37]", async () => {
		const sql = await clean();
		const { query } = sourceQuery(RUN_AT);
		// The meta pull names a hero the reference call never did — two calls to
		// one API disagreeing, which reaches the insert as a foreign key error
		// naming a column rather than a source.
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

	// spec: snapshot-ingest/two-runs-a-day-apart
	test("two runs a UTC day apart leave different rows [65]", async () => {
		const sql = await clean();

		await run(sql, RUN_AT);
		const before = await staged(sql);
		await run(sql, NEXT_DAY);
		const after = await staged(sql);

		// The window grew by a day, so the summed counts did. Stating this is
		// what keeps "a re-run recomputes the window" from reading as a promise
		// that a nightly job reproduces yesterday's rows.
		expect(before.positions[0]?.matches).toBe(70);
		expect(after.positions[0]?.matches).toBe(80);
	});

	// spec: snapshot-ingest/a-run-that-fails-part-way
	test("a run failing after the meta pull leaves staging untouched [37]", async () => {
		const sql = await clean();
		await run(sql, RUN_AT);
		const before = await staged(sql);

		const failed = await run(sql, NEXT_DAY, { pairsFail: true }).then(
			() => null,
			(error: Error) => error.message,
		);

		// The meta pull produced rows for a window a day wider, and none of
		// them reached staging: everything is pulled before anything is
		// written, so there is nothing part-written to undo.
		expect(failed).toContain("4 attempts made");
		expect(await staged(sql)).toEqual(before);
	});

	test("the reference and the images survive a failed run", async () => {
		const sql = await clean();

		// A directory of its own, so what is found in it afterwards was written
		// by this run rather than by whichever case ran before it.
		const failed = await ingest(
			{
				sql,
				query: sourceQuery(RUN_AT, { pairsFail: true }).query,
				fetch: sourceFetch(),
				iconsDir: ownDir,
			},
			RUN_AT,
		).then(
			() => null,
			(error: Error) => error.message,
		);

		// Asserted rather than swallowed: without it a run that stopped failing
		// would pass this case on the rows a previous one left.
		expect(failed).toContain("4 attempts made");
		// Outside the transaction by construction: both are operations a repeat
		// performs identically, which is why they need no rollback.
		const rows = await sql`SELECT hero_id FROM heroes WHERE hero_id >= 9000
			ORDER BY hero_id`;
		expect(rows.map((row: { hero_id: number }) => row.hero_id)).toEqual(HEROES);
		for (const slug of ["hero0", "hero1"])
			expect(await Bun.file(join(ownDir, `${slug}.png`)).exists()).toBe(true);
	});
});
