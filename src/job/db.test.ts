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
import { batches, connect, connectionString } from "./db.ts";

requiresDatabase();

/**
 * The batching arithmetic, without a database: what it must never do is hand a
 * statement more parameters than the protocol counts, and the sizes below sit
 * either side of the row count where a five-column table crosses 65 535.
 */
describe("rows batched under the parameter ceiling", () => {
	const widths = (rows: number, columns: number) =>
		[
			...batches(
				Array.from({ length: rows }, (_, n) => ({ n })),
				Array(columns).fill("c"),
			),
		].map((batch) => batch.length);

	test("a list that fits is one batch and an empty one is none", () => {
		expect(widths(13_107, 5)).toEqual([13_107]);
		expect(widths(0, 5)).toEqual([]);
	});

	test("one row past the ceiling splits, and no batch is over it", () => {
		const split = widths(13_108, 5);
		expect(split).toEqual([13_107, 1]);
		// The property the call sites depend on, stated rather than implied by
		// the sizes above: a batch times its columns is what one statement carries.
		for (const size of widths(40_000, 5))
			expect(size * 5).toBeLessThanOrEqual(65_535);
	});

	test("a column list naming none falls back to the row's own keys", () => {
		// Not a division by zero and one batch of everything, which is the
		// silent wrong answer: a step of `Infinity` overflows the statement
		// this exists to keep under the ceiling.
		const rows = Array.from({ length: 13_108 }, () => ({
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5,
		}));
		expect([...batches(rows, [])].map((batch) => batch.length)).toEqual([
			13_107, 1,
		]);
	});

	test("the columns counted are the row's own where none are named", () => {
		// Five keys, so the same split as the case above without saying so.
		const rows = Array.from({ length: 13_108 }, () => ({
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5,
		}));
		expect([...batches(rows)].map((batch) => batch.length)).toEqual([
			13_107, 1,
		]);
	});
});

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

	test("a snapshots table predating the verdict columns gains them [87]", async () => {
		// Connections of this case's own, each closed before the next is taken:
		// `opener` holds every pool it opens until the file ends, and this file
		// already stands at what the server will hand out.
		const before = await connect(url);
		try {
			// Applying the schema to a fresh database never reaches the `ALTER`s
			// that carry these two: the same file's `CREATE` has already given
			// the table both columns, so the statement the compatibility claim
			// rests on is a no-op in every other case here. The table is put
			// back into the shape it was written for.
			await before`ALTER TABLE snapshots DROP COLUMN side_measured,
				DROP COLUMN phase_measured`;
			await before`INSERT INTO patches VALUES ('z9.91', 'z9.91', true, now())
				ON CONFLICT DO NOTHING`;
			await before`INSERT INTO snapshots
					(created_at, patch_id, prior_patch_id, prior_weight, status)
				VALUES (now(), 'z9.91', NULL, 0, 'published')`;
		} finally {
			await before.close();
		}

		const after = await connect(url);
		try {
			// A row written before the columns existed measured neither
			// component, which is what the `DEFAULT false` has to say on its
			// behalf — a backfill of `true` would offer the next build a prior
			// nobody took.
			const held = await after`SELECT side_measured, phase_measured
				FROM snapshots WHERE patch_id = 'z9.91'`;
			expect(held).toEqual([{ side_measured: false, phase_measured: false }]);
		} finally {
			await after.close();
		}
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
	 *
	 * The hero is the sentinel the whole cascade hangs on: `db.fixture.ts`'s
	 * cleaner reclaims ids at or above 9000, and a hero below that survives
	 * every cleaner, so the next suite stages rows against it that no cleaner
	 * can delete either — and the patch delete underneath them then fails on a
	 * foreign key. Which suite runs next is an order that has already changed
	 * once. The `patches` table carries no such rule: `patches.test.ts` empties
	 * it whole and refills it with real version numbers.
	 */
	test("no hero below the sentinel the cleaner reclaims is left standing", async () => {
		const sql = await open();
		const strays = await sql`SELECT hero_id FROM heroes WHERE hero_id < 9000`;
		expect(strays).toEqual([]);
	});
});
