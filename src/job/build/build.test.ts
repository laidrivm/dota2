/**
 * The build against a database: what two runs over the same staging produce,
 * which snapshot a blend reads its `wr_old` from, and what a pair's rows
 * carry.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

/**
 * One connection for the whole file, emptied before each case that asks.
 * `opener` pools per call, so a cleaner per describe is three pools for one
 * suite.
 */
const clean = cleaner();

const HERO = 9001;
const OTHER = 9002;

/** Two patches, so a build has a predecessor whose winrate it can blend. */
const OLD_PATCH = "z9.40";
const NEW_PATCH = "z9.41";

/**
 * One whole day into the new patch, so a major patch's prior is half its `k0`
 * — big enough to move a blend, small enough not to swamp the new patch's own
 * thousand matches.
 */
const BUILT_AT = new Date("2026-08-02T03:00:00.000Z");

/** A connection holding both patches and both heroes, and nothing else. */
async function seeded(): Promise<SQL> {
	const sql = await clean();
	for (const heroId of [HERO, OTHER])
		await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
			VALUES (${heroId}, ${`H${heroId}`}, ${`h${heroId}`},
				${`/icons/h${heroId}.png`}, now())`;
	for (const [patchId, at] of [
		[OLD_PATCH, "2026-07-01T00:00:00.000Z"],
		[NEW_PATCH, "2026-08-01T00:00:00.000Z"],
	] as const)
		await sql`INSERT INTO patches (patch_id, base_version, is_major, detected_at)
			VALUES (${patchId}, ${patchId}, true, ${new Date(at)})`;
	return sql;
}

/** One patch's staging, every hero at `wins` of a thousand matches. */
async function stage(sql: SQL, patchId: string, wins = 500): Promise<void> {
	// Replaced rather than added to, so a case can stage the same patch again
	// at a different winrate.
	for (const table of [
		"staging_hero_position_stats",
		"staging_hero_stats",
		"staging_hero_matchups",
		"staging_hero_synergies",
		"staging_hero_sides",
		"staging_hero_phases",
	])
		await sql.unsafe(`DELETE FROM ${table} WHERE patch_id = $1`, [patchId]);
	await sql`INSERT INTO staging_hero_position_stats
			(patch_id, hero_id, position, matches, wins)
		VALUES (${patchId}, ${HERO}, 1, 1000, ${wins}),
			(${patchId}, ${OTHER}, 3, 1000, ${wins})`;
	await sql`INSERT INTO staging_hero_stats
			(patch_id, hero_id, matches, wins, contest_rate)
		VALUES (${patchId}, ${HERO}, 1000, ${wins}, 0.2),
			(${patchId}, ${OTHER}, 1000, ${wins}, 0.1)`;
	// The two directions disagree, as a source answering per hero over its own
	// window does: 240 of 400 from one end, 230 of 380 from the other. A build
	// that computed each row instead of negating one would store two magnitudes
	// here, and the pair would stop summing to 0.
	await sql`INSERT INTO staging_hero_matchups
			(patch_id, hero_id, enemy_id, matches, wins)
		VALUES (${patchId}, ${HERO}, ${OTHER}, 400, 240),
			(${patchId}, ${OTHER}, ${HERO}, 380, 150)`;
	await sql`INSERT INTO staging_hero_synergies
			(patch_id, hero_id, ally_id, matches, wins)
		VALUES (${patchId}, ${HERO}, ${OTHER}, 300, 180),
			(${patchId}, ${OTHER}, ${HERO}, 300, 180)`;
	// Side and phase are staged even though no pull fills them, because the
	// build decides a component measured by whether staging holds any row —
	// and with none, every component column is 0 whatever the build read, and
	// half of what a snapshot carries goes unexercised.
	await sql`INSERT INTO staging_hero_sides
			(patch_id, hero_id, side, matches, wins)
		VALUES (${patchId}, ${HERO}, 'radiant', 500, 300),
			(${patchId}, ${HERO}, 'dire', 500, 200),
			(${patchId}, ${OTHER}, 'radiant', 500, 250),
			(${patchId}, ${OTHER}, 'dire', 500, 250)`;
	await sql`INSERT INTO staging_hero_phases
			(patch_id, hero_id, phase, matches, wins)
		VALUES (${patchId}, ${HERO}, '1', 400, 220),
			(${patchId}, ${HERO}, '2', 400, 200),
			(${patchId}, ${HERO}, 'last', 200, 90),
			(${patchId}, ${OTHER}, '1', 400, 200),
			(${patchId}, ${OTHER}, '2', 400, 200),
			(${patchId}, ${OTHER}, 'last', 200, 100)`;
}

/**
 * The same connection with its statistics write refusing.
 *
 * A stub, because no staging row the schema admits can make that write fail:
 * every CHECK and foreign key on the four output tables is mirrored on the
 * staging table it is read from, so the raise this case is about has no data
 * that produces it.
 */
const refusing = (sql: SQL): SQL =>
	new Proxy(sql, {
		get(target, key) {
			if (key === "begin")
				return () => Promise.reject(new Error("the statistics write refused"));
			const held = Reflect.get(target, key);
			return typeof held === "function" ? held.bind(target) : held;
		},
	});

/** Every statistics row of one snapshot, ordered, without its own id. */
const statsOf = async (sql: SQL, id: number) => ({
	positions: await sql`SELECT hero_id, position, matches, pick_share, meta_adj,
			sufficient
		FROM hero_position_stats WHERE snapshot_id = ${id}
		ORDER BY hero_id, position`,
	heroes: await sql`SELECT hero_id, matches, contest_rate, side_adj_radiant,
			side_adj_dire, phase_adj_1, phase_adj_2, phase_adj_last, sufficient
		FROM hero_stats WHERE snapshot_id = ${id} ORDER BY hero_id`,
	matchups: await sql`SELECT hero_id, enemy_id, matches, advantage_adj
		FROM hero_matchups WHERE snapshot_id = ${id} ORDER BY hero_id`,
	synergies: await sql`SELECT hero_id, ally_id, matches, synergy_adj
		FROM hero_synergies WHERE snapshot_id = ${id} ORDER BY hero_id`,
});

describe.skipIf(url === undefined)("what a build produces", () => {
	// spec: snapshot-build/same-inputs-same-snapshot
	test("two builds over one staging and one instant agree field by field [25]", async () => {
		const sql = await seeded();
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
		const sql = await seeded();
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
		const sql = await seeded();

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
		const sql = await seeded();
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
		const sql = await seeded();
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
		const sql = await seeded();
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
		const sql = await seeded();
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
		const sql = await seeded();
		await stage(sql, OLD_PATCH);

		expect(
			await priorOf(sql, OLD_PATCH, new Date("2026-07-02T00:00:00.000Z")),
		).toEqual({ prior_patch_id: null, prior_weight: 0 });
	});

	test("a prior decayed to 0 records no prior patch either [69]", async () => {
		const sql = await seeded();
		await stage(sql, NEW_PATCH);

		// Four days into a major patch is where the previous one stops
		// counting, and a patch that counts for nothing is not one the row
		// names.
		expect(
			await priorOf(sql, NEW_PATCH, new Date("2026-08-05T00:00:00.000Z")),
		).toEqual({ prior_patch_id: null, prior_weight: 0 });
	});

	test("a predecessor that never published leaves the blend alone [70]", async () => {
		const sql = await seeded();
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
		const sql = await seeded();

		await buildSnapshot(sql, "z9.99", BUILT_AT).then(
			() => expect.unreachable(),
			(error: Error) => expect(error.message).toContain("z9.99"),
		);
	});
});

describe.skipIf(url === undefined)("the symmetry a pair is stored with", () => {
	/** One snapshot over the staging both cases below read. */
	const built = async () => {
		const sql = await seeded();
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
