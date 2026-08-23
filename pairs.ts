/**
 * The pair pull: each hero's opponent and ally rows, summed over at most four
 * complete weeks of the current patch.
 *
 * A week is the endpoint's only time dimension and it answers one hero at a
 * time, so this is one request per hero per week — 508 of a run's ~516
 * (`docs/context/stratz-probe-2026-08.md`). Four weeks is this change's cap
 * rather than the source's: a whole patch would pass the hourly ceiling once
 * the patch is about eleven weeks old.
 *
 * The endpoint takes the coarse bracket enum and no game-mode filter, so its
 * population is not the meta pull's. That is accepted rather than resolved:
 * what it yields is an advantage — a difference from the neutral 50 — and a
 * difference is far less sensitive to which population produced it than an
 * absolute rate is (`design.md` §*The two endpoints do not agree, and only one
 * of them can be fixed*).
 */
import { isHeroId } from "./heroes.ts";
import { isCount } from "./meta.ts";
import type { Query } from "./stratz.ts";

/**
 * A week. The epoch fell on a Thursday, so a week floored from it begins on
 * one — which is the boundary the endpoint's own buckets run on, Thursday to
 * Wednesday, measured over every timestamp of week 2954.
 */
const WEEK_MS = 604_800_000;

/** The most weeks one run asks for. This change's cap, stated in its spec. */
const MAX_WEEKS = 4;

/** Rows one request asks for; the endpoint's own default is 10. */
const TAKE = 200;

/**
 * The weeks a run at `at` covers for a patch released at `detectedAt`: the
 * complete ones the patch has been live for, newest first up to the cap, then
 * in the order they happened. Each is the Thursday its bucket opens, the
 * closing Wednesday being that plus a week and nothing here reading it.
 *
 * A week belongs to the patch in force on its **last** day, so a week whose
 * span contains the release is the new patch's. No argument the endpoint
 * offers could split such a week, and attributing it to the patch it ended
 * under is the reading that never asks for a week wholly before the release.
 *
 * A patch with no complete week behind it yields none, and the pair statistics
 * are then absent rather than approximate — unlike the meta window, which has
 * a one-day floor. `snapshot-build` decides a component by whether staging
 * holds any row for it, so absent is a state it already reads.
 */
export function pairWeeks(detectedAt: Date, at: Date): Date[] {
	const detected = detectedAt.getTime();
	const run = at.getTime();
	if (!Number.isFinite(detected) || !Number.isFinite(run))
		throw new RangeError("a week cannot be measured from an invalid instant");

	// The exclusive end of the most recent complete bucket: the week the run
	// falls inside has not finished, and the source returns nothing for it.
	let end = Math.floor(run / WEEK_MS) * WEEK_MS;
	const weeks: Date[] = [];
	// `detected < end` is the attribution rule above: the patch was in force on
	// the last day of every week that ends after it was released.
	while (weeks.length < MAX_WEEKS && detected < end) {
		weeks.push(new Date(end - WEEK_MS));
		end -= WEEK_MS;
	}
	return weeks.reverse();
}

/** One hero's counts against or alongside one other, summed over the weeks. */
export type PairCount = {
	heroId: number;
	otherId: number;
	matches: number;
	wins: number;
};

/** What the pull yields: the two matrices, each holding both directions. */
export type PairPull = { matchups: PairCount[]; synergies: PairCount[] };

/**
 * The instant naming a bucket. The `week` argument is a Unix timestamp in
 * seconds rather than the bucket id the response carries — `week: 2954`
 * returns nothing at all, a timestamp inside that week returns its rows.
 *
 * Mid-week rather than either boundary: the buckets were measured at the
 * granularity of a day, so what hour they turn on is not known, and the middle
 * is the instant furthest from being wrong about it.
 */
const anchor = (week: Date) =>
	Math.floor((week.getTime() + WEEK_MS / 2) / 1000);

const document = (heroId: number, week: Date) =>
	`{ heroStats { matchUp(heroId: ${heroId}, week: ${anchor(week)}, take: ${TAKE}, bracketBasicIds: [DIVINE_IMMORTAL]) { with { heroId2 matchCount winCount } vs { heroId2 matchCount winCount } } } }`;

