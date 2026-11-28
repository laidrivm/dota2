/**
 * Heroes assigned to positions (cm-model, *Heroes are assigned to the
 * positions that maximise the team*), and the draft read into two valued
 * teams by the order.
 */
import { expect, test } from "bun:test";
import type { HeroId, Role } from "../../types.ts";
import {
	assignTeam,
	type DraftState,
	type Rostered,
	teamsOf,
} from "./draft.ts";
import { bundle, hero } from "./engine.fixture.ts";
import { teamValue } from "./value.ts";

const unplaced: Rostered = { position: null, rank: null, signatures: [] };
const roster = (over: Partial<Record<number, Partial<Rostered>>> = {}) =>
	[0, 1, 2, 3, 4].map((i) => ({ ...unplaced, ...over[i] }));

const positionsOf = (slots: { hero: HeroId; position: Role }[]) =>
	Object.fromEntries(slots.map((slot) => [slot.hero, slot.position]));

// spec: cm-model/a-flexible-hero-takes-the-open-slot
test("a flexible hero takes the open slot: 4.5 against −7.0 for the swap", () => {
	const b = bundle([hero(1, { "1": 2.0 }), hero(2, { "1": 3.0, "3": 2.5 })]);
	const slots = assignTeam(b, [1, 2], roster());
	expect(positionsOf(slots)).toEqual({ 1: 1, 2: 3 });
	const value = (s: typeof slots) =>
		teamValue(b, { side: "radiant", players: roster(), slots: s }, []).total;
	expect(value(slots)).toBeCloseTo(4.5, 10);
	const swapped = slots.map((slot) => ({
		...slot,
		position: (slot.position === 1 ? 3 : 1) as Role,
	}));
	expect(value(swapped)).toBeCloseTo(-7.0, 10);
});

test("the best of every assignment beats placing each pick greedily in turn", () => {
	// Greedy puts hero 1 at position 1 (5.0) and leaves hero 2 off-role (−10);
	// the best puts hero 1 at 2 (4.9) and hero 2 at 1 (5.0). Heroes 3–5 fill
	// the rest, so all five positions are in play.
	const b = bundle([
		hero(1, { "1": 5.0, "2": 4.9 }),
		hero(2, { "1": 5.0 }),
		hero(3, { "3": 1 }),
		hero(4, { "4": 1 }),
		hero(5, { "5": 1 }),
	]);
	const slots = assignTeam(b, [1, 2, 3, 4, 5], roster());
	expect(positionsOf(slots)).toEqual({ 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 });
});

test("a pick playable nowhere still gets a position, at the off-role cost", () => {
	const b = bundle([hero(1, { "1": 1 }), hero(2, { "1": 2 })]);
	const slots = assignTeam(b, [1, 2], roster());
	expect(slots).toHaveLength(2);
	expect(positionsOf(slots)[2]).toBe(1);
	expect(
		teamValue(b, { side: "radiant", players: roster(), slots }, []).parts.meta,
	).toBeCloseTo(2 - 10, 10);
});

test("a known position's player weighs the hero placed there", () => {
	const b = bundle([hero(1, { "2": 1, "3": 1 })]);
	const players = roster({ 0: { position: 3, rank: null, signatures: [1] } });
	const [slot] = assignTeam(b, [1], players);
	// Equal meta at 2 and 3: the signature at position 3 decides it.
	expect(slot?.position).toBe(3);
	expect(slot?.player).toBe(players[0] ?? null);
});

test("the draft's picks split into the two teams by the order, each assigned", () => {
	const b = bundle(
		[1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => hero(id, { "1": 1 })),
	);
	const state: DraftState = {
		side: "dire",
		pickOrder: "first",
		// Seven bans, then step 8 is ours (A) and step 9 theirs.
		steps: [1, 2, 3, 4, 5, 6, 7, 8, 9],
		ours: roster(),
		theirs: roster(),
	};
	const { ours, theirs } = teamsOf(b, state);
	expect(ours.slots.map((slot) => slot.hero)).toEqual([8]);
	expect(theirs.slots.map((slot) => slot.hero)).toEqual([9]);
	expect([ours.side, theirs.side]).toEqual(["dire", "radiant"]);
});
