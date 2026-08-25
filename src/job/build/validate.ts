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
import type { HeroRow, SnapshotRows, SplitRow, Staging } from "./rows.ts";

/**
 * How far a hero's position shares may sum from 1 and still be a
 * distribution, fixed by the criterion rather than chosen here: they are
 * computed by division and summed in binary floating point, so exact 1 is
 * not a bound any correct implementation meets.
 */
const SHARE_TOLERANCE = 1e-6;

/**
 * How far from neutral a stored delta may lie, in percentage points. A
 * blended, smoothed winrate cannot reach 25 points off 50 from any sample
 * the arithmetic accepts, so a delta beyond it is a defect upstream rather
 * than an extreme patch.
 */
const ADJ_BOUND = 25;

/**
 * Why this snapshot may not publish, or `undefined` where every check passes.
 *
 * `publishedHeroes` is the hero count of the newest published snapshot, and 0
 * where none has ever published — which is why the first snapshot ever built
 * passes a check it has nothing to compare against, rather than being held
 * back forever by a comparison that can never be satisfied.
 *
 * `staging` is here for the last check alone: whether a component measured
 * some heroes and not others is a fact about the rows that were read, and the
 * rows that were written record it as a 0 indistinguishable from a measured
 * neutral one.
 */
export function invalidReason(
	rows: SnapshotRows,
	staging: Staging,
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

	// Every table, because every one of them stores a delta, and the check is
	// on the value rather than on which statistic produced it.
	const written = [
		...rows.positions,
		...rows.heroes,
		...rows.matchups,
		...rows.synergies,
	];
	for (const row of written) {
		const beyond = beyondBound(row);
		if (beyond !== undefined) return `${beyond} on hero ${row.hero_id}`;
	}

	return (
		partial("side", staging.sides, staging.heroes) ??
		partial("phase", staging.phases, staging.heroes)
	);
}

/** The first delta on this row that lies outside the bound, named. */
function beyondBound(row: { [column: string]: unknown }): string | undefined {
	// `includes`, not `endsWith`: five of the eight delta columns carry the
	// token in the middle — `side_adj_radiant`, `phase_adj_1` — so a suffix
	// test would check three of them and pass the rest without looking. The
	// token is the schema's own mark for a stored delta (`schema.sql`
	// §*Every table below*), so a column added under that convention is
	// checked by being named as the convention requires.
	for (const [column, value] of Object.entries(row))
		if (column.includes("_adj") && typeof value === "number")
			if (!(Math.abs(value) <= ADJ_BOUND))
				// A refused pass rather than a detected failure, so a delta that is
				// not a number fails here instead of comparing false and publishing.
				return `${column} of ${value} lies beyond ±${ADJ_BOUND}`;
	return undefined;
}

/**
 * Whether a component measured some heroes and not others, named.
 *
 * The parts checked are the ones staging holds rows for, never a list written
 * here — and that is the check rather than a shortcut. A part absent for every
 * hero is stored as 0 on every hero, which reorders nothing, exactly as an
 * unmeasured component does; what reorders is a part present for some heroes
 * and missing for one, whose 0 is then weighed against measured deltas. So the
 * defect is a hole in what staging *did* measure, and an unmeasured component
 * has no hole because it measured nothing.
 */
function partial(
	component: "side" | "phase",
	rows: readonly SplitRow[],
	heroes: readonly HeroRow[],
): string | undefined {
	// An unmeasured component needs no case of its own: it holds no rows, so
	// it names no parts, so the loop below has nothing to look for.
	const parts = new Set(rows.map((row) => row.part));
	const held = new Set(rows.map((row) => `${row.heroId}:${row.part}`));
	for (const hero of heroes)
		for (const part of parts)
			if (!held.has(`${hero.heroId}:${part}`))
				return `${component} is measured but hero ${hero.heroId} has no ${part} row`;
	return undefined;
}
