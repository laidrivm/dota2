/**
 * Contest rate, and the ban pull that exists only to feed it.
 *
 * The two live in one file because nothing else reads a ban count:
 * `staging_hero_stats` holds `contest_rate` and no `bans` column, so the pull
 * has exactly one consumer and it is the formula below it.
 *
 * Three of `banDay`'s details are not what its signature suggests, all
 * measured in `docs/context/stratz-probe-2026-08.md`: `heroId` is required and
 * does not filter, `day` is a day number rather than the Unix timestamp
 * `winDay` takes, and the ban count arrives under `matchCount`.
 */
import { isHeroId } from "./heroes.ts";
import {
	isCount,
	MAX_COUNT,
	type MetaWindow,
	type PositionCount,
} from "./meta.ts";
import type { Query } from "./stratz.ts";

/** A UTC day, which is also the unit `banDay`'s `day` counts from the epoch. */
const DAY_MS = 86_400_000;

/**
 * Heroes in an All Pick match, and so what a sum of every hero's match count
 * over-counts the matches by.
 */
const HEROES_PER_MATCH = 10;

/**
 * The id the query has to present. `banDay` refuses a query without one —
 * `PROVIDED_NON_NULL_ARGUMENTS` — and then ignores it: `heroId: 1` and
 * `heroId: 45` returned the same 3641 rows over all 127 heroes. So this is a
 * token the request must carry, not a filter it may use, and the obvious
 * fix — a loop over the reference — would multiply the request count by 127
 * for identical data.
 */
const ANY_HERO = 1;

/**
 * `take` counts days here as it does on the meta pull, and the rows carry the
 * day each belongs to, which is what lets the window be read back off the
 * response rather than trusted.
 */
const document = (days: number) =>
	`{ heroStats { banDay(heroId: ${ANY_HERO}, bracketBasicIds: [DIVINE_IMMORTAL], groupByDay: true, take: ${days}) { heroId day matchCount } } }`;

/** The day number `banDay` counts `at` as, days from the epoch. */
const dayNumber = (at: Date) => Math.floor(at.getTime() / DAY_MS);

/**
 * Every hero's ban count over `span`, as one request.
 *
 * A hero and day the response carries no row for contributes 0 rather than
 * failing the run: 169 of 3810 pairs were missing when this was measured, no
 * row carried a count of zero, and 51 heroes of 127 were missing at least one
 * day — so a run that required the full grid would fail on nearly every
 * window. A hero missing from every day is simply absent from the map, which
 * the formula below reads as no bans.
 */
export async function pullBans(
	query: Query,
	span: MetaWindow,
): Promise<Map<number, number>> {
	// The window converted to this endpoint's own encoding rather than the meta
	// pull's: `winDay` takes a Unix timestamp and `banDay` a day number, two
	// encodings of the same word, so neither pull's arithmetic can be shared.
	const first = dayNumber(span.start);
	const last = dayNumber(span.end) - 1;

	const body = (await query(document(span.days))) as {
		data?: { heroStats?: { banDay?: unknown } };
	} | null;
	const listed = body?.data?.heroStats?.banDay;
	if (!Array.isArray(listed))
		throw new Error("the ban source returned no rows");

	const bans = new Map<number, number>();
	// The pairs a response has already named. Absence is this endpoint's
	// normal state, so completeness cannot be checked — but a repeat can be,
	// and a repeated pair inflates a hero's contest rate with no other trace.
	const named = new Set<string>();
	for (const [index, entry] of listed.entries()) {
		const { heroId, day, matchCount } = (entry ?? {}) as {
			heroId: unknown;
			day: unknown;
			matchCount: unknown;
		};
		// `typeof` first, so what follows reads `day` as the number it is
		// rather than through a cast.
		if (
			typeof day !== "number" ||
			!Number.isInteger(day) ||
			!isHeroId(heroId) ||
			!isCount(matchCount)
		)
			throw new Error(`the ban source returned entry ${index} unreadable`);
		// A day outside the window is dropped rather than refused: `take` is the
		// only bound the request carries, and the endpoint answering more days
		// than it was asked for is not a reason to fail a run.
		if (day < first || day > last) continue;
		const pair = `${heroId}:${day}`;
		if (named.has(pair))
			throw new Error(
				`the ban source named hero ${heroId} on day ${day} more than once`,
			);
		named.add(pair);
		const total = (bans.get(heroId) ?? 0) + matchCount;
		if (total > MAX_COUNT)
			throw new Error(`the ban source summed hero ${heroId} past a ban count`);
		bans.set(heroId, total);
	}
	// A response leaving every hero with no bans is not a ban-free window —
	// seven days at these brackets carry bans on nearly every hero — it is a
	// request that did not land, and it is exactly what a wrong reading of
	// `day` would look like: every row filtered out and the contest rate
	// quietly stored from picks alone, which is what *Bans cannot be read*
	// exists to prevent.
	if (bans.size === 0)
		throw new Error("the ban source named no hero inside the window");
	return bans;
}

/** One hero's row of `staging_hero_stats`, its position rows summed. */
export type HeroTotal = {
	heroId: number;
	matches: number;
	wins: number;
	contestRate: number;
};

/**
 * The hero-level rows, each carrying its contest rate.
 *
 * The totals are stored rather than derived later because the formula computes
 * the pick count anyway, and `snapshot-build` reads side and phase baselines
 * against a hero total. Should the two ever disagree, the position rows are
 * what the source returned.
 */
export function heroTotals(
	rows: PositionCount[],
	bans: Map<number, number>,
): HeroTotal[] {
	const totals = new Map<number, Omit<HeroTotal, "contestRate">>();
	// Summed here rather than over the totals afterwards: every hero's matches
	// added up is every row's matches added up, and one pass says so.
	let picked = 0;
	for (const row of rows) {
		const total = totals.get(row.heroId) ?? {
			heroId: row.heroId,
			matches: 0,
			wins: 0,
		};
		total.matches += row.matches;
		total.wins += row.wins;
		picked += row.matches;
		// Five positions each fitting the column can sum past it, as thirty days
		// can. Refused here rather than at the insert, which reports a range
		// error naming a column instead of a source.
		if (total.matches > MAX_COUNT)
			throw new Error(
				`hero ${row.heroId} sums past what the column holds across its positions`,
			);
		totals.set(row.heroId, total);
	}

	// Exact, not an estimate: an All Pick match holds ten distinct heroes, so
	// every match in the window contributes exactly ten to this sum and no
	// hero is counted twice in one match. The division is left fractional
	// because a sum that is not a multiple of ten still names the ratio the
	// requirement fixes, where rounding it would name a different one.
	const matches = picked / HEROES_PER_MATCH;

	return [...totals.values()].map((total) => ({
		...total,
		// A heuristic ordering rather than a measured share, and knowingly so:
		// the picks and the divisor come from `winDay`, pinned to ranked All
		// Pick and the fine bracket enum; the bans come from `banDay`, which
		// takes the coarse enum and offers no game-mode filter at all. The two
		// describe different match populations, by how much is not known, and
		// nor is whether the difference falls alike on every hero. So this
		// orders heroes by contest and is not a share of anything.
		contestRate:
			matches === 0
				? 0
				: (total.matches + (bans.get(total.heroId) ?? 0)) / matches,
	}));
}
