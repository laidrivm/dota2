/**
 * The greedy completion at the search's depth limit (design D8): each team's
 * remaining picks made by its best open slot, its remaining bans skipped.
 */
import { expect, test } from "bun:test";
import type { HeroEntry } from "../../types.ts";
import type { DraftState, Rostered } from "./draft.ts";
import { bundle, everywhere, hero } from "./engine.fixture.ts";
import { completed } from "./search.ts";

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

test("the greedy completion takes each team's best open slot, and skips the bans", () => {
	// Picking second, step 8 is the enemy's pick and 9 the captain's.
	const b = bundle([
		hero(11, everywhere, { side: { radiant: 0, dire: 2 } }),
		hero(12, { "1": 3 }),
		hero(13, { "1": 2.5 }),
		hero(14, everywhere),
		...fillers(200, 30),
	]);
	const ours = five();
	ours[0] = { position: 2, rank: null, signatures: [14] };
	const steps = completed(
		b,
		state([901, 902, 903, 904, 905, 906, 907], { ours }),
	).steps;
	// Enemy: 12 at its position 1 (3). Captain: 14 at position 2, its holder's
	// signature (3), over 13 (2.5). Bans 10–12 hold their places. Captain: 13
	// at its still-open position 1. Enemy: 11 (2) — 13 would be off-role there.
	expect(steps.slice(7, 14)).toEqual([12, 14, -10, -11, -12, 13, 11]);
	expect(steps).toHaveLength(24);
	expect(new Set(steps).size).toBe(24);
});

test("the completion starts from the positions each team already holds, weighed by rank", () => {
	const b = bundle([
		hero(11, everywhere, { side: { radiant: 0, dire: 2 } }),
		hero(12, { "1": 3 }),
		hero(13, { "1": 2.6 }),
		hero(14, everywhere),
		hero(15, { "1": 2.8 }),
		...fillers(200, 30),
	]);
	const ours = five();
	ours[0] = { position: 2, rank: 8, signatures: [14] };
	ours[1] = { position: null, rank: 4, signatures: [] };
	// The enemy already holds 12, at its position 1.
	const steps = completed(
		b,
		state([901, 902, 903, 904, 905, 906, 907, 12], { ours }),
	).steps;
	// Captain: 14 at position 2, weighted 1.2 by a rank 8 in a mean of 6 (3.6)
	// over 15 (2.8). Captain: 15 at position 1 (2.8) over 13 (2.6). Enemy: 11
	// (2), its position 1 being held — 13 there would be off-role. Then each
	// team takes the first filler of equal worth, the bans keep their places.
	expect(steps.slice(8)).toEqual([
		14, -10, -11, -12, 15, 11, 200, 201, 202, 203, -19, -20, -21, -22, 204, 205,
	]);
});

test("a pick with no hero left to take holds its place too", () => {
	const b = bundle(fillers(200, 2));
	const steps = completed(b, state([])).steps;
	expect(steps).toHaveLength(24);
	expect(steps.filter((id) => id > 0).sort()).toEqual([200, 201]);
	expect(new Set(steps).size).toBe(24);
});

test("the completion reads each pick's phase from the team's own count, and the captain's held positions", () => {
	// Picking first: the captain already holds 12 at position 1 (step 8). Every
	// named hero costs the enemy 5, so it drafts fillers 200 and 201.
	const special = (
		id: number,
		positions: typeof everywhere | { "1": number },
		phase: Partial<Record<"p1" | "p2" | "last", number>>,
	) =>
		hero(id, positions, {
			side: { radiant: 0, dire: -5 },
			phase: { p1: 0, p2: 0, last: 0, ...phase },
		});
	const b = bundle([
		...fillers(200, 30),
		special(11, everywhere, { p2: 2 }),
		special(12, { "1": 3 }, {}),
		special(13, { "1": 2.6 }, {}),
		special(17, everywhere, { last: 2.5 }),
		special(18, everywhere, { p1: 3 }),
	]);
	const at = state([901, 902, 903, 904, 905, 906, 907, 12], {
		pickOrder: "first",
	});
	const steps = completed(b, at).steps;
	// Step 14, the captain's second pick (p2): 11 (2), not 13 at the position
	// it already holds, nor 17 (last) or 18 (p1). Step 15, its third (p2
	// still): nothing named is worth anything there, so the first free filler.
	expect([steps[8], steps[12], steps[13], steps[14]]).toEqual([
		200, 201, 11, 202,
	]);
});