/**
 * The `HeroDryadType` one request answers with, carrying `with` and `vs` side
 * by side.
 *
 * Read through both containers because the probe recorded the type's fields
 * and not whether `matchUp` answers one of them or a list of one — the
 * measurement is in `docs/context/stratz-probe-2026-08.md` and stops at the
 * fields. Guessing wrong would fail every pair request of the first real run.
 */
function dryad(body: unknown, heroId: number) {
	const answered = (body as { data?: { heroStats?: { matchUp?: unknown } } })
		?.data?.heroStats?.matchUp;
	const pair = Array.isArray(answered) ? answered[0] : answered;
	if (typeof pair !== "object" || pair === null)
		throw new Error(`the pair source returned nothing for hero ${heroId}`);
	return pair as { with?: unknown; vs?: unknown };
}

/**
 * Sum one matrix of one response into `into`, refusing anything that is not
 * exactly one row per hero in `expected`.
 *
 * The criterion fixes *one* row per other hero, so a surplus row, a repeated
 * hero and a hero the reference does not hold all fail on the same terms as a
 * short response: a partial matrix written as though it were whole is a
 * winrate computed against the heroes that happened to answer.
 */
function absorb(
	into: Map<string, PairCount>,
	heroId: number,
	expected: Set<number>,
	rows: unknown,
	kind: string,
): void {
	if (!Array.isArray(rows))
		throw new Error(
			`the pair source returned no ${kind} rows for hero ${heroId}`,
		);
	const seen = new Set<number>();
	for (const entry of rows) {
		const { heroId2, matchCount, winCount } = (entry ?? {}) as {
			heroId2: unknown;
			matchCount: unknown;
			winCount: unknown;
		};
		if (!isHeroId(heroId2) || !expected.has(heroId2) || seen.has(heroId2))
			throw new Error(
				`the ${kind} rows for hero ${heroId} carry one the reference does not admit once`,
			);
		// The same bound the staging tables declare, read on the week rather
		// than on the sum, which is the only place the source's own
		// inconsistency is still visible.
		if (!isCount(matchCount) || !isCount(winCount) || winCount > matchCount)
			throw new Error(
				`the ${kind} rows for hero ${heroId} carry counts a week cannot have`,
			);
		seen.add(heroId2);
		const key = `${heroId}:${heroId2}`;
		const row = into.get(key) ?? {
			heroId,
			otherId: heroId2,
			matches: 0,
			wins: 0,
		};
		row.matches += matchCount;
		row.wins += winCount;
		into.set(key, row);
	}
	if (seen.size !== expected.size)
		throw new Error(
			`the pair source returned ${seen.size} of ${expected.size} ${kind} rows for hero ${heroId}`,
		);
}

/**
 * One request per hero per week, summed into one row per ordered pair.
 *
 * Both directions are kept, which is what `staging_hero_matchups` and
 * `staging_hero_synergies` declare: the endpoint answers per hero, and folding
 * the two halves into one is `snapshot-build`'s symmetry step rather than this
 * one's.
 */
export async function pullPairs(
	query: Query,
	heroIds: number[],
	weeks: Date[],
): Promise<PairPull> {
	const reference = new Set(heroIds);
	const matchups = new Map<string, PairCount>();
	const synergies = new Map<string, PairCount>();
	// Iterated over the set rather than the list it came from: a reference
	// listing a hero twice would otherwise ask for it twice and sum its rows
	// twice, which no validation here would notice.
	for (const heroId of reference) {
		const expected = new Set(reference);
		expected.delete(heroId);
		for (const week of weeks) {
			const pair = dryad(await query(document(heroId, week)), heroId);
			absorb(matchups, heroId, expected, pair.vs, "opponent");
			absorb(synergies, heroId, expected, pair.with, "ally");
		}
	}
	return {
		matchups: [...matchups.values()],
		synergies: [...synergies.values()],
	};
}
