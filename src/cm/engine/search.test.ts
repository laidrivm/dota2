/**
 * The search past the step in progress (cm-model, *The search looks past the
 * enemy's answer*; design D8): a ban is a move the enemy answers, the ranking
 * comes from the deepest depth completed, and the budget ends a depth rather
 * than the search.
 */
import { describe, expect, test } from "bun:test";
import type { HeroEntry } from "../../types.ts";
import { type DraftState, type Rostered, teamsOf, valued } from "./draft.ts";
import { bundle, everywhere, hero } from "./engine.fixture.ts";
import { completed, search } from "./search.ts";
import { suggest } from "./suggest.ts";

const unplaced: Rostered = { position: null, rank: null, signatures: [] };
const five = () => [0, 1, 2, 3, 4].map(() => unplaced);
const state = (
	steps: number[],
	over: Partial<DraftState> = {},
): DraftState => ({
	side: "radiant",
	pickOrder: "second",
	steps,
	ours: five(),
	theirs: five(),
	...over,
});

/** Heroes worth nothing to either team, to fill the picks around a case. */
const fillers = (from: number, count: number): HeroEntry[] =>
	Array.from({ length: count }, (_, i) => hero(from + i, everywhere));

const forever = { budgetMs: Number.POSITIVE_INFINITY, now: () => 0 };

/**
 * Picking second, the captain bans at step 7. X (101) is worth 3 to the enemy
 * (Dire) and Y (102) 2, so the immediate ranking bans X. But Y and Z (103)
 * are worth 4 to the enemy together: banning X leaves it Y and Z, 6 in all;
 * banning Y leaves it X and Z, 3. All three cost the captain's side 1, so the
 * captain's own picks go to the fillers and the enemy is left to draft them.
 */
const banCase = () => {
	const dire = (id: number, value: number) =>
		hero(id, everywhere, { side: { radiant: -1, dire: value } });
	const b = bundle(
		[dire(101, 3), dire(102, 2), dire(103, 0), ...fillers(200, 30)],
		{
			synergies: { "102": { "103": 4 }, "103": { "102": 4 } },
		},
	);
	return { b, at: state([901, 902, 903, 904, 905, 906]) };
};

// spec: cm-model/a-ban-that-would-hand-the-enemy-a-better-pick
test("a ban that leaves the enemy a pick the captain cannot counter ranks below one that does", () => {
	const { b, at } = banCase();
	const immediate = suggest(b, at)?.entries.map((e) => e.hero) ?? [];
	expect(immediate.indexOf(101)).toBeLessThan(immediate.indexOf(102));
	const result = search(b, at, { ...forever, maxDepth: 3 });
	expect(result).toMatchObject({
		step: 7,
		action: "ban",
		team: "ours",
		depth: 3,
	});
	const ranked = result?.entries.map((e) => e.hero) ?? [];
	expect(ranked).toHaveLength(5);
	expect(ranked.indexOf(102)).toBeGreaterThanOrEqual(0);
	expect(ranked.indexOf(102)).toBeLessThan(ranked.indexOf(101));
});

test("each suggestion's parts still add up to its score", () => {
	const { b, at } = banCase();
	for (const entry of search(b, at, { ...forever, maxDepth: 3 })?.entries ??
		[]) {
		const sum = Object.values(entry.components).reduce((a, v) => a + v, 0);
		expect(Math.abs(sum - entry.score)).toBeLessThan(0.05);
	}
});

test("when the budget ends mid-depth, the last completed depth's ranking stands", () => {
	const { b, at } = banCase();
	// The clock reads 0 until depth 1 is done, then past any budget.
	let reads = 0;
	const now = () => (reads++ < 1 ? 0 : 1e9);
	const cut = search(b, at, { budgetMs: 1500, now, maxDepth: 3 });
	const one = search(b, at, { ...forever, maxDepth: 1 });
	expect(cut?.depth).toBe(1);
	expect(cut?.entries).toEqual(one?.entries ?? []);
});

test("the search goes no deeper than the steps the draft has left", () => {
	const b = bundle(fillers(200, 30));
	const late = state(Array.from({ length: 22 }, (_, i) => 900 + i));
	expect(search(b, late, forever)?.depth).toBe(2);
	expect(
		search(b, state(Array.from({ length: 24 }, (_, i) => 900 + i)), forever),
	).toBeNull();
});

/**
 * Picking second, step 8 is the enemy's first pick. X (102) is worth 3 to it
 * and W (101) 2; the fillers are worth 0.1 to the captain and nothing to it.
 * One step deep, every root move ends in the same draft — the enemy takes X
 * and W either way — so they tie, by id. Two deep, the captain answers X with
 * C (103), who beats X by 5 in lane, so the enemy keeps away from X.
 */
