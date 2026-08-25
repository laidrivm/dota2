/**
 * What the build's three database-backed suites share: the two patches and two
 * heroes every case is seeded with, the staging one call writes, and the
 * connection that refuses a statistics write.
 *
 * `clean` is a parameter rather than something held here, because `cleaner()`
 * registers the `afterAll` that closes what it opened and so belongs to the
 * file whose cases it empties.
 */
import { expect } from "bun:test";
import type { SQL } from "bun";

export const HERO = 9001;
export const OTHER = 9002;

/** Two patches, so a build has a predecessor whose winrate it can blend. */
export const OLD_PATCH = "z9.40";
export const NEW_PATCH = "z9.41";

/**
 * One whole day into the new patch, so a major patch's prior is half its `k0`
 * — big enough to move a blend, small enough not to swamp the new patch's own
 * thousand matches.
 */
export const BUILT_AT = new Date("2026-08-02T03:00:00.000Z");

/** A connection holding both patches and both heroes, and nothing else. */
export async function seeded(clean: () => Promise<SQL>): Promise<SQL> {
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
export async function stage(
	sql: SQL,
	patchId: string,
	wins = 500,
): Promise<void> {
	// Replaced rather than added to, so a case can stage the same patch again
	// at a different winrate. The tables are discovered rather than named: one
	// added to the schema and left out of a list here is one whose rows
	// survive into the next call, and the build would read them.
	const staged = await sql`SELECT table_name FROM information_schema.columns
		WHERE table_schema = 'public' AND column_name = 'patch_id'
			AND table_name LIKE 'staging\_%'`;
	expect(staged.length).toBeGreaterThan(0);
	for (const { table_name } of staged)
		await sql.unsafe(`DELETE FROM ${table_name} WHERE patch_id = $1`, [
			patchId,
		]);
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
export const refusing = (sql: SQL): SQL =>
	new Proxy(sql, {
		get(target, key) {
			if (key === "begin")
				return () => Promise.reject(new Error("the statistics write refused"));
			const held = Reflect.get(target, key);
			return typeof held === "function" ? held.bind(target) : held;
		},
	});

/** Every statistics row of one snapshot, ordered, without its own id. */
export const statsOf = async (sql: SQL, id: number) => ({
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
