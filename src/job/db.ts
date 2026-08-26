/**
 * The database edge: one connection with `schema.sql` applied to it.
 *
 * Everything above this file works in rows and knows no SQL beyond its own
 * statements, and everything below it is Postgres. The schema is applied on
 * connect rather than by a separate step because it is idempotent — there is
 * no state in which applying it is the wrong thing to do, so there is nothing
 * for a caller to decide.
 */
import { SQL } from "bun";

/** Where the schema lives, beside this module rather than inside it. */
const SCHEMA = `${import.meta.dir}/schema.sql`;

/**
 * The connection string a run reads, or `undefined` where it has none. An
 * empty or blank value is no connection string rather than a malformed one, so
 * that a variable exported and left unset fails the same way an absent one
 * does — the reading `stratz.ts` already applies to the API key.
 */
export const connectionString = (
	env: Record<string, string | undefined> = Bun.env,
): string | undefined => (env.DATABASE_URL ?? "").trim() || undefined;

/**
 * A connection with the schema applied.
 *
 * The string is a parameter rather than something this function reads for
 * itself, so that a caller holding none can be told so here — a default would
 * turn "no connection string" back into whatever the environment happens to
 * carry, which is exactly the case the tests need to reach.
 */
export async function connect(url: string | undefined): Promise<SQL> {
	if (url === undefined)
		throw new Error("DATABASE_URL is unset or empty; no connection was opened");
	const sql = new SQL(url);
	// The simple protocol, because the file is many statements and one call:
	// the extended one takes a single command per round trip. `unsafe` is safe
	// here in the only sense that matters — the text is this repository's own
	// file, never anything a request carried in. `sql.file()` would read it in
	// one call, but what it returns carries no `.simple()` at runtime however
	// the types declare it (bun 1.3.14), so the read stays separate.
	try {
		await sql.unsafe(await Bun.file(SCHEMA).text()).simple();
	} catch (e) {
		// Nothing else holds this client, so a throw from here would leave a
		// pool nobody can close and an event loop nothing lets go of. Its own
		// failure is swallowed rather than raised: what the caller needs is why
		// the schema would not apply, not why the tidying afterwards did not.
		await sql.close().catch(() => {});
		throw e;
	}
	return sql;
}

/**
 * The most bind parameters one statement may carry. Not a tuning choice: the
 * PostgreSQL wire protocol counts them in a 16-bit field, so this is the
 * protocol's own ceiling, and bun reports crossing it as
 * `ERR_POSTGRES_TOO_MANY_PARAMETERS` — as a plain object, not an `Error`.
 */
const MAX_PARAMETERS = 65_535;

/**
 * `rows` in batches no single bulk `INSERT` can overflow.
 *
 * Every caller here writes one statement per table, and a statement carries
 * one parameter per column per row — so a table whose row count is a function
 * of the hero reference crosses the ceiling above on its own. At 127 heroes an
 * ordered pair matrix is 16 002 rows of 5 columns, which is 80 010 parameters
 * against a limit of 65 535, and no run can write it whole.
 *
 * `columns` defaults to the keys of the first row because that is what the
 * bulk form itself does when a caller names none — the default mirrors the
 * statement rather than guessing at it. Yields nothing for an empty list,
 * which is also the guard a caller would otherwise write: the statement an
 * empty array produces is not SQL.
 */
export function* batches<T extends object>(
	rows: readonly T[],
	columns?: readonly string[],
): Generator<readonly T[]> {
	if (rows.length === 0) return;
	const width = (columns ?? Object.keys(rows[0] as object)).length;
	// `max(1, …)` so a row wider than the ceiling yields batches of one and
	// fails at the driver naming its own limit, rather than looping forever on
	// a step of zero here.
	const size = Math.max(1, Math.floor(MAX_PARAMETERS / width));
	for (let at = 0; at < rows.length; at += size)
		yield rows.slice(at, at + size);
}
