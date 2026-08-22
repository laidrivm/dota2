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
	await sql.unsafe(await Bun.file(SCHEMA).text()).simple();
	return sql;
}
