/**
 * A d2pt meta data file built for a case: the SvelteKit envelope, the rows in
 * `devalue`'s flattened form, the fields recorded in the design.
 *
 * shortcut: synthetic, because no real file could be fetched from this
 * session (the d2pt site sits behind a bot check, and the browser that passes
 * it is the captain's). Replace with a trimmed real `pos 3` file, as task 12.1
 * asks, once one is saved — the D2ASS card *Check the d2pt reader against a
 * real data file* carries it.
 */
import { stringify } from "devalue";

export interface FixtureRow {
	hero_id: number;
	position?: string;
	tier?: string | null;
	d2pt_rating: number | null;
	matches?: number;
	win_rate?: number;
	phase_1_matches?: number;
	phase_1_wins?: number;
	phase_2_matches?: number;
	phase_2_wins?: number;
	phase_3_matches?: number;
	phase_3_wins?: number;
}

/** `count` rows at `position`, hero ids from `ids`, ratings 40, 41, 42 … */
export function rows(
	ids: readonly number[],
	count: number,
	position = "pos 3",
): FixtureRow[] {
	return ids.slice(0, count).map((hero_id, i) => ({
		hero_id,
		position,
		tier: "A",
		d2pt_rating: 40 + (i % 50),
		matches: 1000 + i,
		win_rate: 0.5,
		phase_1_matches: 100,
		phase_1_wins: 52,
		phase_2_matches: 200,
		phase_2_wins: 100,
		phase_3_matches: 0,
		phase_3_wins: 0,
	}));
}

/** The data file's text, the rows under a `meta` key beside the patch label. */
export const metaFile = (heroes: FixtureRow[], patch = "7.41f") =>
	JSON.stringify({
		type: "data",
		nodes: [
			null,
			{
				type: "data",
				data: JSON.parse(stringify({ patch, meta: { heroes } })),
				uses: { search_params: ["position", "mmr"] },
			},
		],
	});
