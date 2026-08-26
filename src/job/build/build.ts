/**
 * The build's database edge: read one patch's staging, compute, write the
 * statistics rows of a new snapshot.
 *
 * It reaches nothing but this connection. Everything the arithmetic needs —
 * the patch's kind and age, the previous patch's winrates — is already in the
 * database the ingest filled, so a build runs with every other network call
 * refusing.
 *
 * The snapshot ends at `published` or at `failed`, never at `building`: the
 * row passes through that state while the statistics are written, and the
 * validation below decides which of the two it settles at. Retention is the
 * next group's. The row's id is returned so both outcomes have something to
 * name.
 */
import type { SQL } from "bun";
import { isMeasured, prior, wholeDays, wrOf } from "./blend.ts";
import { retain } from "./retention.ts";
import { type Prior, priorKey, type Staging, snapshotRows } from "./rows.ts";
import { invalidReason } from "./validate.ts";

/**
 * Build a snapshot of `patchId` as of `at`, and return its `snapshot_id`.
 *
 * `at` is an argument rather than a clock reading, so a build over unchanged
 * staging is reproducible: it is written to `created_at`, it is what the decay
 * is measured to, and it is the one clock `stabilizing` is later read off.
 */
export async function buildSnapshot(
	sql: SQL,
	patchId: string,
	at: Date,
): Promise<number> {
	const [patch] = await sql`SELECT is_major, detected_at,
			(SELECT patch_id FROM patches WHERE detected_at < p.detected_at
				ORDER BY detected_at DESC LIMIT 1) AS previous
		FROM patches p WHERE p.patch_id = ${patchId}`;
	// Named here rather than left to the foreign key the insert carries, which
	// would report a constraint instead of a missing patch.
	if (patch === undefined)
		throw new Error(`no patch row holds ${patchId}, so nothing builds from it`);

	// No predecessor and a decayed one are the same weight and the same NULL:
	// in both cases there is no winrate to pull the current patch towards.
	const weight =
		patch.previous === null
			? 0
			: prior(
					patch.is_major ? "major" : "letter",
					wholeDays(patch.detected_at, at),
				);
	const priorPatchId = weight === 0 ? null : patch.previous;

	// Outside the transaction below, and deliberately: a build that raises
	// part way is specified to leave its snapshot at `failed`, never at
	// `building`, and a row rolled back with the statistics is a row the next
	// group has nothing to mark. What rolls back is the statistics alone.
	// Read before the row is created, because the verdict below is written
	// onto it. A staging read that raises therefore leaves no snapshot at all,
	// which is what a run that could not read its own inputs should leave.
	const staging = await read(sql, patchId);
	// Taken once for the whole snapshot and recorded on it: a stored delta of 0
	// cannot afterwards say whether the component was measured and neutral or
	// never measured, and the next patch's blend reads these rows back.
	const side = isMeasured(staging.sides);
	const phase = isMeasured(staging.phases);

	const [created] = await sql`INSERT INTO snapshots
		(created_at, patch_id, prior_patch_id, prior_weight, status,
			side_measured, phase_measured)
		VALUES (${at}, ${patchId}, ${priorPatchId}, ${weight}, 'building',
			${side}, ${phase})
		RETURNING snapshot_id`;
	const snapshotId = Number(created.snapshot_id);

	try {
		await write(sql, snapshotId, staging, weight, priorPatchId, at);
	} catch (error) {
		// `building` is a state a snapshot passes through, never one it is left
		// in, and the row above was written outside the transaction for exactly
		// this: what rolls back is the statistics *and the status the same
		// transaction settles*, and the row survives to be marked. This is the
		// `failed` a raise reaches; the one inside `write` is the `failed` a
		// validation reaches, and they are not the same path.
		try {
			await sql`UPDATE snapshots SET status = 'failed'
				WHERE snapshot_id = ${snapshotId}`;
		} catch {
			// Swallowed as `db.ts` swallows its own close: what the caller needs
			// is why the build raised, not why the marking afterwards did not.
		}
		throw error;
	}
	return snapshotId;
}

