/**
 * What value a statistic takes. Two arithmetic steps — blending the current
 * patch with the one it replaced, then pulling the result towards neutral by
 * how thin the sample behind it is — and, at the foot, the verdict that
 * overrides both with 0 for a component staging never measured.
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

/** A day on the UTC timeline, the unit `t` counts in. */
const DAY_MS = 86_400_000;

/**
 * The whole days `prior` decays over: from the patch's `detected_at` to the
 * build instant, both read on the UTC timeline.
 *
 * The column is an instant and the build instant carries an offset, so the
 * basis has to be chosen rather than inherited. The date anchors at
 * `00:00:00Z` and the elapsed time is counted in whole 24-hour days, rounded
 * down; reading either end as a local date instead shifts `t` by a day, and a
 * day is a whole half-life for a major patch.
 */
export const wholeDays = (detectedAt: Date, at: Date): number =>
	Math.floor(
		(at.getTime() -
			Date.UTC(
				detectedAt.getUTCFullYear(),
				detectedAt.getUTCMonth(),
				detectedAt.getUTCDate(),
			)) /
			DAY_MS,
	);

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

/**
 * Whether staging measured a component — `side`, `phase` — at all: whether it
 * holds any row for it. An unmeasured component is stored as 0 on every hero
 * row, which the model reads as no contribution, so it moves no candidate's
 * rank.
 *
 * Three readings this refuses, each of which zeroes something that was
 * measured. It is asked once per component, never once for the snapshot, so
 * an unmeasured `phase` leaves a measured `side` standing. It reads whether a
 * row exists, never what it holds, so a hero winning exactly half its games is
 * measured and neutral rather than unmeasured. And it is asked of the whole
 * component's rows, never of one hero's, so a measured component missing a
 * hero stays measured — that hero is a validation failure, where zeroing it
 * would reorder it against every hero the component did measure.
 */
export const isMeasured = (componentRows: readonly unknown[]): boolean =>
	componentRows.length > 0;
