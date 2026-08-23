/**
 * What every database-backed suite needs: the connection string a run has or
 * has not, the guard that turns a skip in CI into a failure, and connections
 * that close themselves when the file is done.
 *
 * A skipped suite and a passing one report the same green, so each such file
 * calls `requiresDatabase()` once — the job that owns them supplies a
 * connection string, says the database is disposable *and* sets
 * `DATABASE_REQUIRED`, and the guard is what makes the job evidence that the
 * cases ran rather than evidence that bun found the files.
 */
import { afterAll, expect, test } from "bun:test";
import type { SQL } from "bun";
import { connect, connectionString } from "./db.ts";

/**
 * The connection string, or `undefined` where this run has none or has not
 * said the database behind it may be emptied.
 *
 * These suites delete rows, so a connection string on its own is not enough to
 * run them against: a `DATABASE_URL` left pointing at a database somebody's
 * own ingest filled is exactly what a plain `bun test` would empty.
 * `DATABASE_DISPOSABLE` is the sentence the URL cannot say — that what it
 * names exists to be thrown away. It is deliberately absent from
 * `.env.example`: that file is copied to `.env`, and a copy carrying this
 * would grant locally the thing it exists to withhold.
 */
export const url =
	Bun.env.DATABASE_DISPOSABLE === "1" ? connectionString() : undefined;

/** Declare that this file's cases are not allowed to skip in CI. */
export const requiresDatabase = () =>
	test("the job that requires a database is given a disposable one", () => {
		expect(Bun.env.DATABASE_REQUIRED === "1" && url === undefined).toBe(false);
	});

/**
 * A way to open connections that are closed when the file finishes. Call it at
 * the top level of a suite: it registers the `afterAll` that does the closing,
 * so a file that opens connections cannot forget to release them.
 */
export function opener(): () => Promise<SQL> {
	const opened: SQL[] = [];
	afterAll(async () => {
		for (const sql of opened) await sql.close();
	});
	return async () => {
		const sql = await connect(url);
		opened.push(sql);
		return sql;
	};
}