/**
 * How many hero rows the newest published snapshot holds, and 0 where none
 * has ever published.
 *
 * 0 rather than an absence, because the check it feeds is a floor: with no
 * published snapshot there is no count to fall below, and a first snapshot
 * that could never publish would leave every later one comparing against
 * nothing forever.
 */
async function publishedHeroes(sql: SQL): Promise<number> {
	const [row] = await sql`SELECT count(*)::int AS heroes FROM hero_stats
		WHERE snapshot_id = (SELECT snapshot_id FROM snapshots
			WHERE status = 'published' ORDER BY snapshot_id DESC LIMIT 1)`;
	return row.heroes;
}

/**
 * Compute one snapshot's rows, insert them, and settle its status — the
 * insert and the settling in one transaction, so no snapshot is left at
 * `building` with its statistics committed beside it. Validation reads the
 * rows rather than the database they are about to go into, which is what lets
 * the verdict be known before the transaction opens.
 */
async function write(
	sql: SQL,
	snapshotId: number,
	staging: Staging,
	weight: number,
	priorPatchId: string | null,
	at: Date,
): Promise<void> {
	const rows = snapshotRows(staging, {
		weight,
		wrOld: await previousWinrates(sql, priorPatchId),
	});
	// Read while this snapshot is still `building`, so the count is what was
	// newest before this build — and stays that way if the checks refuse.
	// ponytail: the reason is decided and dropped. Nothing carries it because
	// nothing reads it yet; a column on `snapshots`, or a line the entry point
	// logs, arrives when group 12 has to report why a run produced no bundle.
	const invalid = invalidReason(rows, staging, await publishedHeroes(sql));

	await sql.begin(async (tx) => {
		// `snapshot_id` added here, being the one field `rows.ts` cannot know.
		// Guarded as `staging.ts` guards its own: the bulk form builds its column
		// list from the rows, and an empty array has none.
		const of = (written: { [key: string]: unknown }[]) =>
			written.map((row) => ({ snapshot_id: snapshotId, ...row }));
		if (rows.positions.length > 0)
			await tx`INSERT INTO hero_position_stats ${tx(of(rows.positions))}`;
		if (rows.heroes.length > 0)
			await tx`INSERT INTO hero_stats ${tx(of(rows.heroes))}`;
		if (rows.matchups.length > 0)
			await tx`INSERT INTO hero_matchups ${tx(of(rows.matchups))}`;
		if (rows.synergies.length > 0)
			await tx`INSERT INTO hero_synergies ${tx(of(rows.synergies))}`;
		// Inside, so that the statistics and the verdict over them commit
		// together: a connection lost between the two would otherwise leave a
		// snapshot at `building` that nothing afterwards has cause to mark.
		await tx`UPDATE snapshots SET status =
				${invalid === undefined ? "published" : "failed"}
			WHERE snapshot_id = ${snapshotId}`;
		await retain(tx, at);
	});
}

/**
 * One patch's staging, aliased to the names the arithmetic uses so that the
 * mapping between column and field lives in one statement each.
 *
 * Every read is ordered. Nothing downstream depends on the order of a sum,
 * but two builds over identical staging are specified to produce identical
 * rows, and an unordered read makes that true only by accident.
 */
