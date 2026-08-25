/**
 * Staging rows in, a snapshot's statistics rows out.
 *
 * The whole of the build that is not SQL: `build.ts` reads the tables, hands
 * what they held to `snapshotRows`, and writes what comes back. Keeping the
 * two apart is what lets the part with the failure modes be read without a
 * database in front of it (design.md §*The arithmetic is a pure module*).
 *
 * Field names are the shape the arithmetic wants; `build.ts` maps them to
 * columns at the insert, as `staging.ts` does on the way in.
 */
import { adj, isMeasured, type Statistic, wrBlend } from "./blend.ts";
import { heroSufficient, pickShares, positionSufficient } from "./positions.ts";

export type PositionRow = {
	heroId: number;
	position: number;
	matches: number;
	wins: number;
};
/** No winrate: `hero_stats` stores contest and the component deltas, and a
 * hero's overall winrate is not among them. */
export type HeroRow = {
	heroId: number;
	matches: number;
	contestRate: number;
};
export type PairRow = {
	heroId: number;
	otherId: number;
	matches: number;
	wins: number;
};
/** A side or a phase row, `part` being `radiant`/`dire` or `1`/`2`/`last`. */
export type SplitRow = {
	heroId: number;
	part: string;
	matches: number;
	wins: number;
};

/** Everything one patch's staging holds, as the build reads it. */
export type Staging = {
	positions: PositionRow[];
	heroes: HeroRow[];
	matchups: PairRow[];
	synergies: PairRow[];
	sides: SplitRow[];
	phases: SplitRow[];
};

/**
 * The previous patch's contribution: how many virtual matches it still
 * carries, and the winrate each statistic had in its newest published
 * snapshot. A statistic that snapshot did not hold is simply absent, which is
 * what `wrBlend` reads as nothing to pull towards.
 */
export type Prior = {
	weight: number;
	wrOld: ReadonlyMap<string, number>;
};

/**
 * The key one statistic's `wr_old` is filed under. Exported so that the map's
 * writer and its reader cannot spell a key two ways.
 */
export const priorKey = (
	statistic: Statistic,
	...of: (string | number)[]
): string => [statistic, ...of].join(":");

/**
 * Everything a snapshot stores, one field per column.
 *
 * Named after the columns rather than after the arithmetic: these rows exist
 * only to be inserted, and a second spelling of every field is a second place
 * for one of them to be wrong. `snapshot_id` is the insert's to add — it is
 * the one value this module has no way of knowing.
 */
export type SnapshotRows = {
	positions: {
		hero_id: number;
		position: number;
		matches: number;
		pick_share: number;
		meta_adj: number;
		sufficient: boolean;
	}[];
	heroes: {
		hero_id: number;
		matches: number;
		contest_rate: number;
		side_adj_radiant: number;
		side_adj_dire: number;
		phase_adj_1: number;
		phase_adj_2: number;
		phase_adj_last: number;
		sufficient: boolean;
	}[];
	matchups: {
		hero_id: number;
		enemy_id: number;
		matches: number;
		advantage_adj: number;
	}[];
	synergies: {
		hero_id: number;
		ally_id: number;
		matches: number;
		synergy_adj: number;
	}[];
};

/** One unordered pair and the single row the build reads it from. */
type Pairing = { a: number; b: number; row: PairRow };

/**
 * One row per unordered pair, read from the lower id's side.
 *
 * Both directions of a pair count the same matches — the source answers per
 * hero, so every pair comes back once from each end — which makes them one
 * statistic rather than two samples to add. The lower id's row is the one
 * read, and the mirror stands in only where it is the only row there is.
 */
function pairings(rows: PairRow[]): Pairing[] {
	const found = new Map<string, Pairing>();
	for (const row of rows) {
		const a = Math.min(row.heroId, row.otherId);
		const b = Math.max(row.heroId, row.otherId);
		const key = `${a}:${b}`;
		if (row.heroId === a || !found.has(key)) found.set(key, { a, b, row });
	}
	return [...found.values()];
}

