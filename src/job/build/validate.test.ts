/**
 * The four checks a snapshot's rows are refused by, read without a database.
 *
 * That a refusal reaches `status = 'failed'` and that a pass reaches
 * `published` is `build-lifecycle.test.ts`'s; here the boundaries are staged
 * directly, being counts, sums and deltas no staging fixture hits exactly.
 */
import { describe, expect, test } from "bun:test";
import type { SnapshotRows, SplitRow, Staging } from "./rows.ts";
import { invalidReason } from "./validate.ts";

/** A hero row carrying its id and whatever the case overrides. */
const hero = (
	heroId: number,
	over: Partial<SnapshotRows["heroes"][number]> = {},
): SnapshotRows["heroes"][number] => ({
	hero_id: heroId,
	matches: 0,
	contest_rate: 0,
	side_adj_radiant: 0,
	side_adj_dire: 0,
	phase_adj_1: 0,
	phase_adj_2: 0,
	phase_adj_last: 0,
	sufficient: false,
	...over,
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
	heroes: SnapshotRows["heroes"],
	positions: SnapshotRows["positions"] = [],
): SnapshotRows => ({ positions, heroes, matchups: [], synergies: [] });

/** Staging nothing was read into, which the first three checks never look at. */
const NOTHING_STAGED: Staging = {
	positions: [],
	heroes: [],
	matchups: [],
	synergies: [],
	sides: [],
	phases: [],
};

const reason = (
	rows: SnapshotRows,
	over: { published?: number; staging?: Partial<Staging> } = {},
): string | undefined =>
	invalidReason(
		rows,
		{ ...NOTHING_STAGED, ...over.staging },
		over.published ?? 0,
	);

/** A side row per hero and part, less whichever `without` names. */
const sideRows = (heroIds: number[], without?: string): SplitRow[] =>
	heroIds
		.flatMap((heroId) =>
			(["radiant", "dire"] as const).map((part) => ({
				heroId,
				part,
				matches: 100,
				wins: 50,
			})),
		)
		.filter((row) => `${row.heroId}:${row.part}` !== without);

describe("what refuses a snapshot", () => {
	test("a hero count equal to the newest published's passes, one below fails [18]", () => {
		expect(reason(rowsOf([1, 2, 3].map((id) => hero(id))), { published: 3 })) //
			.toBeUndefined();
		expect(reason(rowsOf([hero(1), hero(2)]), { published: 3 })).toContain(
			"2 hero rows",
		);
		// No published snapshot reaches this as a count of 0, which nothing can
		// fall below — the half of *The first snapshot* that is arithmetic.
		expect(reason(rowsOf([]))).toBeUndefined();
	});

	test("shares within the tolerance pass and a short distribution fails [19]", () => {
		// The two offsets are exact binary fractions either side of 1e-6 —
		// 2 ** -20 below it, 2 ** -19 above — so each sum is the number meant
		// here rather than that number plus whatever the addition rounded to.
		const off = (by: number) => rowsOf([hero(1)], shares(1, 0.5, 0.5 - by));
		expect(reason(off(2 ** -20))).toBeUndefined();
		expect(reason(off(2 ** -19))).toContain("position shares");
		expect(reason(off(0.2))).toContain("sum to 0.8");
		// Not a number is not within tolerance, which a check written as a
		// detected failure rather than a refused pass would let through: every
		// comparison against `NaN` is false, this one included.
		expect(reason(off(Number.NaN))).toContain("sum to NaN");
	});

	test("a hero's shares are summed against its own rows alone [19]", () => {
		// Two heroes at half each: summed across the snapshot that is 1 and
		// passes, summed per hero it is two broken distributions.
		const split = [...shares(1, 0.5), ...shares(2, 0.5)];
		expect(reason(rowsOf([hero(1), hero(2)], split))).toContain(
			"position shares",
		);
	});

	test("a delta of exactly ±25 passes and beyond it fails [20]", () => {
		const at = (side_adj_radiant: number) =>
			rowsOf([hero(1, { side_adj_radiant })]);
		expect(reason(at(25))).toBeUndefined();
		expect(reason(at(-25))).toBeUndefined();
		// `side_adj_radiant` deliberately: the token sits in the middle of five
		// of the eight delta columns, so a check testing the column name's
		// suffix passes this row without looking at it.
		expect(reason(at(25.000001))).toContain("side_adj_radiant");
		expect(reason(at(-40))).toContain("beyond ±25");
		expect(reason(at(Number.NaN))).toContain("side_adj_radiant");
	});

	test("a delta beyond the bound is caught in every table [20]", () => {
		const positions = shares(1, 1).map((row) => ({ ...row, meta_adj: 90 }));
		expect(reason(rowsOf([hero(1)], positions))).toContain("meta_adj");
		expect(
			reason({
				...rowsOf([hero(1)]),
				synergies: [{ hero_id: 1, ally_id: 2, matches: 0, synergy_adj: 30 }],
			}),
		).toContain("synergy_adj");
	});

	// spec: snapshot-build/a-component-measured-for-some-heroes-only
	test("a component measured for every hero but one fails [59]", () => {
		const heroes = [
			{ heroId: 1, matches: 0, contestRate: 0 },
			{ heroId: 2, matches: 0, contestRate: 0 },
		];
		const whole = { staging: { heroes, sides: sideRows([1, 2]) } };
		expect(reason(rowsOf([hero(1), hero(2)]), whole)).toBeUndefined();

		const holed = { staging: { heroes, sides: sideRows([1, 2], "2:dire") } };
		expect(reason(rowsOf([hero(1), hero(2)]), holed)).toContain(
			"hero 2 has no dire row",
		);
	});

	// spec: snapshot-build/a-part-the-component-never-measured
	test("a part no hero was measured on is no hole [89]", () => {
		const heroes = [{ heroId: 1, matches: 0, contestRate: 0 }];
		// Radiant for every hero and dire for none is 0 on every hero row, which
		// reorders nothing — the same reading that lets a whole unmeasured
		// component publish. A check against a written-down list of parts would
		// refuse this instead.
		const radiantOnly: SplitRow[] = [
			{ heroId: 1, part: "radiant", matches: 100, wins: 50 },
		];
		expect(
			reason(rowsOf([hero(1)]), { staging: { heroes, sides: radiantOnly } }),
		).toBeUndefined();
		// And a component staging holds nothing for has no hole either.
		expect(reason(rowsOf([hero(1)]), { staging: { heroes } })).toBeUndefined();
	});
});
