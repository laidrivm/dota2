/**
 * The published snapshot, rendered as the bundle the client fetches.
 *
 * This is the boundary `data-model.md` names: Postgres columns are
 * `snake_case` because an unquoted identifier folds to lowercase, and every
 * key the client reads is camelCase — so the renaming happens here, once, and
 * nowhere else. It is written out field by field rather than derived from the
 * column names, because the two spellings agree on nothing: `short_name` is
 * `short`, `contest_rate` is `contest`, `phase_adj_1` is `p1`.
 *
 * Rendering only. Writing the bundle where it is served, and doing so without
 * a reader ever seeing half of it, is group 7's.
 */
import type { SQL } from "bun";
import type {
	HeroEntry,
	MatchupMatrix,
	Role,
	SnapshotBundle,
	SynergyMatrix,
} from "../../types.ts";
import { prior, wholeDays } from "../build/blend.ts";
import { checkBundle } from "./contract.ts";

type HeroRow = {
	hero_id: number;
	name: string;
	short_name: string;
	icon: string;
	contest_rate: number;
	sufficient: boolean;
	side_adj_radiant: number;
	side_adj_dire: number;
	phase_adj_1: number;
	phase_adj_2: number;
	phase_adj_last: number;
};

type PositionRow = {
	hero_id: number;
	position: number;
	pick_share: number;
	meta_adj: number;
	sufficient: boolean;
};

type AliasRow = { hero_id: number; alias: string };
type MatchupRow = { hero_id: number; enemy_id: number; advantage_adj: number };
type SynergyRow = { hero_id: number; ally_id: number; synergy_adj: number };

/**
 * Render the newest published snapshot, or raise where none has published.
 *
 * Raising rather than returning nothing: the caller's answer to "there is no
 * bundle to publish" is to leave the served file alone and fail the run,
 * which is what `ingest` already does with a source it cannot read. What must
 * not happen is a file written from an empty render.
 */
export async function renderBundle(sql: SQL): Promise<SnapshotBundle> {
	// `status = 'published'` and nothing else: a newer snapshot at `building`
	// is one a run is part way through and a `failed` one never validated, so
	// the greatest id is not the question — the greatest published one is.
	const [snapshot] = await sql`SELECT s.snapshot_id, s.created_at,
			p.patch_id, p.is_major, p.detected_at
		FROM snapshots s JOIN patches p ON p.patch_id = s.patch_id
		WHERE s.status = 'published'
		ORDER BY s.snapshot_id DESC LIMIT 1`;
	if (snapshot === undefined)
		throw new Error(
			"no snapshot has published, so there is no bundle to render",
		);
	const id = snapshot.snapshot_id;

	const heroes: HeroRow[] = await sql`SELECT h.hero_id, h.name, h.short_name,
			h.icon, t.contest_rate, t.sufficient, t.side_adj_radiant,
			t.side_adj_dire, t.phase_adj_1, t.phase_adj_2, t.phase_adj_last
		FROM hero_stats t JOIN heroes h ON h.hero_id = t.hero_id
		WHERE t.snapshot_id = ${id} ORDER BY h.hero_id`;
	const aliases: AliasRow[] = await sql`SELECT hero_id, alias FROM hero_aliases
		ORDER BY hero_id, alias`;
	const positions: PositionRow[] = await sql`SELECT hero_id, position,
			pick_share, meta_adj, sufficient
		FROM hero_position_stats WHERE snapshot_id = ${id}
		ORDER BY hero_id, position`;
	// These two are read unordered where every read above is ordered, and
	// deliberately: they become objects keyed by hero id, and a key that looks
	// like an array index is enumerated in ascending numeric order whatever the
	// insertion order was. So the rendered bytes are the same bytes either way
	// — which group 8's ETag, being a hash of them, depends on.
	const matchups: MatchupRow[] = await sql`SELECT hero_id, enemy_id,
			advantage_adj
		FROM hero_matchups WHERE snapshot_id = ${id}`;
	const synergies: SynergyRow[] = await sql`SELECT hero_id, ally_id,
			synergy_adj
		FROM hero_synergies WHERE snapshot_id = ${id}`;

	const aliasesOf = byHero(aliases);
	const positionsOf = byHero(positions);

	const bundle: SnapshotBundle = {
		snapshotId: Number(id),
		createdAt: snapshot.created_at.toISOString(),
		patch: {
			id: snapshot.patch_id,
			isMajor: snapshot.is_major,
			detectedAt: utcDate(snapshot.detected_at),
		},
		stabilizing: stabilizing(
			snapshot.is_major,
			snapshot.detected_at,
			snapshot.created_at,
		),
		heroes: heroes.map((hero) => entry(hero, aliasesOf, positionsOf)),
		// Both directions are already stored, the build having written the
		// mirror negated, so grouping them is the whole of it.
		matchups: matrix(
			matchups,
			(row) => row.enemy_id,
			(row) => row.advantage_adj,
		),
		// Stored once under the lower id, so the other order is derived here
		// from the symmetry the build guaranteed rather than read back.
		synergies: mirrored(
			matrix(
				synergies,
				(row) => row.ally_id,
				(row) => row.synergy_adj,
			),
		),
	};
	// Before it is returned, so a bundle whose keys the client cannot read
	// never reaches the caller that would publish it. The types above cannot
	// stand in for this: they are gone by the time these objects exist, and
	// two of them are built by `Object.fromEntries` from database rows.
	checkBundle(bundle);
	return bundle;
}

