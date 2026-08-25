/**
 * The rows a snapshot stores, assembled without a database: what a hero's
 * positions come out as, what a component staging never measured leaves
 * behind, and how a pair's two staged directions become its stored ones.
 */
import { describe, expect, test } from "bun:test";
import { type Prior, type Staging, snapshotRows } from "./rows.ts";

/** Staging holding only what a case names. */
const staging = (held: Partial<Staging> = {}): Staging => ({
	positions: [],
	heroes: [],
	matchups: [],
	synergies: [],
	sides: [],
	phases: [],
	...held,
});

/** No previous patch, so every delta below is the current patch's own. */
const alone: Prior = { weight: 0, wrOld: new Map() };

const hero = (heroId: number, matches = 1000) => ({
	heroId,
	matches,
	contestRate: 0.2,
});

describe("a hero's position rows", () => {
	test("carry the share, the delta and the sufficiency of each [72]", () => {
		const rows = snapshotRows(
			staging({
				positions: [
					{ heroId: 1, position: 1, matches: 600, wins: 360 },
					{ heroId: 1, position: 2, matches: 400, wins: 200 },
					{ heroId: 1, position: 3, matches: 0, wins: 0 },
				],
			}),
			alone,
		);

		// The position nobody played is absent, and the two that were played
		// share the thousand picks six to four.
		expect(rows.positions.map((row) => row.pick_share)).toEqual([0.6, 0.4]);
		// Sixty per cent is a positive delta; fifty is exactly none.
		expect(rows.positions[0]?.meta_adj).toBeGreaterThan(0);
		expect(rows.positions[1]?.meta_adj).toBe(0);
		// 600 clears the position threshold and 400 does not.
		expect(rows.positions.map((row) => row.sufficient)).toEqual([true, false]);
	});

	test("weigh only the positions that produced a row towards the hero [73]", () => {
		const rows = snapshotRows(
			staging({
				heroes: [hero(1)],
				positions: [
					{ heroId: 1, position: 1, matches: 900, wins: 450 },
					{ heroId: 1, position: 2, matches: 0, wins: 0 },
				],
			}),
			alone,
		);

		// 900 against a hero threshold of 1000: the unplayed position cannot
		// make up the difference, having produced no sample at all.
		expect(rows.heroes[0]?.sufficient).toBe(false);
	});
});

describe("a component staging did not measure", () => {
	const sides = [
		{ heroId: 1, part: "radiant", matches: 500, wins: 350 },
		{ heroId: 1, part: "dire", matches: 500, wins: 150 },
		{ heroId: 2, part: "radiant", matches: 500, wins: 300 },
		{ heroId: 2, part: "dire", matches: 500, wins: 200 },
	];

	test("is 0 on every hero while a measured one still stands [58] [61]", () => {
		const rows = snapshotRows(
			staging({ heroes: [hero(1), hero(2)], sides, phases: [] }),
			alone,
		);

		expect(
			rows.heroes.every(
				(row) =>
					row.phase_adj_1 === 0 &&
					row.phase_adj_2 === 0 &&
					row.phase_adj_last === 0,
			),
		).toBe(true);
		// The side deltas survive the phase rows' absence: the verdict is taken
		// per component, so one unmeasured component zeroes only itself.
		expect(rows.heroes[0]?.side_adj_radiant).toBeGreaterThan(0);
		expect(rows.heroes[0]?.side_adj_dire).toBeLessThan(0);
	});

	test("differs from a measured one this hero has no row for [74]", () => {
		const rows = snapshotRows(
			staging({ heroes: [hero(1), hero(2), hero(3)], sides, phases: [] }),
			alone,
		);

		// Hero 3 is written 0 like the phase columns are, and the difference
		// between the two is validation's to draw: this one fails a snapshot
		// where the phase columns publish.
		expect(rows.heroes[2]?.side_adj_radiant).toBe(0);
	});
});

describe("a pair's two staged directions", () => {
	test("become two stored rows that cancel exactly [75]", () => {
		const rows = snapshotRows(
			staging({
				// The two disagree, as a source answering per hero does.
				matchups: [
					{ heroId: 1, otherId: 2, matches: 400, wins: 240 },
					{ heroId: 2, otherId: 1, matches: 380, wins: 150 },
				],
			}),
			alone,
		);

		expect(rows.matchups).toHaveLength(2);
		expect(rows.matchups[0]?.advantage_adj).not.toBe(0);
		expect(
			(rows.matchups[0]?.advantage_adj ?? 0) +
				(rows.matchups[1]?.advantage_adj ?? 0),
		).toBe(0);
	});

	test("are read from the lower id's side even when only the mirror is staged [76]", () => {
		const rows = snapshotRows(
			staging({
				matchups: [{ heroId: 2, otherId: 1, matches: 400, wins: 100 }],
			}),
			alone,
		);

		// Hero 2 won a quarter of them, so hero 1 won three quarters, and the
		// row named for hero 1 is the positive one.
		expect(rows.matchups[0]).toMatchObject({ hero_id: 1, enemy_id: 2 });
		expect(rows.matchups[0]?.advantage_adj).toBeGreaterThan(0);
	});

	test("become one synergy row, held on the lower id [77]", () => {
		const rows = snapshotRows(
			staging({
				synergies: [
					{ heroId: 1, otherId: 2, matches: 300, wins: 180 },
					{ heroId: 2, otherId: 1, matches: 300, wins: 180 },
				],
			}),
			alone,
		);

		expect(rows.synergies).toHaveLength(1);
		expect(rows.synergies[0]).toMatchObject({ hero_id: 1, ally_id: 2 });
		expect(rows.synergies[0]?.synergy_adj).toBeGreaterThan(0);
	});

	test("yield no row at all where there is nothing to blend [78]", () => {
		const rows = snapshotRows(
			staging({ matchups: [{ heroId: 1, otherId: 2, matches: 0, wins: 0 }] }),
			alone,
		);

		// No matches and no prior: a stored 0 would read as a measured draw.
		expect(rows.matchups).toEqual([]);
	});
});
