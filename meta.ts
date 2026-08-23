/**
 * The meta pull: hero match and win counts by day and by position, summed over
 * the window the current patch and the run instant define.
 *
 * It reads `heroStats.winDay` rather than the per-week `heroStats.stats` the
 * data model was first written against, for one reason that decides it: the
 * weekly endpoint takes no game-mode filter, so every number it returns pools
 * the modes the product does not model (`design.md` §*The meta comes from the
 * per-day endpoint, not the per-week one*). Granularity and cost then come
 * free — one request per position covers every hero over the whole window,
 * because the window is an argument rather than a series of requests.
 */
import { isHeroId } from "./heroes.ts";
import type { Query } from "./stratz.ts";

/** A UTC day. The epoch is UTC-aligned, so day arithmetic is division. */
const DAY_MS = 86_400_000;

/**
 * The most days the source serves. Not a choice this module makes: `take: 200`
 * returns the same thirty days, and `skip: 30` returns nothing where `skip: 0`
 * returns thirty rows, so no thirty-first day is reachable through this
 * endpoint at all (`docs/context/stratz-probe-2026-08.md`).
 */
const SOURCE_DAYS = 30;

/** The five positions, each its own request. */
const POSITIONS = [1, 2, 3, 4, 5];

/** The span the pulls are measured over, both bounds at UTC midnight. */
export type MetaWindow = {
	start: Date;
	/** Exclusive: the day the run instant falls inside is never half-counted. */
	end: Date;
	/** Whole UTC days between the two, and what one request asks for. */
	days: number;
	/** Whether the source's reach bound the window rather than the patch's age. */
	cappedBySource: boolean;
};

/**
 * The window a run at `at` covers for a patch released at `detectedAt`: every
 * whole UTC day of the patch's life, capped at what the source serves.
 *
 * The arithmetic is on the UTC timeline throughout — division by a day rather
 * than any of `Date`'s calendar accessors, which read the machine's zone and
 * would shift both bounds by a day wherever that zone is not UTC.
 *
 * A patch with no whole day behind it yields the single most recent complete
 * day rather than nothing. Those matches were played under the previous patch,
 * which is a deliberate approximation: the next day's pull dilutes them, and
 * the alternative is a failed build every night until a day accumulates.
 */
export function metaWindow(detectedAt: Date, at: Date): MetaWindow {
	const detected = detectedAt.getTime();
	const run = at.getTime();
	// An instant that is not one would leave every line below holding `NaN`,
	// and `NaN` is what would then be asked for: `Math.max` and `Math.min` both
	// propagate it rather than falling back on their other argument.
	if (!Number.isFinite(detected) || !Number.isFinite(run))
		throw new RangeError("a window cannot be measured from an invalid instant");
	// The one-day floor below answers a patch detected *today*, and a patch
	// released after the run is not that: it would take a day the patch was
	// never live for. `detectPatch` selects on `detected_at <= at` and so never
	// returns one, which makes this a precondition rather than a case any
	// caller has — stated because a reader would otherwise read the floor as
	// covering it.
	if (detected > run)
		throw new RangeError(
			"a patch released after the run instant has no window",
		);

	// Floor for the end and ceiling for the start, so a part-day at either
	// bound is left out rather than half-counted.
	const end = Math.floor(run / DAY_MS) * DAY_MS;
	// A patch released midway through a day starts the count at the next
	// midnight, that day being one it was not live for the whole of.
	const first = Math.ceil(detected / DAY_MS) * DAY_MS;
	const whole = Math.max(1, (end - first) / DAY_MS);
	const days = Math.min(whole, SOURCE_DAYS);
	return {
		start: new Date(end - days * DAY_MS),
		end: new Date(end),
		days,
		cappedBySource: whole > SOURCE_DAYS,
	};
}

/**
 * The largest value a staging count column holds, every one of them being
 * `int`. The same ceiling `heroes.ts` puts on a hero id and for the same
 * reason: a number the column cannot hold reaches Postgres as an error rather
 * than a row.
 */
export const MAX_COUNT = 2_147_483_647;

/**
 * Whether a value is a number of matches, rather than merely a number.
 *
 * Bounded above as well as below. That keeps every total inside
 * `Number.MAX_SAFE_INTEGER`, so no sum loses precision — but a total of them
 * can still pass what the column holds, which is why the running sum is
 * checked against `MAX_COUNT` too rather than only each addend.
 *
 * Exported for the pair pull, which sums over weeks as this sums over days and
 * so hides the same inconsistency from the same constraint.
 */