const counterCase = () => {
	const enemy = (id: number, value: number) =>
		hero(id, everywhere, { side: { radiant: -1, dire: value } });
	const filler = (id: number) =>
		hero(id, everywhere, { side: { radiant: 0.1, dire: 0 } });
	const b = bundle(
		[
			enemy(102, 3),
			enemy(101, 2),
			hero(103, everywhere),
			...Array.from({ length: 30 }, (_, i) => filler(200 + i)),
		],
		{ matchups: { "103": { "102": 5 }, "102": { "103": -5 } } },
	);
	return { b, at: state([901, 902, 903, 904, 905, 906, 907]) };
};

test("one step deep a tie goes to the lower id; two deep the enemy avoids the pick the captain counters", () => {
	const { b, at } = counterCase();
	const one = search(b, at, { ...forever, maxDepth: 1 });
	expect(one).toMatchObject({ team: "theirs", action: "pick", depth: 1 });
	expect(one?.entries.map((e) => e.hero)).toEqual([101, 102, 103, 200, 201]);
	const two = search(b, at, { ...forever, maxDepth: 2 });
	expect(two?.depth).toBe(2);
	expect(two?.entries.map((e) => e.hero)).toEqual([101, 103, 200, 201, 202]);
});

test("a score is the evaluation reached less the evaluation now", () => {
	const { b } = counterCase();
	// The enemy already holds X, so the evaluation now is not zero.
	const at = state([901, 902, 903, 904, 905, 906, 907, 102]);
	const value = (s: DraftState) => {
		const { ours, theirs } = valued(b, teamsOf(b, s));
		return ours.total - theirs.total;
	};
	const [best] = search(b, at, { ...forever, maxDepth: 1 })?.entries ?? [];
	const after = completed(b, { ...at, steps: [...at.steps, best?.hero ?? 0] });
	expect(value(at)).not.toBe(0);
	expect(best?.score).toBeCloseTo(value(after) - value(at), 10);
});

describe("the budget", () => {
	const reads = (...times: number[]) => {
		let i = 0;
		return () => times[Math.min(i++, times.length - 1)] ?? 0;
	};

	test("running out inside a depth throws that depth away", () => {
		const { b, at } = counterCase();
		const result = search(b, at, {
			budgetMs: 10,
			now: reads(1000, 1000, 1000, 5000),
			maxDepth: 2,
		});
		expect(result?.depth).toBe(1);
	});

	test("a budget reached exactly is spent", () => {
		const { b, at } = counterCase();
		const result = search(b, at, {
			budgetMs: 10,
			now: reads(1000, 1010),
			maxDepth: 2,
		});
		expect(result?.depth).toBe(1);
	});

	test("depth 1 is shown however small the budget, on the real clock", () => {
		const { b, at } = counterCase();
		expect(search(b, at, { budgetMs: 0 })?.depth).toBe(1);
	});

	test("an error other than the budget's reaches the caller", () => {
		const { b, at } = counterCase();
		const failing = () => {
			throw new Error("clock");
		};
		const now = (() => {
			let i = 0;
			return () => (i++ < 2 ? 0 : failing());
		})();
		expect(() => search(b, at, { budgetMs: 10, now, maxDepth: 2 })).toThrow(
			"clock",
		);
	});
});

test("an enemy answer inside the search is the one worst for the captain", () => {
	// Picking second, step 7 is the captain's ban and step 8 the enemy's pick.
	// Banning W leaves the enemy X, which the captain counters at step 9, so
	// the enemy turns to a filler and drafts X later, uncountered: −2.5.
	// Banning X leaves it W: −1.5, the best ban.
	const { b } = counterCase();
	const result = search(b, state([901, 902, 903, 904, 905, 906]), {
		...forever,
		maxDepth: 3,
	});
	expect(result?.entries.slice(0, 2).map((e) => e.hero)).toEqual([102, 101]);
	expect(result?.entries[0]?.score).toBeCloseTo(-1.5, 10);
});

test("a clock that stands still lets the deeper depth finish", () => {
	const { b, at } = counterCase();
	const result = search(b, at, { budgetMs: 10, now: () => 1000, maxDepth: 2 });
	expect(result?.depth).toBe(2);
});

test("the pruning saves nodes: 144 at depth 3 here, where a search that prunes nothing visits 248", () => {
	// Measured once, both ways: pinned because a search that prunes less
	// returns the same ranking, and only the work it did tells them apart.
	const { b } = counterCase();
	const result = search(b, state([901, 902, 903, 904, 905, 906]), {
		...forever,
		maxDepth: 3,
	});
	expect(result?.nodes).toBe(144);
});
