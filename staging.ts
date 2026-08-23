/**
 * The staging write: a patch's rows replaced whole, inside one transaction.
 *
 * Delete-then-insert rather than an upsert, because a run recomputes its whole
 * window rather than resuming a partial one — so a row the source no longer
 * reports has to disappear rather than survive under a key nothing overwrote.
 * That is also why no ledger of what has been pulled exists: the windows are a
 * function of the patch and the run instant, and the simplest idempotence is
 * accordingly the correct one.
 *
 * What produces the rows is `ingest.ts`; this file knows only how they land.
 */
import type { SQL } from "bun";
import type { HeroTotal } from "./contest.ts";
import type { PositionCount } from "./meta.ts";
import type { PairCount } from "./pairs.ts";

/** Everything one run writes, keyed by nothing until the write keys it. */
export type Staged = {
	positions: PositionCount[];
	heroes: HeroTotal[];
	matchups: PairCount[];
	synergies: PairCount[];
};

/**
 * Replace `patchId`'s staging rows with `staged`, inside one transaction.
 *
 * Delete-then-insert rather than an upsert: the run recomputes its whole
 * window, so a row the source no longer reports has to disappear rather than
 * survive from a previous run under a key nothing overwrote.
 *
 * Retention rides on the same statement: each table drops the rows of every
 * patch released before the one preceding this, and nothing else. A run
 * writing a newer patch is what ages an older one out, and nothing sweeps on
 * a schedule.
 *
 * `staging_hero_sides` and `staging_hero_phases` are not touched: side and
 * phase are this change's stated non-goals, nothing writes those tables, and
 * there is accordingly nothing in them to replace or retain.
 */
export async function writeStaging(
	sql: SQL,
	patchId: string,
	staged: Staged,
): Promise<void> {
	// The release instant of the patch before this one, or this one's own where
	// it is the first held. Retention is stated against it rather than against
	// a count of patches: dropping everything outside a kept *pair* would also
	// drop what is newer, and a run taken at an earlier instant — a backfill,
	// or last night's job repeated — is exactly how staging for a newer patch
	// would then disappear.
	const [held] = await sql`SELECT detected_at,
			(SELECT detected_at FROM patches WHERE detected_at < p.detected_at
				ORDER BY detected_at DESC LIMIT 1) AS previous
		FROM patches p WHERE p.patch_id = ${patchId}`;
	// Named here rather than left to the foreign key the inserts carry: a
	// patch nothing holds otherwise measures retention against `NULL`, which
	// ages nothing out, and then fails under a column's name.
	if (held === undefined)
		throw new Error(
			`staging cannot be written for patch ${patchId}, which no row holds`,
		);
	const oldest = held.previous ?? held.detected_at;

	const positions = staged.positions.map((row) => ({
		patch_id: patchId,
		hero_id: row.heroId,
		position: row.position,
		matches: row.matches,
		wins: row.wins,
	}));
	const heroes = staged.heroes.map((row) => ({
		patch_id: patchId,
		hero_id: row.heroId,
		matches: row.matches,
		wins: row.wins,
		contest_rate: row.contestRate,
	}));
	const pairs = (rows: PairCount[], other: "enemy_id" | "ally_id") =>
		rows.map((row) => ({
			patch_id: patchId,
			hero_id: row.heroId,
			[other]: row.otherId,
			matches: row.matches,
			wins: row.wins,
		}));
	const matchups = pairs(staged.matchups, "enemy_id");
	const synergies = pairs(staged.synergies, "ally_id");

	await sql.begin(async (tx) => {
		// One statement per table rather than a clear and a sweep: the current
		// patch's rows are being replaced and anything released before the
		// previous patch is being aged out, and both are the same `DELETE`.
		// One fragment embedded in four statements rather than executed once
		// and read back: it is built on `tx`, so each `DELETE` carries it as a
		// subquery inside the transaction.
		const aged = tx`SELECT patch_id FROM patches WHERE detected_at < ${oldest}`;
		await tx`DELETE FROM staging_hero_position_stats
			WHERE patch_id = ${patchId} OR patch_id IN (${aged})`;
		await tx`DELETE FROM staging_hero_stats
			WHERE patch_id = ${patchId} OR patch_id IN (${aged})`;
		await tx`DELETE FROM staging_hero_matchups
			WHERE patch_id = ${patchId} OR patch_id IN (${aged})`;
		await tx`DELETE FROM staging_hero_synergies
			WHERE patch_id = ${patchId} OR patch_id IN (${aged})`;

		// Guarded because the bulk form builds its column list from the rows: an
		// empty array has none, and the statement it would produce is not SQL.
		if (positions.length > 0)
			await tx`INSERT INTO staging_hero_position_stats ${tx(positions, "patch_id", "hero_id", "position", "matches", "wins")}`;
		if (heroes.length > 0)
			await tx`INSERT INTO staging_hero_stats ${tx(heroes, "patch_id", "hero_id", "matches", "wins", "contest_rate")}`;
		if (matchups.length > 0)
			await tx`INSERT INTO staging_hero_matchups ${tx(matchups, "patch_id", "hero_id", "enemy_id", "matches", "wins")}`;
		if (synergies.length > 0)
			await tx`INSERT INTO staging_hero_synergies ${tx(synergies, "patch_id", "hero_id", "ally_id", "matches", "wins")}`;
	});
}
