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
 * every array of objects carrying `hero_id` and `d2pt_rating` is rows, a
 * `position` string beside a row or above it is its position, and the first
 * `patch` string is the label. A file of another page carries no such rows.
 */
import { unflatten } from "devalue";

export interface MetaHero {
	rating: number | null;
	tier: string | null;
	matches: number;
	winRate: number;
	phaseWinRates: {
		first: number | null;
		second: number | null;
		last: number | null;
	};
}

export interface MetaUpload {
	position: 1 | 2 | 3 | 4 | 5;
	patch: string;
	heroes: Record<string, MetaHero>;
}

/** A position, rated: fewer known rated heroes than this is not the meta. */
export const MIN_RATED = 50;

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isRow = (value: unknown): value is Row =>
	isRecord(value) && Number.isInteger(value.hero_id) && "d2pt_rating" in value;

/** `pos 3` as 3; anything else as null. */
function positionOf(value: unknown): MetaUpload["position"] | null {
	const match = typeof value === "string" ? /^pos ([1-5])$/.exec(value) : null;
	return match ? (Number(match[1]) as MetaUpload["position"]) : null;
}

/** Every row under `value`, each with the nearest position above or beside it. */
function collect(
	value: unknown,
	inherited: MetaUpload["position"] | null,
	rows: { row: Row; position: MetaUpload["position"] | null }[],
	patch: { label: string | null },
	seen: Set<object>,
): void {
	if (typeof value !== "object" || value === null || seen.has(value)) return;
	seen.add(value);
	if (Array.isArray(value)) {
		for (const item of value) collect(item, inherited, rows, patch, seen);
		return;
	}
	const record = value as Row;
	if (patch.label === null && typeof record.patch === "string")
		patch.label = record.patch;
	const here = positionOf(record.position) ?? inherited;
	if (isRow(value)) {
		rows.push({ row: value, position: here });
		return;
	}
	for (const child of Object.values(value))
		collect(child, here, rows, patch, seen);
}

const rate = (wins: unknown, matches: unknown): number | null =>
	typeof wins === "number" && typeof matches === "number" && matches > 0
		? wins / matches
		: null;

/**
 * The upload `text` holds, keeping only heroes `known` has, or `null` for any
 * file that is not one position of the meta: unparseable, of another page,
 * rows at two positions or none named, fewer than `MIN_RATED` known heroes
 * rated, a rating outside 0–100, or every rating the same.
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

	const rows: { row: Row; position: MetaUpload["position"] | null }[] = [];
	const patch = { label: null as string | null };
	for (const node of file.nodes) {
		if (!isRecord(node) || !Array.isArray(node.data)) continue;
		let data: unknown;
		try {
			data = unflatten(node.data);
		} catch {
			return null;
		}
		collect(data, null, rows, patch, new Set());
	}

	const positions = new Set(rows.map((r) => r.position));
	const [position] = positions;
	if (positions.size !== 1 || position === null || position === undefined)
		return null;
	if (patch.label === null) return null;

	const heroes: Record<string, MetaHero> = {};
	const ratings: number[] = [];
	for (const { row } of rows) {
		const id = row.hero_id as number;
		if (!known.has(id)) continue;
		const rating = row.d2pt_rating;
		if (
			rating !== null &&
			(typeof rating !== "number" || rating < 0 || rating > 100)
		)
			return null;
		if (typeof rating === "number") ratings.push(rating);
		heroes[String(id)] = {
			rating: rating as number | null,
			tier: typeof row.tier === "string" ? row.tier : null,
			matches: Number.isInteger(row.matches) ? (row.matches as number) : 0,
			winRate: typeof row.win_rate === "number" ? row.win_rate : 0,
			phaseWinRates: {
				first: rate(row.phase_1_wins, row.phase_1_matches),
				second: rate(row.phase_2_wins, row.phase_2_matches),
				last: rate(row.phase_3_wins, row.phase_3_matches),
			},
		};
	}
	if (ratings.length < MIN_RATED) return null;
	if (new Set(ratings).size === 1) return null;
	return { position, patch: patch.label, heroes };
}
