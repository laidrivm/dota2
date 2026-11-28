/**
 * A team's value in percentage points (cm-model, *A team is valued in
 * percentage points* and *A player's signatures and rank weigh their slot*),
 * over a small hand-built snapshot so every expected number is arithmetic.
 */
import { describe, expect, test } from "bun:test";
import type {
	HeroEntry,
	PickPhase,
	Role,
	SnapshotBundle,
} from "../../types.ts";
import {
	cmPhase,
	evaluate,
	type Player,
	rankWeight,
	SIGNATURE_BONUS,
	type Team,
	teamValue,
} from "./value.ts";

const PHASES: Record<PickPhase, number> = { p1: 0.1, p2: 0.2, last: 0.4 };

const hero = (
	id: number,
	positions: Partial<Record<`${Role}`, number>>,
	over: Partial<HeroEntry> = {},
): HeroEntry => ({
	id,
	name: `Hero ${id}`,
	short: `hero${id}`,
	icon: "",
	aliases: [],
	sufficient: true,
	contest: 0.1,
	side: { radiant: 0, dire: 0 },
	phase: { p1: 0, p2: 0, last: 0 },
	positions: Object.fromEntries(
		Object.entries(positions).map(([role, meta]) => [
			role,
			{ share: 1 / Object.keys(positions).length, meta, sufficient: true },
		]),
	),
	...over,
});

/** Heroes 1–6 play every position at meta 0 unless a case says otherwise. */
const everywhere = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
const bundle = (heroes: HeroEntry[], extra: Partial<SnapshotBundle> = {}) =>
	({
		heroes,
		matchups: {},
		synergies: {},
		...extra,
	}) as unknown as SnapshotBundle;

const nobody: Player = { rank: null, signatures: [] };
const team = (over: Partial<Team> = {}): Team => ({
	side: "radiant",
	players: [nobody, nobody, nobody, nobody, nobody],
	slots: [],
	...over,
});

// spec: cm-model/valuing-a-team
test("an empty draft is worth exactly 0 to both teams", () => {
	const b = bundle([hero(1, everywhere)]);
	expect(teamValue(b, team(), []).total).toBe(0);
	expect(evaluate(b, team(), team({ side: "dire" }))).toBe(0);
});

// spec: cm-model/valuing-a-team
test("a team's picks 1, 2, 4 and 5 read the p1, p2, p2 and last deltas", () => {
	expect([0, 1, 2, 3, 4].map(cmPhase)).toEqual([
		"p1",
		"p2",
		"p2",
		"p2",
		"last",
	]);
	const heroes = [1, 2, 3, 4, 5].map((id) =>
		hero(id, everywhere, { phase: PHASES }),
	);
	const slots = heroes.map((h, i) => ({
		hero: h.id,
		position: (i + 1) as Role,
		player: null,
	}));
	const { parts } = teamValue(bundle(heroes), team({ slots }), []);
	expect(parts.phase).toBeCloseTo(0.1 + 0.2 + 0.2 + 0.2 + 0.4, 10);
	// No player holds these slots, so no signature lifts them.
	expect(parts.comfort).toBe(0);
});

describe("rank weight", () => {
	const ranked = (...ranks: (number | null)[]) =>
		ranks.map((rank) => ({ rank, signatures: [] }));

	// spec: cm-model/a-signature-hero-outranks-an-equal-one
	test("rank 6 in a team of mean 5 weighs 1.1, and a signature adds 3.3", () => {
		const players = ranked(6, 4, 5, 5, 5);
		expect(rankWeight(players[0] ?? nobody, players)).toBeCloseTo(1.1, 10);
		const signer = { rank: 6, signatures: [1] };
		const b = bundle([hero(1, everywhere), hero(2, everywhere)]);
		const value = (id: number) =>
			teamValue(
				b,
				team({
					players: [signer, ...players.slice(1)],
					slots: [{ hero: id, position: 5, player: signer }],
				}),
				[],
			).total;
		expect(value(1) - value(2)).toBeCloseTo(SIGNATURE_BONUS * 1.1, 10);
		expect(value(1) - value(2)).toBeCloseTo(3.3, 10);
	});

	// spec: cm-model/a-signature-hero-outranks-an-equal-one
	test("the weight is clamped to 1.25 above and 0.75 below", () => {
		const high = ranked(8, 3, 1, 1, 2);
		expect(rankWeight(high[0] ?? nobody, high)).toBe(1.25);
		const low = ranked(1, 8, 8, 8, 5);
		expect(rankWeight(low[0] ?? nobody, low)).toBe(0.75);
	});

	test("an unknown rank weighs 1, and the mean is over known ranks only", () => {
		const players = ranked(null, 6, 4, null, null);
		expect(rankWeight(players[0] ?? nobody, players)).toBe(1);
		expect(rankWeight(players[1] ?? nobody, players)).toBeCloseTo(1.1, 10);
		expect(rankWeight(null, players)).toBe(1);
	});
});

