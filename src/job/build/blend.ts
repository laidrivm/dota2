/**
 * The two arithmetic steps between a raw statistic and the delta a snapshot
 * stores: blending the current patch with the one it replaced, then pulling
 * the result towards neutral by how thin the sample behind it is.
 *
 * Pure, and taking its inputs as arguments, because the SQL edge around it
 * cannot be reached without a database and this is the half most likely to be
 * wrong (design.md §*The arithmetic is a pure module*).
 *
 * `t` arrives already counted in whole days. The calendar it is counted on —
 * both ends read on the UTC timeline, the patch's `detected_at` anchored at
 * `00:00:00Z` — belongs to the caller that holds the build instant, which is
 * the staging read.
 */

/** Which row of the decay table a patch's prior follows. */
export type PatchKind = "major" | "letter";

/**
 * Each kind's decay: the virtual matches a fresh patch starts its predecessor
 * off with, the half-life in days, and the day the predecessor stops counting
 * (data-model §4.1). Provisional, and knowingly so — refitting them wants a
 * distribution the ingest has not produced yet.
 */
const DECAY: Record<PatchKind, { k0: number; h: number; tMax: number }> = {
	major: { k0: 1000, h: 1, tMax: 4 },
	letter: { k0: 3000, h: 2, tMax: 7 },
};

/**
 * The virtual matches the previous patch's winrate still carries, `t` whole
 * days into the current patch.
 */
export function prior(kind: PatchKind, t: number): number {
	const { k0, h, tMax } = DECAY[kind];
	// Cut to 0 rather than left to decay: the curve is small past `t_max` and
	// never zero, and the requirement fixes a day the old patch stops counting
	// rather than an amount below which it may be dropped.
	return t >= tMax ? 0 : k0 * 2 ** (-t / h);
}

/** A blended winrate in percentage points, and the sample behind it. */
export type Blended = { wrBlend: number; nEff: number };

/**
 * The current patch's own matches blended with the previous patch's
 * already-smoothed winrate, or `undefined` where there is nothing to blend.
 *
 * `wrOld` is absent for a statistic the previous patch never held — a hero
 * nobody picked then, or no previous patch at all — and the prior then carries
 * no weight. Reading the absence as a neutral 50 would pull a measured winrate
 * towards a number nobody measured, and at a first day's `k0` it would
 * outweigh a hero's own matches several times over.
 *
 * With no matches and no surviving prior the quotient is undefined, so the
 * answer is `undefined` and the caller writes no row. A stored 0 is not
 * available for this: it is what a measured neutral looks like.
 */
export function wrBlend(
	nNew: number,
	wrNew: number,
	priorWeight: number,
	wrOld?: number,
): Blended | undefined {
	if (wrOld === undefined || priorWeight === 0)
		return nNew === 0 ? undefined : { wrBlend: wrNew, nEff: nNew };
	const nEff = nNew + priorWeight;
	return { wrBlend: (nNew * wrNew + priorWeight * wrOld) / nEff, nEff };
}

/** The statistics a snapshot stores a smoothed delta for. */
export type Statistic = "position" | "side" | "phase" | "matchup" | "synergy";

/**
 * The sample size each statistic is pulled to neutral by (data-model §4.2).
 * The one site that names them, so no two callers can disagree about a `k`
 * — and provisional on the same terms the decay table is.
 */
const SMOOTHING: Record<Statistic, number> = {
	position: 300,
	side: 500,
	phase: 500,
	matchup: 400,
	synergy: 400,
};

/** A winrate favouring neither side, in percentage points. */
const NEUTRAL = 50;

/**
 * The delta a snapshot stores, in percentage points: how far the blend sits
 * from neutral, discounted by how thin the sample behind it is. A sample equal
 * to the statistic's own `k` keeps half of it.
 */
export const adj = (statistic: Statistic, blend: Blended): number =>
	((blend.wrBlend - NEUTRAL) * blend.nEff) /
	(blend.nEff + SMOOTHING[statistic]);
