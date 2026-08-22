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
	const required = Bun.env.DATABASE_REQUIRED === "1";
	expect(required && url === undefined).toBe(false);
});

test.each([
	["an absent variable", {}],
	["a blank one", { DATABASE_URL: "  " }],
])("%s is no connection string", (_, env) => {
	expect(connectionString(env)).toBeUndefined();
});

test("a run with no connection string is refused, naming the variable", async () => {
	await expect(connect(undefined)).rejects.toThrow(/DATABASE_URL/);
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

	test("the tables the later groups write through are there afterwards", async () => {
		const sql = await open();
		const found = await Promise.all(
			["heroes", "patches", "snapshots", "staging_hero_stats"].map((name) =>
				table(sql, name),
			),
		);
		expect(found).toEqual([
			"heroes",
			"patches",
			"snapshots",
			"staging_hero_stats",
		]);
	});

	test("a second connection applies the schema over itself", async () => {
		// `CREATE TABLE` without `IF NOT EXISTS` fails here rather than at some
		// later run, which is the whole reason the schema is applied on connect.
		await open();
		expect(await table(await open(), "heroes")).toBe("heroes");
	});
});