test("meta is weighted by rank, and off-role costs 10", () => {
	const b = bundle([hero(1, { "1": 2.0 })]);
	const player = { rank: 8, signatures: [] };
	const players = [player, { rank: 6, signatures: [] }, nobody, nobody, nobody];
	const at = (position: Role) =>
		teamValue(b, team({ players, slots: [{ hero: 1, position, player }] }), [])
			.parts.meta;
	expect(at(1)).toBeCloseTo(2.0 * 1.1, 10);
	expect(at(3)).toBeCloseTo(-10 * 1.1, 10);
});

test("a synergy pair is counted once, and the side delta per hero", () => {
	const heroes = [1, 2, 3].map((id) =>
		hero(id, everywhere, { side: { radiant: 0.5, dire: -0.5 } }),
	);
	const b = bundle(heroes, {
		synergies: { "1": { "2": 1.5, "3": 0 }, "2": { "1": 1.5 } },
	});
	const slots = [1, 2, 3].map((id, i) => ({
		hero: id,
		position: (i + 1) as Role,
		player: null,
	}));
	const { parts } = teamValue(b, team({ slots }), []);
	expect(parts.synergy).toBe(1.5);
	// Two picks hold one pair: neither the pair twice nor a hero with itself.
	expect(
		teamValue(b, team({ slots: slots.slice(0, 2) }), []).parts.synergy,
	).toBe(1.5);
	expect(parts.side).toBeCloseTo(1.5, 10);
});

test("matchups read the enemy's assigned position, and the evaluation is the difference", () => {
	const b = bundle([hero(1, everywhere), hero(2, everywhere)], {
		matchups: { "1": { "2": 2 }, "2": { "1": -2 } },
	});
	const ours = team({ slots: [{ hero: 1, position: 2, player: null }] });
	const theirs = team({
		side: "dire",
		slots: [{ hero: 2, position: 2, player: null }],
	});
	// Mid against mid weighs 1.75 of a mean 1.75: the advantage as it stands.
	expect(teamValue(b, ours, theirs.slots).parts.matchups).toBeCloseTo(2, 10);
	expect(evaluate(b, ours, theirs)).toBeCloseTo(4, 10);
});

test("a share of exactly 0.05 is playable, and just under it is off-role", () => {
	const b = bundle([
		hero(
			1,
			{ "1": 1 },
			{ positions: { "1": { share: 0.05, meta: 1, sufficient: true } } },
		),
		hero(
			2,
			{ "1": 1 },
			{ positions: { "1": { share: 0.049, meta: 1, sufficient: true } } },
		),
	]);
	const metaOf = (id: number) =>
		teamValue(b, team({ slots: [{ hero: id, position: 1, player: null }] }), [])
			.parts.meta;
	expect(metaOf(1)).toBe(1);
	expect(metaOf(2)).toBe(-10);
});

test("a hero the snapshot no longer carries adds nothing, on either side", () => {
	const b = bundle([hero(1, everywhere)], {
		matchups: { "1": { "9": 3 } },
	});
	const lost = [{ hero: 9, position: 1 as Role, player: null }];
	expect(teamValue(b, team({ slots: lost }), []).total).toBe(0);
	const ours = team({ slots: [{ hero: 1, position: 1, player: null }] });
	expect(teamValue(b, ours, lost).parts.matchups).toBe(0);
});