/**
 * Whether the bundle marks its patch as still settling: major, and inside the
 * window over which the blend's prior still weighs.
 *
 * The window is not restated here. It is *Patch blending with a decaying
 * prior*'s own, read through `prior`, so the flag is true exactly while the
 * prior it stands for is still counting — a `t_max` refitted there moves this
 * with it, where a copied 4 would quietly disagree.
 *
 * The kind gates the window rather than choosing a row of the decay table: a
 * letter patch carries a prior too, and is never settling however recent.
 *
 * No column stores it. All three arguments are frozen when the snapshot is
 * built, so computing it at export answers the same forever, with one fewer
 * column that could disagree with what it derives from.
 */
export const stabilizing = (
	isMajor: boolean,
	detectedAt: Date,
	at: Date,
): boolean => isMajor && prior("major", wholeDays(detectedAt, at)) > 0;

/**
 * The calendar date of an instant, on the UTC timeline.
 *
 * The bare date is what the shipped contract holds for `patch.detectedAt` and
 * what `src/fixtures/snapshot.json` carries. Exported for the case that pins
 * the timeline: read through the machine's own calendar instead, a midnight
 * instant is the day before wherever the offset is negative, and a runner in
 * UTC cannot tell the two apart.
 */
export const utcDate = (at: Date): string => at.toISOString().slice(0, 10);

/** Rows of one table by `hero_id`, in the order they were read. */
function byHero<T extends { hero_id: number }>(rows: T[]): Map<number, T[]> {
	const held = new Map<number, T[]>();
	for (const row of rows)
		held.set(row.hero_id, [...(held.get(row.hero_id) ?? []), row]);
	return held;
}

/** One hero's entry, every key renamed from the column it was read out of. */
function entry(
	hero: HeroRow,
	aliasesOf: Map<number, AliasRow[]>,
	positionsOf: Map<number, PositionRow[]>,
): HeroEntry {
	return {
		id: hero.hero_id,
		name: hero.name,
		short: hero.short_name,
		icon: hero.icon,
		aliases: (aliasesOf.get(hero.hero_id) ?? []).map((row) => row.alias),
		sufficient: hero.sufficient,
		contest: hero.contest_rate,
		side: { radiant: hero.side_adj_radiant, dire: hero.side_adj_dire },
		phase: {
			p1: hero.phase_adj_1,
			p2: hero.phase_adj_2,
			last: hero.phase_adj_last,
		},
		positions: Object.fromEntries(
			(positionsOf.get(hero.hero_id) ?? []).map((row) => [
				// The position as a decimal string, which is what a JSON object
				// key is and what the client reads back.
				String(row.position) as `${Role}`,
				{
					share: row.pick_share,
					meta: row.meta_adj,
					sufficient: row.sufficient,
				},
			]),
		),
	};
}

/** A matrix keyed by hero id, from rows naming the other id and the value. */
function matrix<T extends { hero_id: number }>(
	rows: T[],
	other: (row: T) => number,
	value: (row: T) => number,
): MatchupMatrix {
	const held: MatchupMatrix = {};
	for (const row of rows) {
		const from = held[String(row.hero_id)] ?? {};
		from[String(other(row))] = value(row);
		held[String(row.hero_id)] = from;
	}
	return held;
}

/**
 * The same matrix with `[b][a]` filled from `[a][b]`, which synergy is.
 *
 * The caller's object, filled and handed back — not a copy. Every caller here
 * passes one built a line earlier, so nothing is aliased in the doing, but a
 * caller holding the argument afterwards holds the mirrored matrix. The case
 * for this clones before calling, for that reason.
 *
 * It writes into the object it is walking, and that is safe rather than
 * overlooked: `Object.entries` takes the keys as they are when it is called,
 * so a row added under a new id is not walked again, and one added under an
 * id already there is the same value written twice. Exported for the case
 * that reaches that second half, which needs three heroes — with two, the
 * only id the loop creates is one the snapshot never held.
 */
export function mirrored(held: SynergyMatrix): SynergyMatrix {
	for (const [a, from] of Object.entries(held))
		for (const [b, value] of Object.entries(from)) {
			const back = held[b] ?? {};
			back[a] = value;
			held[b] = back;
		}
	return held;
}
