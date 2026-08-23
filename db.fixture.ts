/**
 * What every database-backed suite needs: the connection string a run has or
 * has not, the guard that turns a skip in CI into a failure, and connections
 * that close themselves when the file is done.
 *
 * A skipped suite and a passing one report the same green, so each such file
 * calls `requiresDatabase()` once — the job that owns them supplies a
 * connection string *and* sets `DATABASE_REQUIRED`, and the guard is what makes
 * the job evidence that the cases ran rather than evidence that bun found the
 * files.
 */
import { afterAll, expect, test } from "bun:test";
import type { SQL } from "bun";
import { connect, connectionString } from "./db.ts";

/** The connection string, or `undefined` where this run has none. */
export const url = connectionString();

/** Declare that this file's cases are not allowed to skip in CI. */
export const requiresDatabase = () =>
	test("the job that requires a database is given one", () => {
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
