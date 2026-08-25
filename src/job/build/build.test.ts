/**
 * The build against a database: what two runs over the same staging produce,
 * that it reaches nothing but that database, and what a run it cannot finish
 * leaves behind.
 *
 * Which snapshot a blend reads `wr_old` from is `build-prior.test.ts`'s, and
 * the symmetry of the pair rows is `build-pairs.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import {
	BUILT_AT,
	HERO,
	NEW_PATCH,
	OLD_PATCH,
	refusing,
	seeded,
	stage,
	statsOf,
} from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

describe.skipIf(url === undefined)("what a build produces", () => {
	// spec: snapshot-build/same-inputs-same-snapshot
	test("two builds over one staging and one instant agree field by field [25]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const first = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const second = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		expect(second).not.toBe(first);
		expect(await statsOf(sql, second)).toEqual(await statsOf(sql, first));
		expect(
			await sql`SELECT DISTINCT created_at FROM snapshots
				WHERE snapshot_id IN (${first}, ${second})`,
		).toHaveLength(1);
	});

	// spec: snapshot-build/the-build-reaches-for-the-network
	test("a build completes with every call but its database refusing [26]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const fetched = globalThis.fetch;
		globalThis.fetch = (() => {
			throw new Error("the build reached the network");
		}) as unknown as typeof fetch;

		try {
			expect(await buildSnapshot(sql, NEW_PATCH, BUILT_AT)).toBeGreaterThan(0);
		} finally {
			globalThis.fetch = fetched;
		}
	});

	test("a patch nothing was staged for writes no statistics rows [81]", async () => {
		const sql = await seeded(clean);

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// Four guards stand between here and an insert whose column list is
		// built from an empty array, which is not SQL — so all four tables are
		// read, not the one the first guard covers.
		const written = await statsOf(sql, built);
		expect(written.positions).toHaveLength(0);
		expect(written.heroes).toHaveLength(0);
		expect(written.matchups).toHaveLength(0);
		expect(written.synergies).toHaveLength(0);
	});

	test("a matchup's wr_old reaches the blend from the previous snapshot [82]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH, 500);
		// The old patch's own pair rows say hero 1 wins six of ten, so its
		// published snapshot carries a positive advantage for the pair.
		const published = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await sql`UPDATE snapshots SET status = 'published' WHERE snapshot_id = ${published}`;
		await stage(sql, NEW_PATCH, 500);
		// The new patch's own pair rows say exactly even, so anything the stored
		// delta carries came from the pair key `build.ts` wrote and `rows.ts`
		// read — a key the two spell differently leaves it at 0.
		await sql`UPDATE staging_hero_matchups SET wins = 200, matches = 400
			WHERE patch_id = ${NEW_PATCH}`;

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const [row] = await sql`SELECT advantage_adj FROM hero_matchups
			WHERE snapshot_id = ${built} AND hero_id = ${HERO}`;
		expect(row.advantage_adj).toBeGreaterThan(0);
	});

	test("a side's wr_old reaches the blend from the previous snapshot [83]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH, 500);
		// The old patch staged hero 1 at six of ten on radiant, so its published
		// snapshot carries a positive radiant delta.
		const published = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await sql`UPDATE snapshots SET status = 'published' WHERE snapshot_id = ${published}`;
		await stage(sql, NEW_PATCH, 500);
		// The new patch's own side rows say exactly even on both, so anything
		// the stored delta carries came from the side key `build.ts` wrote and
		// `rows.ts` read.
		await sql`UPDATE staging_hero_sides SET wins = 250
			WHERE patch_id = ${NEW_PATCH}`;

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const [row] = await sql`SELECT side_adj_radiant, phase_adj_1 FROM hero_stats
			WHERE snapshot_id = ${built} AND hero_id = ${HERO}`;
		expect(row.side_adj_radiant).toBeGreaterThan(0);
		// Phase is staged unchanged, so its own matches carry it — a component
		// measured at all is not zeroed.
		expect(row.phase_adj_1).toBeGreaterThan(0);
	});

	// spec: snapshot-build/the-build-throws-part-way
	test("a build that raises leaves its snapshot failed, never building [23]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);

		await buildSnapshot(refusing(sql), NEW_PATCH, BUILT_AT).then(
			() => expect.unreachable(),
			(error: Error) => expect(error.message).toContain("refused"),
		);

		const held = await sql`SELECT status FROM snapshots
			WHERE patch_id = ${NEW_PATCH}`;
		expect(held).toHaveLength(1);
		expect(held[0].status).toBe("failed");
	});

	// spec: snapshot-build/the-predecessor-a-blend-reads
	test("a blend reads the predecessor's newest published snapshot [51]", async () => {
		const sql = await seeded(clean);
		// Three snapshots of the old patch, in this order: a published one at a
		// losing winrate, a published one at a winning winrate, and a `building`
		// one back at the losing rate. Only the middle one may be read, so the
		// blend below can only come out positive by having read it.
		for (const [wins, status] of [
			[300, "published"],
			[700, "published"],
			[300, "building"],
		] as const) {
			await stage(sql, OLD_PATCH, wins);
			const id = await buildSnapshot(
				sql,
				OLD_PATCH,
				new Date("2026-07-02T00:00:00.000Z"),
			);
			await sql`UPDATE snapshots SET status = ${status} WHERE snapshot_id = ${id}`;
		}
		// The new patch's own matches say exactly neutral, so every point of
		// the delta below comes from the prior.
		await stage(sql, NEW_PATCH, 500);

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const [row] = await sql`SELECT meta_adj FROM hero_position_stats
			WHERE snapshot_id = ${built} AND hero_id = ${HERO}`;
		expect(row.meta_adj).toBeGreaterThan(0);
	});
});
