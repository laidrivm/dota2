/**
 * A hero's positions: how its own picks are distributed over them, and the
 * two sample thresholds that decide whether it may be suggested at all.
 *
 * Pure, like `blend.ts` beside it, and for the same reason.
 */

/** What a share needs from one of a hero's staging position rows. */
export type PositionPicks = { position: number; matches: number };

/**
 * The share of a hero's own picks each position took, over the positions it
 * was actually picked on.
 *
 * A position with no picks gets no entry rather than a share of 0: the client
 * reads `positions` as a map whose absent keys are positions never played,
 * and a stored 0 would put a role in the distribution that nobody played the
 * hero on.
 */
export function pickShares(rows: PositionPicks[]): Map<number, number> {
	const total = rows.reduce((sum, row) => sum + row.matches, 0);
	// Before the division rather than after: a hero the reference holds and
	// staging never picked reaches here with rows summing to 0, and every
	// share would be `NaN`.
	if (total === 0) return new Map();
	return new Map(
		rows
			.filter((row) => row.matches > 0)
			.map((row) => [row.position, row.matches / total]),
	);
}
