/**
 * The database-backed suite. It needs a Postgres to answer, so it skips where
 * no connection string is present — the pre-push run is offline and stays so.
 *
 * A skipped suite and a passing one report the same green, so the CI job that
 * owns this file supplies a connection string *and* sets `DATABASE_REQUIRED`.
 * The first test below turns a skip under that flag into a failure, which is
 * what makes the job evidence that these cases ran rather than evidence that
 * bun found the file.
 */
import { afterAll, describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { connect, connectionString } from "./db.ts";

const url = connectionString();

test("the job that requires a database is given one", () => {
	expect(Bun.env.DATABASE_REQUIRED === "1" && url === undefined).toBe(false);
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
	const opened: SQL[] = [];
	afterAll(async () => {
		for (const sql of opened) await sql.close();
	});

	const open = async () => {
		const sql = await connect(url);
		opened.push(sql);
		return sql;
	};

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
});
