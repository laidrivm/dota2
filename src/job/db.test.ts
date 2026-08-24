/**
 * The connection edge: what counts as a connection string, and that a
 * connection comes back with the schema already applied to it.
 *
 * The cases below the guard need a Postgres to answer, so they skip where no
 * connection string is present — the pre-push run is offline and stays so, and
 * `db.fixture.ts` holds what makes a skip in CI a failure.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { opener, requiresDatabase, url } from "./db.fixture.ts";
import { connect, connectionString } from "./db.ts";

requiresDatabase();

test.each([
	["an absent variable", {}],
	["a blank one", { DATABASE_URL: "  " }],
])("%s is no connection string", (_, env) => {
	expect(connectionString(env)).toBeUndefined();
});

test("a value padded with whitespace is the connection string inside it", () => {
	// A `.env` line ending in a space is the ordinary way this arrives, and
	// trimming to nothing and trimming to a value are the same code path.
	expect(connectionString({ DATABASE_URL: " postgres://host/db " })).toBe(
		"postgres://host/db",
	);
});

test("a run with no connection string is refused, naming the variable", async () => {
	await expect(connect(undefined)).rejects.toThrow(/DATABASE_URL/);
});

test("a server that refuses the connection fails the connect itself", async () => {
	// Port 1 refuses immediately. What this pins is ours rather than the
	// driver's: `new SQL()` alone connects to nothing, so a `connect` that did
	// not apply the schema would hand back a client that only failed at
	// whichever pull ran first.
	await expect(
		connect("postgres://postgres@127.0.0.1:1/postgres"),
	).rejects.toThrow();
});

describe.skipIf(url === undefined)("connecting", () => {
	const open = opener();

	/** The name Postgres resolves the table to, or `null` where it has none. */
	const table = async (sql: SQL, name: string) =>
		(await sql`SELECT to_regclass(${name})::text AS name`)[0].name;

	/** One table from each group the schema declares, reference to staging. */
	const NAMES = ["heroes", "patches", "snapshots", "staging_hero_stats"];

	test("the tables the later groups write through are there afterwards", async () => {
		const sql = await open();
		const found = await Promise.all(NAMES.map((name) => table(sql, name)));
		// A table the schema never created resolves to `null`, so an absent one
		// leaves a hole here rather than a shorter list.
		expect(found).toEqual(NAMES);
	});

	test("a second connection applies the schema over itself", async () => {
		// `CREATE TABLE` without `IF NOT EXISTS` fails here rather than at some
		// later run, which is the whole reason the schema is applied on connect.
		await open();
		expect(await table(await open(), "heroes")).toBe("heroes");
	});

	/**
	 * One row per staging table that carries both counts, each naming more wins
	 * than matches. Written out per table rather than generated, because what
	 * this asserts is that *every* one of the six carries the bound — a
	 * generated shape would go missing exactly where a table was forgotten.
	 */
	const OVER_ONE: [string, string, string][] = [
		["staging_hero_position_stats", "position, matches, wins", "1, 1, 2"],
		["staging_hero_stats", "matches, wins, contest_rate", "1, 2, 0"],
		["staging_hero_matchups", "enemy_id, matches, wins", "9002, 1, 2"],
		["staging_hero_synergies", "ally_id, matches, wins", "9002, 1, 2"],
		["staging_hero_sides", "side, matches, wins", "'radiant', 1, 2"],
		["staging_hero_phases", "phase, matches, wins", "'1', 1, 2"],
	];

	test.each(OVER_ONE)("%s refuses more wins than matches", async (t, c, v) => {
		const sql = await open();
		// The foreign keys are satisfied first, so what refuses the row is the
		// bound on the counts and not a missing hero. The ids are the sentinels
		// `db.fixture.ts`'s cleaner reclaims — hero ids at or above 9000, a patch
		// under `z9.` — because this file opens without cleaning and whatever it
		// leaves behind is read by whichever suite bun runs next.
		await sql`INSERT INTO heroes VALUES (9001, 'A', 'a', '/icons/a.png', now()),
			(9002, 'B', 'b', '/icons/b.png', now()) ON CONFLICT DO NOTHING`;
		await sql`INSERT INTO patches VALUES ('z9.90', 'z9.90', true, now())
			ON CONFLICT DO NOTHING`;
		// `expect(…).rejects` hangs on what `sql.unsafe` returns — a thenable
		// rather than a Promise, measured against bun 1.3.14 — so the rejection
		// is taken through `then` and asserted as a value.
		const failed = await sql
			.unsafe(`INSERT INTO ${t} (patch_id, hero_id, ${c})
				VALUES ('z9.90', 9001, ${v})`)
			.then(() => null, String);
		expect(failed).toMatch(/violates check constraint/);
	});

	/**
	 * Last in the file, so what it reads is what the cases above left behind.
	 * The sentinels are what `db.fixture.ts`'s cleaner deletes — hero ids at or
	 * above 9000, patch ids under `z9.` — and a row outside them is reclaimed by
	 * nothing and read by whichever suite bun runs next, which is an order that
	 * has already changed once.
	 */
	test("nothing outside the sentinels the cleaner reclaims is left standing", async () => {
		const sql = await open();
		const strays = await sql`
			SELECT hero_id::text AS stray FROM heroes WHERE hero_id < 9000
			UNION ALL
			SELECT patch_id FROM patches WHERE patch_id NOT LIKE 'z9.%'`;
		expect(strays).toEqual([]);
	});
});
