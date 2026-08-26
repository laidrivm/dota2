/**
 * Retention: what a build keeps and what it drops.
 *
 * Called inside the transaction that settles a snapshot's status, so the
 * statistics, the status and this commit together or roll back together. The
 * `snapshots` row itself is outside that transaction and survives a rollback,
 * which is what leaves the caller something to mark `failed`. Lifted out of
 * `build.ts` when that file reached the per-file cap, which is the seam the
 * cap found: the count and its exemptions are one decision, and nothing else
 * in the build reads them.
 */
import type { SQL } from "bun";
import { prior, wholeDays } from "./blend.ts";

/**
 * How many snapshots retention keeps, beyond the two exemptions below, fixed
 * by the criterion rather than chosen here — *Snapshot retention*, which
 * takes it from data-model §3.2. This is the only place the number stands.
 */
const RETAINED = 30;

/** What joins the exemption list, and what no patch id may contain. */
const SEPARATOR = ",";

/** Drop every snapshot the count and the exemptions below leave out. */
export async function retain(tx: SQL, at: Date): Promise<void> {
	// Retention runs inside the caller's transaction rather than after it, so
	// a build never publishes a snapshot it then failed to make room for, and
	// never drops one for a snapshot that rolled back. The statistics rows
	// go with the snapshot through the schema's cascade, so this is the
	// whole of it: no table is named, and one added under that cascade is
	// collected by carrying it.
	//
	// The count alone would be safe only while builds are at most daily,
	// and nothing here bounds how often the job runs — so what a blend may
	// still read is exempt from it whatever its age. Every patch whose
	// prior is still weighing, not just the one this build resolved: a
	// build of one patch must not carry off what a build of another would
	// read, and which patch is built next is not this function's to know.
	//
	// The newest published snapshot is exempt on the same terms, and for a
	// reason the count hides: it is taken over snapshots at any status, so
	// a run of failing builds — whose rows stay — walks the last published
	// one out of it, and that is the snapshot the export renders from.
	await tx`DELETE FROM snapshots
		WHERE snapshot_id NOT IN (
				SELECT snapshot_id FROM snapshots
				ORDER BY snapshot_id DESC LIMIT ${RETAINED}
			)
			AND snapshot_id NOT IN (
				SELECT DISTINCT ON (patch_id) snapshot_id FROM snapshots
				WHERE status = 'published'
					AND patch_id = ANY(string_to_array(${await stillRead(tx, at)}, ','))
				ORDER BY patch_id, snapshot_id DESC
			)
			AND snapshot_id IS DISTINCT FROM (
				SELECT snapshot_id FROM snapshots
				WHERE status = 'published' ORDER BY snapshot_id DESC LIMIT 1
			)`;
}

/**
 * Every patch a blend may still read `wr_old` from as of `at`, joined by
 * commas: the predecessor of each patch whose own prior has not yet decayed
 * to nothing.
 *
 * Decided here rather than in the statement that uses it, because the decay
 * is `blend.ts`'s parameter table and writing that curve again in SQL would
 * be a second copy of the one thing the requirement fixes. Usually one patch,
 * and empty once every window has closed — which `string_to_array` reads as
 * an empty array, exempting nothing.
 *
 * A joined string rather than an array because bun 1.3.14 sends a JS array as
 * its own elements joined by commas, so `= ANY($1)` reaches Postgres as a
 * malformed array literal — measured. The join is therefore explicit, and a
 * patch id carrying the separator would split into two ids that match no
 * patch and quietly drop an exemption, so it raises instead.
 */
async function stillRead(sql: SQL, at: Date): Promise<string> {
	const patches = await sql`SELECT is_major, detected_at,
			(SELECT patch_id FROM patches WHERE detected_at < p.detected_at
				ORDER BY detected_at DESC LIMIT 1) AS previous
		FROM patches p`;
	const read: string[] = patches
		.filter(
			(patch: {
				is_major: boolean;
				detected_at: Date;
				previous: string | null;
			}) =>
				patch.previous !== null &&
				prior(
					patch.is_major ? "major" : "letter",
					wholeDays(patch.detected_at, at),
				) > 0,
		)
		.map((patch: { previous: string }) => patch.previous);
	const carrying = read.find((patchId) => patchId.includes(SEPARATOR));
	if (carrying !== undefined)
		throw new Error(
			`patch id ${carrying} carries ${SEPARATOR}, which the exemption list uses to separate ids`,
		);
	return read.join(SEPARATOR);
}
