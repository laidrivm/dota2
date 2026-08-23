/**
 * What the pair suites drive `pullPairs` with: a stand-in reference of three
 * heroes, a `fetch`-free `query` that answers each request from a script, and
 * the matrices a response is judged against.
 *
 * Three heroes rather than the reference's 127, so a whole matrix is two rows.
 * The shapes are taken from the `matchUp` response recorded in
 * `docs/context/stratz-probe-2026-08.md`; no suite calls the live API.
 */
import { pairWeeks } from "./pairs.ts";
import type { Query } from "./stratz.ts";

/** A week, restated rather than imported: a test that took the module's own
 * constant would agree with it however wrong it is. */
export const WEEK_MS = 604_800_000;

/** The reference these suites pull over, and one complete week to pull it in. */
export const HEROES = [9001, 9002, 9003];
export const WEEKS = pairWeeks(
	new Date("2026-08-13T00:00:00.000Z"),
	new Date("2026-08-21T12:00:00.000Z"),
);

/** One row of one matrix, as the endpoint returns it. */
export const row = (heroId2: number, matches: number, wins: number) => ({
	heroId2,
	matchCount: matches,
	winCount: wins,
});

/** Every other hero's row, so a matrix the reference admits whole. */
export const whole = (heroId: number, matches = 10, wins = 4) =>
	HEROES.filter((id) => id !== heroId).map((id) => row(id, matches, wins));

/**
 * A `query` answering each hero's request from `matrices`, and the documents
 * it was asked for. `vs` and `with` default to the whole matrix, so a case
 * about one of them names only that one.
 */
export function asking(
	matrices: (heroId: number, call: number) => { vs?: unknown; with?: unknown },
) {
	const asked: string[] = [];
	const query: Query = async (sent) => {
		// Checked rather than coerced: a document that stopped naming its hero
		// would otherwise reach `matrices` as `NaN` and fail somewhere else.
		const named = /heroId: (\d+)/.exec(sent);
		if (named === null)
			throw new Error(`the request named no hero id: ${sent}`);
		const heroId = Number(named[1]);
		const answered = matrices(heroId, asked.length);
		asked.push(sent);
		return {
			data: {
				heroStats: {
					matchUp: [
						{
							// `in` rather than `??`, so a case can answer a matrix
							// that is absent as well as one that is wrong.
							vs: "vs" in answered ? answered.vs : whole(heroId),
							with: "with" in answered ? answered.with : whole(heroId),
						},
					],
				},
			},
		};
	};
	return { query, asked };
}

/** The message `work` failed with, or `null` where it did not fail. */
export const failure = (work: Promise<unknown>) =>
	work.then(
		() => null,
		(error: Error) => error.message,
	);
