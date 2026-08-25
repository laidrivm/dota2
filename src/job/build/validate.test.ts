/**
 * The two checks a snapshot's rows are refused by, read without a database.
 *
 * That a refusal reaches `status = 'failed'` and that a pass reaches
 * `published` is `build-lifecycle.test.ts`'s; here the boundaries are staged
 * directly, being counts and sums no staging fixture hits exactly.
 */
import { describe, expect, test } from "bun:test";
import type { SnapshotRows } from "./rows.ts";
import { invalidReason } from "./validate.ts";

/** A hero row carrying nothing but its id: no check below reads the rest. */
const hero = (heroId: number): SnapshotRows["heroes"][number] => ({
	hero_id: heroId,
	matches: 0,
	contest_rate: 0,
	side_adj_radiant: 0,
	side_adj_dire: 0,
	phase_adj_1: 0,
	phase_adj_2: 0,
	phase_adj_last: 0,
	sufficient: false,
});

/** One hero's position rows, at the shares given and one position each. */
const shares = (heroId: number, ...held: number[]): SnapshotRows["positions"] =>
	held.map((pick_share, index) => ({
		hero_id: heroId,
		position: index + 1,
		matches: 0,
		pick_share,
		meta_adj: 0,
		sufficient: false,
	}));

const rowsOf = (
	heroes: number[],
	positions: SnapshotRows["positions"] = [],
): SnapshotRows => ({
	positions,
	heroes: heroes.map(hero),
	matchups: [],
	synergies: [],
});

describe("what refuses a snapshot", () => {
	test("a hero count equal to the newest published's passes, one below fails [18]", () => {
		expect(invalidReason(rowsOf([1, 2, 3]), 3)).toBeUndefined();
		expect(invalidReason(rowsOf([1, 2]), 3)).toContain("2 hero rows");
		// No published snapshot reaches this as a count of 0, which nothing can
		// fall below — the half of *The first snapshot* that is arithmetic.
		expect(invalidReason(rowsOf([]), 0)).toBeUndefined();
	});

	test("shares within the tolerance pass and a short distribution fails [19]", () => {
		// The two offsets are exact binary fractions either side of 1e-6 —
		// 2 ** -20 below it, 2 ** -19 above — so each sum is the number meant
		// here rather than that number plus whatever the addition rounded to.
		const off = (by: number) => rowsOf([1], shares(1, 0.5, 0.5 - by));
		expect(invalidReason(off(2 ** -20), 0)).toBeUndefined();
		expect(invalidReason(off(2 ** -19), 0)).toContain("position shares");
		expect(invalidReason(off(0.2), 0)).toContain("sum to 0.8");
	});

	test("a hero's shares are summed against its own rows alone [19]", () => {
		// Two heroes at half each: summed across the snapshot that is 1 and
		// passes, summed per hero it is two broken distributions.
		const split = [...shares(1, 0.5), ...shares(2, 0.5)];
		expect(invalidReason(rowsOf([1, 2], split), 0)).toContain(
			"position shares",
		);
	});
});
