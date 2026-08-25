/**
 * The symmetry a pair is stored with: a matchup as two rows that cancel, a
 * synergy as one.
 */
import { describe, expect, test } from "bun:test";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import {
	BUILT_AT,
	HERO,
	NEW_PATCH,
	OTHER,
	seeded,
	stage,
} from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

describe.skipIf(url === undefined)("the symmetry a pair is stored with", () => {
	/** One snapshot over the staging both cases below read. */
	const built = async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		return [sql, await buildSnapshot(sql, NEW_PATCH, BUILT_AT)] as const;
	};

	// spec: snapshot-build/a-matchup-pair
	test("a matchup's two rows carry deltas summing to 0 [21]", async () => {
		const [sql, id] = await built();

		const rows = await sql`SELECT hero_id, enemy_id, advantage_adj
			FROM hero_matchups WHERE snapshot_id = ${id} ORDER BY hero_id`;

		expect(rows).toHaveLength(2);
		// Non-zero first: two zeroes sum to 0 as well, and a build that stored
		// nothing would satisfy the sum on its own.
		expect(rows[0].advantage_adj).not.toBe(0);
		expect(rows[0].advantage_adj + rows[1].advantage_adj).toBe(0);
	});

	// spec: snapshot-build/a-synergy-pair
	test("a synergy staged from both sides is stored once [22]", async () => {
		const [sql, id] = await built();

		const rows = await sql`SELECT hero_id, ally_id, synergy_adj
			FROM hero_synergies WHERE snapshot_id = ${id}`;

		// That no mirrored row can exist is the schema's `ally_id > hero_id`,
		// not this build's; what is asserted here is the fold — staging holds
		// the pair from both heroes and one row comes out, carrying a delta.
		expect(rows).toHaveLength(1);
		expect(rows[0].hero_id).toBe(HERO);
		expect(rows[0].ally_id).toBe(OTHER);
		expect(rows[0].synergy_adj).not.toBe(0);
	});
});