async function read(sql: SQL, patchId: string): Promise<Staging> {
	return {
		positions: await sql`SELECT hero_id AS "heroId", position, matches, wins
			FROM staging_hero_position_stats WHERE patch_id = ${patchId}
			ORDER BY hero_id, position`,
		heroes: await sql`SELECT hero_id AS "heroId", matches,
				contest_rate AS "contestRate"
			FROM staging_hero_stats WHERE patch_id = ${patchId} ORDER BY hero_id`,
		matchups: await sql`SELECT hero_id AS "heroId", enemy_id AS "otherId",
				matches, wins
			FROM staging_hero_matchups WHERE patch_id = ${patchId}
			ORDER BY hero_id, enemy_id`,
		synergies: await sql`SELECT hero_id AS "heroId", ally_id AS "otherId",
				matches, wins
			FROM staging_hero_synergies WHERE patch_id = ${patchId}
			ORDER BY hero_id, ally_id`,
		sides: await sql`SELECT hero_id AS "heroId", side AS part, matches, wins
			FROM staging_hero_sides WHERE patch_id = ${patchId}
			ORDER BY hero_id, side`,
		phases: await sql`SELECT hero_id AS "heroId", phase AS part, matches, wins
			FROM staging_hero_phases WHERE patch_id = ${patchId}
			ORDER BY hero_id, phase`,
	};
}

/**
 * The winrate every statistic had in `priorPatchId`'s newest published
 * snapshot, empty where there is no prior patch to read.
 *
 * Newest *published*: a `building` snapshot is one a run is part way through
 * and a `failed` one is a snapshot that never validated, and reading either
 * would blend against numbers nothing accepted. Retention keeps this snapshot
 * whatever its age for exactly this read.
 */
async function previousWinrates(
	sql: SQL,
	priorPatchId: string | null,
): Promise<Prior["wrOld"]> {
	const wrOld = new Map<string, number>();
	if (priorPatchId === null) return wrOld;
	const [previous] = await sql`SELECT snapshot_id, side_measured, phase_measured
		FROM snapshots
		WHERE patch_id = ${priorPatchId} AND status = 'published'
		ORDER BY snapshot_id DESC LIMIT 1`;
	if (previous === undefined) return wrOld;
	const id = previous.snapshot_id;

	for (const row of await sql`SELECT hero_id, position, meta_adj
		FROM hero_position_stats WHERE snapshot_id = ${id}`)
		wrOld.set(
			priorKey("position", row.hero_id, row.position),
			wrOf(row.meta_adj),
		);
	for (const row of await sql`SELECT hero_id, side_adj_radiant, side_adj_dire,
			phase_adj_1, phase_adj_2, phase_adj_last
		FROM hero_stats WHERE snapshot_id = ${id}`) {
		// Only what that snapshot measured. Its 0 for an unmeasured component
		// is not a winrate of 50 — it is no reading at all, and offered as
		// `wr_old` it would pull this patch's real deltas towards a number
		// nobody measured, exactly as an absent `wr_old` must not.
		if (previous.side_measured) {
			wrOld.set(
				priorKey("side", row.hero_id, "radiant"),
				wrOf(row.side_adj_radiant),
			);
			wrOld.set(priorKey("side", row.hero_id, "dire"), wrOf(row.side_adj_dire));
		}
		if (previous.phase_measured) {
			wrOld.set(priorKey("phase", row.hero_id, "1"), wrOf(row.phase_adj_1));
			wrOld.set(priorKey("phase", row.hero_id, "2"), wrOf(row.phase_adj_2));
			wrOld.set(
				priorKey("phase", row.hero_id, "last"),
				wrOf(row.phase_adj_last),
			);
		}
	}
	// The lower id's row alone, which is the direction `rows.ts` looks a pair
	// up under; the mirrored row carries the same number negated.
	for (const row of await sql`SELECT hero_id, enemy_id, advantage_adj
		FROM hero_matchups WHERE snapshot_id = ${id} AND hero_id < enemy_id`)
		wrOld.set(
			priorKey("matchup", row.hero_id, row.enemy_id),
			wrOf(row.advantage_adj),
		);
	for (const row of await sql`SELECT hero_id, ally_id, synergy_adj
		FROM hero_synergies WHERE snapshot_id = ${id}`)
		wrOld.set(
			priorKey("synergy", row.hero_id, row.ally_id),
			wrOf(row.synergy_adj),
		);
	return wrOld;
}
