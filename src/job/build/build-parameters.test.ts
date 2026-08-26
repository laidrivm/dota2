/**
 * The build at a size one statement cannot carry.
 *
 * The PostgreSQL wire protocol counts bind parameters in a 16-bit field, so a
 * statement carries at most 65 535 of them — one per column per row. Every
 * other case here stages two heroes, where a matchup matrix is two rows; the
 * reference holds 127, where it is 16 002 of five columns and no single
 * statement can write it. This file is the one that crosses that line.
 */
import { describe, expect, test } from "bun:test";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { batches } from "../db.ts";
import { BUILT_AT, NEW_PATCH, seeded } from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

/**
 * The fewest heroes whose matchup matrix crosses the ceiling: 115 × 114 is
 * 13 110 rows of five columns — the four `rows.ts` produces plus the
 * `snapshot_id` the write adds — which is 65 550. At 114 the matrix falls 570
 * parameters short and the write that fails in production passes here.
 */
const CROSSING = 115;

describe.skipIf(url === undefined)("a build wider than one statement", () => {
	// Uncited: the ceiling is the wire protocol's rather than a criterion's,
	// and this is *A snapshot is published only after it validates* exercised
	// at the one size where the write cannot be a single statement.
	test("a matchup matrix too wide for one statement still publishes", async () => {
		const sql = await seeded(clean);
		const ids = Array.from({ length: CROSSING }, (_, n) => 9001 + n);
		for (const heroId of ids.slice(2))
			await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
				VALUES (${heroId}, ${`H${heroId}`}, ${`h${heroId}`},
					${`/icons/h${heroId}.png`}, now())`;
		for (const heroId of ids) {
			await sql`INSERT INTO staging_hero_position_stats
					(patch_id, hero_id, position, matches, wins)
				VALUES (${NEW_PATCH}, ${heroId}, 1, 100, 50)`;
			await sql`INSERT INTO staging_hero_stats
					(patch_id, hero_id, matches, wins, contest_rate)
				VALUES (${NEW_PATCH}, ${heroId}, 100, 50, 0.1)`;
		}
		const staged = ids.flatMap((heroId) =>
			ids
				.filter((enemy) => enemy !== heroId)
				.map((enemy) => ({
					patch_id: NEW_PATCH,
					hero_id: heroId,
					enemy_id: enemy,
					matches: 10,
					wins: 5,
				})),
		);
		// Batched here too, the arrangement being over the ceiling for the same
		// reason the write under test is. What this case asserts is what
		// `build.ts` does with the rows, not how they were seeded.
		for (const batch of batches(staged))
			await sql`INSERT INTO staging_hero_matchups ${sql(batch)}`;

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const [row] =
			await sql`SELECT status FROM snapshots WHERE snapshot_id = ${built}`;
		expect(row.status).toBe("published");
		const [written] = await sql`SELECT count(*)::int AS n FROM hero_matchups
			WHERE snapshot_id = ${built}`;
		expect(written.n).toBe(staged.length);
	});
});