/** One statistic's stored delta and its sample, or nothing where no row is written. */
function delta(
	statistic: Statistic,
	matches: number,
	wins: number,
	prior: Prior,
	...of: (string | number)[]
): { adj: number; nEff: number } | undefined {
	const blended = wrBlend(
		matches,
		// Unread where `matches` is 0: `wrBlend` answers from the prior alone,
		// or refuses the statistic altogether.
		matches === 0 ? 0 : (wins / matches) * 100,
		prior.weight,
		prior.wrOld.get(priorKey(statistic, ...of)),
	);
	if (blended === undefined) return undefined;
	return { adj: adj(statistic, blended), nEff: blended.nEff };
}

/** Everything a snapshot stores, from one patch's staging and its predecessor. */
export function snapshotRows(staging: Staging, prior: Prior): SnapshotRows {
	const positions: SnapshotRows["positions"] = [];
	// The samples each hero's own threshold is measured over, collected as the
	// position rows are written so that a position yielding no row weighs
	// nothing towards it either.
	const nEffs = new Map<number, number[]>();
	for (const [heroId, rows] of Map.groupBy(
		staging.positions,
		(row) => row.heroId,
	)) {
		const shares = pickShares(rows);
		const samples: number[] = [];
		for (const row of rows) {
			const pickShare = shares.get(row.position);
			const blended = delta(
				"position",
				row.matches,
				row.wins,
				prior,
				heroId,
				row.position,
			);
			if (pickShare === undefined || blended === undefined) continue;
			positions.push({
				hero_id: heroId,
				position: row.position,
				matches: row.matches,
				pick_share: pickShare,
				meta_adj: blended.adj,
				sufficient: positionSufficient(blended.nEff),
			});
			samples.push(blended.nEff);
		}
		nEffs.set(heroId, samples);
	}

	/** One component's rows, by hero and part, and whether it was measured. */
	const component = (rows: SplitRow[]) => ({
		measured: isMeasured(rows),
		by: new Map(rows.map((row) => [`${row.heroId}:${row.part}`, row])),
	});
	const sides = component(staging.sides);
	const phases = component(staging.phases);

	const heroes = staging.heroes.map((hero) => {
		const split = (
			of: { measured: boolean; by: Map<string, SplitRow> },
			statistic: "side" | "phase",
			part: string,
		): number => {
			const row = of.by.get(`${hero.heroId}:${part}`);
			// An unmeasured component is 0 on every hero row. A measured one this
			// hero has no row for is written 0 as well, and validation is where
			// the two stop being the same answer: one publishes, the other fails.
			if (!of.measured || row === undefined) return 0;
			return (
				delta(statistic, row.matches, row.wins, prior, hero.heroId, part)
					?.adj ?? 0
			);
		};
		return {
			hero_id: hero.heroId,
			matches: hero.matches,
			contest_rate: hero.contestRate,
			side_adj_radiant: split(sides, "side", "radiant"),
			side_adj_dire: split(sides, "side", "dire"),
			phase_adj_1: split(phases, "phase", "1"),
			phase_adj_2: split(phases, "phase", "2"),
			phase_adj_last: split(phases, "phase", "last"),
			sufficient: heroSufficient(nEffs.get(hero.heroId) ?? []),
		};
	});

	const matchups: SnapshotRows["matchups"] = [];
	for (const { a, b, row } of pairings(staging.matchups)) {
		// From `a`'s side whichever row survived: the mirror's wins are `a`'s
		// losses, the two rows being the same games seen from opposite ends.
		const wins = row.heroId === a ? row.wins : row.matches - row.wins;
		const blended = delta("matchup", row.matches, wins, prior, a, b);
		if (blended === undefined) continue;
		// Negated rather than computed twice, which is what makes the pair
		// antisymmetric exactly rather than to within two roundings.
		matchups.push(
			{
				hero_id: a,
				enemy_id: b,
				matches: row.matches,
				advantage_adj: blended.adj,
			},
			{
				hero_id: b,
				enemy_id: a,
				matches: row.matches,
				advantage_adj: -blended.adj,
			},
		);
	}

	const synergies: SnapshotRows["synergies"] = [];
	for (const { a, b, row } of pairings(staging.synergies)) {
		// Symmetric, so the side it was read from does not matter: a pair's
		// wins together are the same wins from either hero's row.
		const blended = delta("synergy", row.matches, row.wins, prior, a, b);
		if (blended === undefined) continue;
		synergies.push({
			hero_id: a,
			ally_id: b,
			matches: row.matches,
			synergy_adj: blended.adj,
		});
	}

	return { positions, heroes, matchups, synergies };
}