export const isCount = (n: unknown): n is number =>
	typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT;

/** One hero's counts at one position, summed over the window's days. */
export type PositionCount = {
	heroId: number;
	position: number;
	matches: number;
	wins: number;
};

/**
 * The filter every meta request carries, written once so the mode and the
 * brackets cannot drift between the five. `ALL_PICK_RANKED` is the whole
 * reason this endpoint is the source; `DIVINE` and `IMMORTAL` are the fine
 * bracket enum this endpoint takes, which is not the coarse one the pair
 * endpoint takes.
 */
const FILTER =
	"gameModeIds: [ALL_PICK_RANKED], bracketIds: [DIVINE, IMMORTAL], groupBy: HERO_ID";

/**
 * One request per position over `span`, summed into one row per hero and
 * position. A hero the source returns no row for gets no row here either: an
 * absent hero is one this window has no sample for, which is not the same
 * statement as a sample of zero.
 *
 * `staging_hero_position_stats` declares `matches >= 0 AND wins BETWEEN 0 AND
 * matches`, and `schema.sql` states that edge as the one that has to check.
 * The bound is read again here rather than only there because what reaches the
 * table is the sum: a day reporting more wins than matches is hidden by the
 * other days it is added to, so the value the constraint sees is not the value
 * the source stated.
 */
export async function pullMeta(
	query: Query,
	span: MetaWindow,
): Promise<PositionCount[]> {
	const rows: PositionCount[] = [];
	for (const position of POSITIONS) {
		// `take` counts days and the endpoint answers the most recent ones, so
		// the window is asked for by its length. No `day` argument is passed:
		// the freshest row the source holds is the previous complete UTC day,
		// which is the window's own last day. `day` is not read back either —
		// the rows are summed, so which day each came from changes nothing, and
		// the ban pull derives the days it needs from the window instead.
		const asked = `{ heroStats { winDay(positionIds: [POSITION_${position}], ${FILTER}, take: ${span.days}) { heroId matchCount winCount } } }`;
		const body = (await query(asked)) as {
			data?: { heroStats?: { winDay?: unknown } };
		} | null;
		// Optionally chained from `body` itself: a body of literal `null` parses
		// to one, and this function takes any `Query` rather than only the
		// client's.
		const listed = body?.data?.heroStats?.winDay;
		if (!Array.isArray(listed))
			throw new Error(
				`the meta source returned no rows for position ${position}`,
			);
		const summed = new Map<number, PositionCount>();
		for (const entry of listed) {
			// `?? {}` because the entry is a vendor's: a `null` in the list would
			// otherwise raise a type error naming a property, where the counts
			// themselves are the staging table's to refuse.
			const { heroId, matchCount, winCount } = (entry ?? {}) as {
				heroId: unknown;
				matchCount: unknown;
				winCount: unknown;
			};
			// The id keys the row and references `heroes`, so an entry without
			// one is not a count this run can attribute. Refused here rather
			// than at the insert, where it arrives as a constraint violation
			// naming a column instead of a source.
			if (!isHeroId(heroId))
				throw new Error(
					`the meta source returned a row with no hero id at position ${position}`,
				);
			// The bound is read on the day rather than only on the sum: a day
			// reporting more wins than matches is hidden by the days it is added
			// to, so the staging table's own constraint never sees it.
			if (!isCount(matchCount) || !isCount(winCount) || winCount > matchCount)
				throw new Error(
					`the meta source returned hero ${heroId} at position ${position} with counts a day cannot have`,
				);
			const row = summed.get(heroId) ?? {
				heroId,
				position,
				matches: 0,
				wins: 0,
			};
			row.matches += matchCount;
			row.wins += winCount;
			// Each day fits the column and their sum need not: thirty of them
			// reach thirty times its ceiling. Refused here rather than at the
			// insert, which reports a range error naming a column instead of a
			// source.
			if (row.matches > MAX_COUNT)
				throw new Error(
					`the meta source summed hero ${heroId} at position ${position} past what the column holds`,
				);
			summed.set(heroId, row);
		}
		rows.push(...summed.values());
	}
	// Five empty responses are not a window with no matches in it — they are a
	// pull that did not happen. Refused here because the staging write is a
	// delete followed by an insert: writing nothing would take the previous
	// patch's rows with it, and with them the last snapshot that could be built.
	if (rows.length === 0)
		throw new Error("the meta source returned no rows at any position");
	return rows;
}
