/**
 * dota2protracker's meta data file, read for one position (cm-meta-import,
 * *An upload carries one position of the Pubs 7000+ meta*; design D5).
 *
 * The file is a SvelteKit data file — `{"type":"data","nodes":[…]}`, each
 * node's `data` in `devalue`'s flattened form. The hero rows were recorded in
 * a browser on 2026-11-27 (design, *Context*): per hero `hero_id`, `tier`,
 * `d2pt_rating`, `matches`, `win_rate` and `phase_1_matches`/`_wins` …
 * `phase_3_*`. Where in a node they sit was not, nor where the position and
 * the patch label are, so the reader finds them by name rather than by path:
 * every object carrying `hero_id` and `d2pt_rating` is a row, a `position`
 * string on a row or above it is its position, and the first `patch` string
 * is the label. A file of another page carries no such rows.
 *
 * The decoded value is the caller's, and bounded only by the body's 5 MB: a
 * few bytes decode to a sparse array four billion long, which a walk over its
 * length would stall the server on. So the walk visits only the entries an
 * array actually holds, stops past `MAX_NODES`, and is iterative — nesting
 * deep enough to exhaust a recursive one is refused by devalue first, measured
 * at about 19,000 levels under Bun, but the walk need not rely on that.
 */
import { unflatten } from "devalue";
import type { MetaHero } from "./meta-schema.ts";

type Position = 1 | 2 | 3 | 4 | 5;

export interface MetaUpload {
	position: Position;
	patch: string;
	heroes: Record<string, MetaHero>;
}

/** A position, rated: fewer known rated heroes than this is not the meta. */
export const MIN_RATED = 50;

/** More objects than any meta file holds; past it the walk gives up. */
export const MAX_NODES = 200_000;

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isRow = (value: unknown): value is Row =>
	isRecord(value) && Number.isInteger(value.hero_id) && "d2pt_rating" in value;

/** `pos 3` as 3; anything else as null. */
function positionOf(value: unknown): Position | null {
	const match = typeof value === "string" ? /^pos ([1-5])$/.exec(value) : null;
	return match ? (Number(match[1]) as Position) : null;
}

interface Found {
	rows: { row: Row; position: Position | null }[];
	patch: string | null;
}

/**
 * Every row under `root` with the nearest position above or on it, into
 * `found`; `false` when the walk exceeds its budget. An object reached again
 * under the same position is not walked twice — devalue keeps shared
 * identity, and a cycle would otherwise never end — but one reached under a
 * different position is, so a row shared by two positions reads as both.
 */
function collect(root: unknown, found: Found): boolean {
	const seen = new Map<object, Set<Position | null>>();
	const stack: [unknown, Position | null][] = [[root, null]];
	let visited = 0;
	while (stack.length > 0) {
		const [value, inherited] = stack.pop() as [unknown, Position | null];
		if (typeof value !== "object" || value === null) continue;
		const under = seen.get(value) ?? new Set();
		if (under.has(inherited)) continue;
		under.add(inherited);
		seen.set(value, under);
		if (++visited > MAX_NODES) return false;

		if (Array.isArray(value)) {
			// Populated indices only: a hole is not an entry, and a sparse
			// array's length is not a count of anything.
			// Pushed last-first so they pop in document order, which "the
			// first `patch` string" is read in.
			for (const index of Object.keys(value).reverse())
				stack.push([value[Number(index)], inherited]);
			continue;
		}
		const record = value as Row;
		if (found.patch === null && typeof record.patch === "string")
			found.patch = record.patch;
		const here = positionOf(record.position) ?? inherited;
		// A row is recorded and still walked into: a row nested under it at
		// another position has to be seen for the file to read as mixed.
		if (isRow(record)) found.rows.push({ row: record, position: here });
		for (const child of Object.values(record).reverse())
			stack.push([child, here]);
	}
	return true;
}

const rate = (wins: unknown, matches: unknown): number | null =>
	typeof wins === "number" &&
	typeof matches === "number" &&
	matches > 0 &&
	wins >= 0 &&
	wins <= matches
		? wins / matches
		: null;

const finite = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * The upload `text` holds, keeping only heroes `known` has, or `null` for any
 * file that is not one position of the meta: unparseable, of another page,
 * rows at two positions or none named, a hero twice, fewer than `MIN_RATED`
 * known heroes rated, a rating that is not a number from 0 to 100, every
 * rating the same, or more to walk than a meta file could hold.
 */
export function readMeta(
	text: string,
	known: ReadonlySet<number>,
): MetaUpload | null {
	let file: unknown;
	try {
		file = JSON.parse(text);
	} catch {
		return null;
	}
	if (!isRecord(file) || !Array.isArray(file.nodes)) return null;

	const found: Found = { rows: [], patch: null };
	for (const node of file.nodes) {
		if (!isRecord(node) || !Array.isArray(node.data)) continue;
		let data: unknown;
		try {
			data = unflatten(node.data);
		} catch {
			return null;
		}
		if (!collect(data, found)) return null;
	}

	const positions = new Set(found.rows.map((r) => r.position));
	const [position] = positions;
	if (positions.size !== 1 || position === null || position === undefined)
		return null;
	if (found.patch === null) return null;

	const heroes: Record<string, MetaHero> = {};
	for (const { row } of found.rows) {
		const id = row.hero_id as number;
		if (!known.has(id)) continue;
		// A hero twice is two answers to one question, and the count below
		// would take both.
		if (String(id) in heroes) return null;
		const rating = row.d2pt_rating;
		const value = finite(rating);
		if (rating !== null && (value === null || value < 0 || value > 100))
			return null;
		heroes[String(id)] = {
			rating: value,
			tier: typeof row.tier === "string" ? row.tier : null,
			matches:
				// Safe integers only: the stored file is read back through a schema
				// that refuses an unsafe one, and would lose the whole position.
				Number.isSafeInteger(row.matches) && (row.matches as number) >= 0
					? (row.matches as number)
					: null,
			winRate: finite(row.win_rate),
			phaseWinRates: {
				first: rate(row.phase_1_wins, row.phase_1_matches),
				second: rate(row.phase_2_wins, row.phase_2_matches),
				last: rate(row.phase_3_wins, row.phase_3_matches),
			},
		};
	}
	const ratings = Object.values(heroes).flatMap((hero) =>
		hero.rating === null ? [] : [hero.rating],
	);
	if (ratings.length < MIN_RATED) return null;
	if (new Set(ratings).size === 1) return null;
	return { position, patch: found.patch, heroes };
}
