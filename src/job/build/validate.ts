/**
 * Whether a snapshot's computed rows may be published, and why not.
 *
 * Pure, like the arithmetic it checks: `build.ts` hands it the rows it just
 * wrote and the one number that has to come from the database, and gets back
 * the reason to fail on or nothing. Keeping it here is what lets every check
 * be read against a case without a database in front of it
 * (design.md §*The arithmetic is a pure module*).
 *
 * A reason rather than a boolean because a snapshot at `status = 'failed'`
 * carries no record of which check refused it, and the string is what a test
 * asserts instead of re-deriving the arithmetic.
 */
import type { SnapshotRows } from "./rows.ts";

/**
 * How far a hero's position shares may sum from 1 and still be a
 * distribution, fixed by the criterion rather than chosen here: they are
 * computed by division and summed in binary floating point, so exact 1 is
 * not a bound any correct implementation meets.
 */
const SHARE_TOLERANCE = 1e-6;

/**
 * Why this snapshot may not publish, or `undefined` where every check passes.
 *
 * `publishedHeroes` is the hero count of the newest published snapshot, and 0
 * where none has ever published — which is why the first snapshot ever built
 * passes a check it has nothing to compare against, rather than being held
 * back forever by a comparison that can never be satisfied.
 */
export function invalidReason(
	rows: SnapshotRows,
	publishedHeroes: number,
): string | undefined {
	if (rows.heroes.length < publishedHeroes)
		return `${rows.heroes.length} hero rows against the ${publishedHeroes} the newest published snapshot holds`;

	// Summed per hero rather than checked per row: a share is only a share
	// against the hero's other positions, and a hero the window never picked
	// has no rows here at all — which is no broken distribution, so it never
	// enters this map rather than being compared against a sum of 0.
	const shares = new Map<number, number>();
	for (const row of rows.positions)
		shares.set(row.hero_id, (shares.get(row.hero_id) ?? 0) + row.pick_share);
	// Written as a refused pass rather than a detected failure, so that a sum
	// that is not a number fails: every comparison against `NaN` is false, and
	// `> SHARE_TOLERANCE` would read it as within tolerance.
	for (const [heroId, sum] of shares)
		if (!(Math.abs(sum - 1) <= SHARE_TOLERANCE))
			return `hero ${heroId}'s position shares sum to ${sum}`;

	return undefined;
}
