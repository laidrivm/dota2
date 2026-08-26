/**
 * The staging write at a size one statement cannot carry.
 *
 * The PostgreSQL wire protocol counts bind parameters in a 16-bit field, so a
 * statement carries at most 65 535 of them — one per column per row. Every
 * other case stages two heroes, where a pair matrix is two rows; the reference
 * holds 127, where it is 16 002 rows of five columns and no single statement
 * can write it. This file is the one that crosses that line, and the one that
 * checks the write is still whole once it takes several statements to make.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { opener, requiresDatabase, url } from "../db.fixture.ts";
import { writeStaging } from "./staging.ts";

requiresDatabase();

/**
 * The fewest heroes whose ordered pair matrix crosses the ceiling: 115 × 114
 * is 13 110 rows of five columns, which is 65 550. At 114 the matrix falls 570
 * parameters short and the write that fails in production passes here.
 */
const CROSSING = 115;

/** The rows of the first batch, which is what "a later batch" is measured past. */
const FIRST_BATCH = 13_107;

const PATCH = "z9.40";

describe.skipIf(url === undefined)(
	"a staging write wider than one statement",
	() => {
		const open = opener();
		let shared: Promise<SQL> | undefined;
		const ids = Array.from({ length: CROSSING }, (_, n) => 9001 + n);

		/** Both matrices whole, and every row a row the schema admits. */
		const pairs = () =>
			ids.flatMap((heroId) =>
				ids
					.filter((otherId) => otherId !== heroId)
					.map((otherId) => ({ heroId, otherId, matches: 1, wins: 0 })),
			);

		/**
		 * The reference and the patch, and no staging row of this file's.
		 *
		 * Emptied at the start of a case rather than at the end of the file,
		 * which is `cleaner`'s shape and the one that survives a rollback: the
		 * write below clears the patch inside its own transaction, so a case
		 * that rolls back restores what the case before it left. One connection
		 * for the file, as `db.fixture.ts` asks.
		 */
		const clean = async (): Promise<SQL> => {
			shared ??= open();
			const sql = await shared;
			await sql`DELETE FROM staging_hero_matchups WHERE hero_id >= 9000`;
			await sql`DELETE FROM staging_hero_synergies WHERE hero_id >= 9000`;
			await sql`DELETE FROM heroes WHERE hero_id >= 9000`;
			await sql`DELETE FROM patches WHERE patch_id LIKE 'z9.%'`;
			await sql`INSERT INTO patches (patch_id, base_version, is_major, detected_at)
				VALUES (${PATCH}, ${PATCH}, true,
					${new Date("2026-07-01T00:00:00.000Z")})`;
			for (const heroId of ids)
				await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
					VALUES (${heroId}, ${`H${heroId}`}, ${`h${heroId}`},
						${`/icons/h${heroId}.png`}, now())`;
			return sql;
		};

		// Uncited: no criterion states the protocol's parameter ceiling, and this
		// is *A run leaves staging whole* exercised at the one size where "whole"
		// cannot be a single statement. The real reference holds 127 heroes, so
		// every run in production is past this line.
		test("a pair matrix too wide for one statement still lands whole", async () => {
			const sql = await clean();
			const matrix = pairs();

			await writeStaging(sql, PATCH, {
				positions: [],
				heroes: [],
				matchups: matrix,
				synergies: matrix,
			});

			const [written] = await sql`SELECT count(*)::int AS n
			FROM staging_hero_matchups WHERE hero_id >= 9000`;
			expect(written.n).toBe(matrix.length);
		});

		// spec: snapshot-ingest/a-run-that-fails-part-way
		test("a row refused in a later batch takes the earlier ones with it", async () => {
			const sql = await clean();
			const matrix = pairs();
			// Past the first batch: what this case is about is a statement refusing
			// after another has already succeeded, which one statement per table
			// could never produce.
			const refused = matrix[FIRST_BATCH + 1] as (typeof matrix)[number];
			refused.wins = refused.matches + 1;

			const failed = await writeStaging(sql, PATCH, {
				positions: [],
				heroes: [],
				matchups: matrix,
				synergies: [],
			}).then(
				() => null,
				(error: unknown) => error,
			);

			expect(failed).not.toBeNull();
			const [written] = await sql`SELECT count(*)::int AS n
			FROM staging_hero_matchups WHERE hero_id >= 9000`;
			expect(written.n).toBe(0);
		});
	},
);
