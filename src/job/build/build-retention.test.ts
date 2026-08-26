/**
 * What retention keeps and what it drops.
 *
 * The count is the easy half. The rest is what the count would carry off: the
 * snapshot the current blend still reads `wr_old` from, kept whatever its age
 * and kept no longer once that prior has decayed to nothing; and the newest
 * published snapshot, which a run of failing builds walks out of a count taken
 * over snapshots at any status.
 *
 * Each exemption is here in both directions, because the wrong shape of it
 * still passes half the cases: exempting every patch's newest published
 * snapshot passes [48] and fails [90], and exempting none passes [90] and
 * fails [48] and [91].
 */
import { describe, expect, test } from "bun:test";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import {
	BUILT_AT,
	NEW_PATCH,
	OLD_PATCH,
	OTHER,
	seeded,
	stage,
} from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

/** `n` builds of one patch at one instant, returning every id in order. */
const repeatedly = async (
	sql: Awaited<ReturnType<typeof seeded>>,
	patchId: string,
	at: Date,
	n: number,
): Promise<number[]> => {
	const built: number[] = [];
	for (let done = 0; done < n; done++)
		built.push(await buildSnapshot(sql, patchId, at));
	return built;
};

/** Whether the snapshot is still there at all. */
const survives = async (
	sql: Awaited<ReturnType<typeof seeded>>,
	id: number,
): Promise<boolean> =>
	(await sql`SELECT snapshot_id FROM snapshots WHERE snapshot_id = ${id}`)
		.length === 1;

describe.skipIf(url === undefined)("what retention keeps", () => {
	// spec: snapshot-build/the-thirty-first-snapshot
	test("a thirty-first snapshot leaves thirty, the oldest gone [17]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);

		const built = await repeatedly(sql, NEW_PATCH, BUILT_AT, 31);

		const held = await sql`SELECT snapshot_id FROM snapshots
			ORDER BY snapshot_id`;
		// The whole set rather than its first member: this says the oldest went
		// and that nothing else did, which a check on the first id alone would
		// pass for a retention dropping several.
		expect(
			held.map((row: { snapshot_id: number }) => Number(row.snapshot_id)),
		).toEqual(built.slice(1));
		// The statistics went with it. The tables are discovered by the column
		// every one of them carries rather than named, so a statistics table
		// added outside the cascade leaves rows here instead of going unseen.
		const tables = await sql`SELECT table_name FROM information_schema.columns
			WHERE table_schema = 'public' AND column_name = 'snapshot_id'
				AND table_name <> 'snapshots'`;
		expect(tables.length).toBeGreaterThan(0);
		for (const { table_name } of tables) {
			const [row] = await sql.unsafe(
				`SELECT count(*)::int AS remaining FROM ${table_name}
					WHERE snapshot_id = $1`,
				[built[0]],
			);
			// Named in the assertion so a failure says which table kept them.
			expect([table_name, row.remaining]).toEqual([table_name, 0]);
		}
	});

	// spec: snapshot-build/builds-faster-than-the-prior-decays
	test("thirty builds in a day keep the prior's published snapshot [48]", async () => {
		const sql = await seeded(clean);
		// A letter patch two days in, as the criterion names: its prior has not
		// decayed, so the previous patch is the one the blend reads `wr_old`
		// from and the one retention may not drop.
		await sql`UPDATE patches SET is_major = false WHERE patch_id = ${NEW_PATCH}`;
		await stage(sql, OLD_PATCH);
		const prior = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await stage(sql, NEW_PATCH);

		await repeatedly(sql, NEW_PATCH, new Date("2026-08-03T00:00:00.000Z"), 30);

		// Thirty snapshots of this patch fill the count by themselves, so the
		// prior's is the thirty-first by age and survives only by being exempt.
		expect(await survives(sql, prior)).toBe(true);
	});

	test("thirty failing builds do not carry off the published one [91]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const published = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		// Every build after this one has a hero fewer than the published
		// snapshot holds, so the count refuses it — and a refused build leaves
		// its row behind, which is what walks the published one out of a count
		// taken over snapshots at any status.
		await sql`DELETE FROM staging_hero_stats
			WHERE patch_id = ${NEW_PATCH} AND hero_id = ${OTHER}`;

		await repeatedly(sql, NEW_PATCH, BUILT_AT, 30);

		expect(await survives(sql, published)).toBe(true);
	});

	// spec: snapshot-build/a-prior-that-has-decayed
	test("a prior decayed to nothing is exempt no longer [90]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH);
		const prior = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await stage(sql, NEW_PATCH);

		// Five days into a major patch, one past the window its prior decays
		// over: there is no `wr_old` left to read, so nothing holds the older
		// snapshot back from the count.
		await repeatedly(sql, NEW_PATCH, new Date("2026-08-06T00:00:00.000Z"), 30);

		expect(await survives(sql, prior)).toBe(false);
	});
});
