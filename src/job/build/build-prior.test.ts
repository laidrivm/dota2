/**
 * The previous patch's contribution: which of its snapshots a blend reads
 * `wr_old` from, which components of that snapshot may be read at all, and
 * what the row records when there is no prior to read.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import {
	BUILT_AT,
	HERO,
	NEW_PATCH,
	OLD_PATCH,
	seeded,
	stage,
} from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

describe.skipIf(url === undefined)("the prior a snapshot records", () => {
	/** The snapshot row `patchId` produced at `at`, prior columns only. */
	const priorOf = async (sql: SQL, patchId: string, at: Date) => {
		const id = await buildSnapshot(sql, patchId, at);
		const [row] = await sql`SELECT prior_patch_id, prior_weight
			FROM snapshots WHERE snapshot_id = ${id}`;
		return row;
	};

	// spec: snapshot-build/no-previous-patch-to-blend
	test("the oldest patch records no prior and no weight [68]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH);

		expect(
			await priorOf(sql, OLD_PATCH, new Date("2026-07-02T00:00:00.000Z")),
		).toEqual({ prior_patch_id: null, prior_weight: 0 });
	});

	test("a prior decayed to 0 records no prior patch either [69]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);

		// Four days into a major patch is where the previous one stops
		// counting, and a patch that counts for nothing is not one the row
		// names.
		expect(
			await priorOf(sql, NEW_PATCH, new Date("2026-08-05T00:00:00.000Z")),
		).toEqual({ prior_patch_id: null, prior_weight: 0 });
	});

	test("a predecessor that never published leaves the blend alone [70]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH, 900);
		const failed = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await sql`UPDATE snapshots SET status = 'failed' WHERE snapshot_id = ${failed}`;
		await stage(sql, NEW_PATCH, 500);

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// The prior carries weight — the patch is one day old — but the
		// predecessor holds no winrate anything accepted, so the new patch's
		// own neutral matches are the whole answer.
		const [row] = await sql`SELECT meta_adj FROM hero_position_stats
			WHERE snapshot_id = ${built} AND hero_id = ${HERO}`;
		expect(row.meta_adj).toBe(0);
	});

	test("a patch no row holds is refused by name [71]", async () => {
		const sql = await seeded(clean);

		await buildSnapshot(sql, "z9.99", BUILT_AT).then(
			() => expect.unreachable(),
			(error: Error) => expect(error.message).toContain("z9.99"),
		);
	});
});
