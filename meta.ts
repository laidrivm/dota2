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
export type Window = {
	start: Date;
	/** Exclusive: the day the run instant falls inside is never half-counted. */
	end: Date;
	/** Whole UTC days between the two, and what one request asks for. */
	days: number;
	/** Whether the source's reach bound the window rather than the patch's age. */
	cappedBySource: boolean;
};

/** UTC midnight at or before `at`. */
const dayStart = (at: Date) => Math.floor(at.getTime() / DAY_MS) * DAY_MS;

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
export function metaWindow(detectedAt: Date, at: Date): Window {
	const end = dayStart(at);
	// Ceiling, not floor: the window holds a day only where the whole of it
	// falls after the release, so a patch released midway through a day starts
	// the count at the next midnight.
	const first = Math.ceil(detectedAt.getTime() / DAY_MS) * DAY_MS;
	const whole = Math.max(1, (end - first) / DAY_MS);
	const days = Math.min(whole, SOURCE_DAYS);
	return {
		start: new Date(end - days * DAY_MS),
		end: new Date(end),
		days,
		cappedBySource: whole > SOURCE_DAYS,
	};
}

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
 * `take` counts days and the endpoint answers the most recent ones, so the
 * window is asked for by its length. No `day` argument is passed: the freshest
 * row the source holds is the previous complete UTC day, which is the window's
 * own last day.
 *
 * `day` itself is not read back. The rows are summed, so which day each came
 * from changes nothing — and the ban pull, which does need the days, derives
 * them from the window rather than from this response.
 */
const document = (position: number, days: number) =>
	`{ heroStats { winDay(positionIds: [POSITION_${position}], ${FILTER}, take: ${days}) { heroId matchCount winCount } } }`;

/**
 * One request per position over `window`, summed into one row per hero and
 * position. A hero the source returns no row for gets no row here either: an
 * absent hero is one this window has no sample for, which is not the same
 * statement as a sample of zero.
 *
 * The counts are not bounded here. `staging_hero_position_stats` declares
 * `matches >= 0 AND wins BETWEEN 0 AND matches` and `hero_id` references
 * `heroes`, and `schema.sql` states that edge as the one that has to check —
 * a second reading of it here would be a rule kept in two places.
 */
export async function pullMeta(
	query: Query,
	window: Window,
): Promise<PositionCount[]> {
	const rows: PositionCount[] = [];
	for (const position of POSITIONS) {
		const body = (await query(document(position, window.days))) as {
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
				heroId: number;
				matchCount: number;
				winCount: number;
			};
			const row = summed.get(heroId) ?? {
				heroId,
				position,
				matches: 0,
				wins: 0,
			};
			row.matches += matchCount;
			row.wins += winCount;
			summed.set(heroId, row);
		}
		rows.push(...summed.values());
	}
	return rows;
}
