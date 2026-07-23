import { describe, expect, test } from "bun:test";
import rawSnapshot from "./fixtures/snapshot.json" with { type: "json" };
import { computeModel } from "./model.ts";
import {
	EMPTY_SESSION,
	type HeroId,
	type Role,
	type Session,
	type SnapshotBundle,
} from "./types.ts";

const bundle = rawSnapshot as unknown as SnapshotBundle;

// Fixture hero ids used across tests.
const H = {
	antiMage: 1,
	axe: 2,
	lifestealer: 54,
	invoker: 74,
	tidehunter: 29,
	pudge: 14,
	lich: 31,
	zeus: 22,
	clockwerk: 51,
	oracle: 111,
	clinkz: 56,
	razor: 15,
	undying: 85,
	lion: 26,
	spectre: 67,
	largo: 150, // insufficient-data hero
} as const;

function session(over: Partial<Session> = {}): Session {
	return { ...EMPTY_SESSION(), createdAt: "fixed", ...over };
}

function team(slots: Partial<Record<`${Role}`, HeroId>>): Session["teamPicks"] {
	return {
		"1": slots["1"] ?? null,
		"2": slots["2"] ?? null,
		"3": slots["3"] ?? null,
		"4": slots["4"] ?? null,
		"5": slots["5"] ?? null,
	};
}

describe("pick phase (§2)", () => {
	test.each([
		[{}, "p1"],
		[{ "1": H.antiMage }, "p1"],
		[{ "1": H.antiMage, "2": H.invoker }, "p2"],
		[{ "1": H.antiMage, "2": H.invoker, "3": H.axe }, "p2"],
		[{ "1": H.antiMage, "2": H.invoker, "3": H.axe, "4": H.pudge }, "last"],
		[
			{
				"1": H.antiMage,
				"2": H.invoker,
				"3": H.axe,
				"4": H.pudge,
				"5": H.lich,
			},
			"last",
		],
	] as const)("k picks → phase", (slots, expected) => {
		expect(
			computeModel(bundle, session({ teamPicks: team(slots) })).phase,
		).toBe(expected);
	});
});

describe("enemy role inference (§1)", () => {
	test("no enemies: no marginals, every role fully open", () => {
		const out = computeModel(bundle, session());
		expect(out.enemyRoles).toEqual([]);
		expect(out.enemyOpenRoles).toEqual({
			"1": 1,
			"2": 1,
			"3": 1,
			"4": 1,
			"5": 1,
		});
	});

	test("single enemy: probs sum to 1 and follow position share", () => {
		const out = computeModel(bundle, session({ enemyPicks: [H.undying] }));
		const probs = out.enemyRoles[0]!.probs;
		const sum = Object.values(probs).reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 9);
		// Undying: pos5 share .6 > pos4 .4 > others (ε floor).
		expect(probs["5"]).toBeGreaterThan(probs["4"]);
		expect(probs["4"]).toBeGreaterThan(probs["1"]);
	});

	test("§7.4: a second enemy contesting the same role pushes the first off it", () => {
		// Lich and Oracle are both pos5-dominant; injective assignment forces one
		// off role 5, so the first enemy's role-5 mass must drop.
		const one = computeModel(bundle, session({ enemyPicks: [H.lich] }));
		const two = computeModel(
			bundle,
			session({ enemyPicks: [H.lich, H.oracle] }),
		);
		expect(two.enemyRoles[0]!.probs["5"]).toBeLessThan(
			one.enemyRoles[0]!.probs["5"],
		);
	});

	test("ε floor: a 0-share role still gets nonzero marginal", () => {
		// Anti-Mage is pos1-only; role 3 has zero share but must stay > 0.
		const out = computeModel(bundle, session({ enemyPicks: [H.antiMage] }));
		expect(out.enemyRoles[0]!.probs["3"]).toBeGreaterThan(0);
	});

	test("five enemies: every enemy's probs sum to 1 and carry all five keys", () => {
		const out = computeModel(
			bundle,
			session({
				enemyPicks: [H.lifestealer, H.zeus, H.axe, H.clockwerk, H.oracle],
			}),
		);
		expect(out.enemyRoles).toHaveLength(5);
		for (const e of out.enemyRoles) {
			expect(Object.keys(e.probs).sort()).toEqual(["1", "2", "3", "4", "5"]);
			expect(Object.values(e.probs).reduce((a, b) => a + b, 0)).toBeCloseTo(
				1,
				9,
			);
		}
	});

	test("openness sums to 5 − |enemyPicks| when enemies are present", () => {
		const out = computeModel(
			bundle,
			session({ enemyPicks: [H.undying, H.axe] }),
		);
		const total = Object.values(out.enemyOpenRoles).reduce((a, b) => a + b, 0);
		expect(total).toBeCloseTo(3, 9);
	});
});

describe("suggestions (§3)", () => {
	test("empty draft: matchup and synergy components are exactly 0", () => {
		// §7.1 — with no allies and no enemies those two terms vanish; ordering
		// is meta+side+phase+counterRisk (counter-risk is nonzero pre-draft).
		const out = computeModel(bundle, session({ side: "radiant", myRole: 1 }));
		for (const block of out.suggestions) {
			for (const e of block.entries) {
				expect(e.components.matchups).toBe(0);
				expect(e.components.synergy).toBe(0);
			}
		}
	});

	test("my-role block is first and flagged", () => {
		const out = computeModel(bundle, session({ myRole: 3 }));
		expect(out.suggestions[0]!.role).toBe(3);
		expect(out.suggestions[0]!.isMyRole).toBe(true);
		expect(out.suggestions.filter((b) => b.isMyRole)).toHaveLength(1);
	});

	test("block truncates to suggestionsPerRole (5)", () => {
		const out = computeModel(bundle, session({ myRole: 1 }));
		for (const block of out.suggestions) {
			expect(block.entries.length).toBeLessThanOrEqual(5);
		}
		// The carry pool has >5 candidates, so role 1 fills.
		expect(out.suggestions.find((b) => b.role === 1)!.entries).toHaveLength(5);
	});

	test("components sum to score", () => {
		const out = computeModel(
			bundle,
			session({ side: "radiant", myRole: 2, enemyPicks: [H.undying, H.axe] }),
		);
		for (const block of out.suggestions) {
			for (const e of block.entries) {
				const c = e.components;
				expect(
					c.meta + c.side + c.phase + c.synergy + c.matchups + c.counterRisk,
				).toBeCloseTo(e.score, 9);
			}
		}
	});

	test("§7.2: banning a candidate's counter-threat raises its counter-risk and score", () => {
		// Axe hard-counters Clinkz (adv 3.0); Clinkz tops the role-1 block, so it
		// stays observable whether or not Axe is banned.
		const clinkz = (s: Session) =>
			computeModel(bundle, s)
				.suggestions.find((b) => b.role === 1)!
				.entries.find((e) => e.hero === H.clinkz)!;
		const base = clinkz(session({ myRole: 1, side: "radiant" }));
		const banned = clinkz(
			session({ myRole: 1, side: "radiant", bans: [H.axe] }),
		);
		// counterRisk is ≤ 0; banning the threat moves it toward 0 (increase).
		expect(banned.components.counterRisk).toBeGreaterThan(
			base.components.counterRisk,
		);
		expect(banned.score).toBeGreaterThanOrEqual(base.score);
	});

	test("a banned hero never appears in any suggestion block", () => {
		// Spectre tops the role-1 pool; banning it must drop it everywhere.
		const out = computeModel(
			bundle,
			session({ myRole: 1, side: "radiant", bans: [H.spectre] }),
		);
		for (const block of out.suggestions) {
			expect(block.entries.some((e) => e.hero === H.spectre)).toBe(false);
		}
	});

	test("all five team roles filled: no suggestion blocks", () => {
		const out = computeModel(
			bundle,
			session({
				myRole: 1,
				teamPicks: team({
					"1": H.antiMage,
					"2": H.invoker,
					"3": H.tidehunter,
					"4": H.pudge,
					"5": H.lich,
				}),
			}),
		);
		expect(out.suggestions).toEqual([]);
	});
});

describe("insufficient-data hero (§7.5)", () => {
	test("never appears as a suggestion candidate", () => {
		const out = computeModel(bundle, session({ myRole: 3 }));
		for (const block of out.suggestions) {
			expect(block.entries.some((e) => e.hero === H.largo)).toBe(false);
		}
	});

	test("uniform share over its picked positions when inferred as an enemy", () => {
		// Largo is insufficient with positions {1, 3}; share collapses to uniform,
		// so roles 1 and 3 are symmetric and dominate 2/4/5.
		const out = computeModel(bundle, session({ enemyPicks: [H.largo] }));
		const p = out.enemyRoles[0]!.probs;
		expect(p["1"]).toBeCloseTo(p["3"], 9);
		expect(p["1"]).toBeGreaterThan(p["2"]);
		expect(p["1"]).toBeGreaterThan(p["4"]);
	});
});

describe("win estimate (§4)", () => {
	const full = (side: Session["side"]): Session =>
		session({
			side,
			myRole: 1,
			teamPicks: team({
				"1": H.antiMage,
				"2": H.invoker,
				"3": H.tidehunter,
				"4": H.pudge,
				"5": H.lich,
			}),
			enemyPicks: [H.lifestealer, H.zeus, H.axe, H.clockwerk, H.oracle],
		});

	test("only present at a full 5v5 draft", () => {
		expect(computeModel(bundle, full("radiant")).winEstimate).not.toBeNull();
		// 5 team + 4 enemy
		const almost = full("radiant");
		almost.enemyPicks = almost.enemyPicks.slice(0, 4);
		expect(computeModel(bundle, almost).winEstimate).toBeNull();
		// 4 team + 5 enemy
		const fourTeam = full("radiant");
		fourTeam.teamPicks = { ...fourTeam.teamPicks, "5": null };
		expect(computeModel(bundle, fourTeam).winEstimate).toBeNull();
	});

	test("winProbability is a logistic of advantage", () => {
		const out = computeModel(bundle, full("radiant")).winEstimate!;
		expect(out.winProbability).toBeCloseTo(
			1 / (1 + Math.exp(-0.1 * out.advantage)),
			9,
		);
		expect(out.winProbability).toBeGreaterThan(0);
		expect(out.winProbability).toBeLessThan(1);
	});

	test("§7.3 antisymmetry: mirror draft (teams swapped, side off) → 1 − winProb", () => {
		// Side disabled so the only residual is role-inference impurity (enemy
		// roles are inferred, my roles are known), not the side-delta term.
		const original = full(null);
		const mirror = session({
			side: null,
			myRole: 1,
			teamPicks: team({
				"1": H.lifestealer,
				"2": H.zeus,
				"3": H.axe,
				"4": H.clockwerk,
				"5": H.oracle,
			}),
			enemyPicks: [H.antiMage, H.invoker, H.tidehunter, H.pudge, H.lich],
		});
		const a = computeModel(bundle, original).winEstimate!;
		const b = computeModel(bundle, mirror).winEstimate!;
		// Not 1e-6: the model treats my roles as known and enemy roles as
		// inferred, so antisymmetry holds only up to that asymmetry.
		expect(b.winProbability).toBeCloseTo(1 - a.winProbability, 1);
	});
});

describe("determinism (§7.6)", () => {
	test("add then remove a pick returns byte-identical output", () => {
		const base = session({
			side: "radiant",
			myRole: 2,
			teamPicks: team({ "1": H.spectre }),
			enemyPicks: [H.undying],
			bans: [H.razor],
		});
		const before = JSON.stringify(computeModel(bundle, base));

		const edited: Session = {
			...base,
			teamPicks: { ...base.teamPicks, "3": H.axe },
		};
		computeModel(bundle, edited); // add
		const restored: Session = {
			...base,
			teamPicks: { ...base.teamPicks, "3": null },
		};
		const after = JSON.stringify(computeModel(bundle, restored));

		expect(after).toBe(before);
	});

	test("inputs are not mutated", () => {
		const s = session({ enemyPicks: [H.undying], myRole: 1 });
		const snapBefore = JSON.stringify(bundle);
		const sessBefore = JSON.stringify(s);
		computeModel(bundle, s);
		expect(JSON.stringify(bundle)).toBe(snapBefore);
		expect(JSON.stringify(s)).toBe(sessBefore);
	});
});

describe("robustness (interface / exceptions)", () => {
	test("winEstimate key is present and null on an incomplete draft", () => {
		const out = computeModel(bundle, session({ myRole: 1 }));
		expect(out).toHaveProperty("winEstimate", null);
	});

	test("myRole null: blocks returned, none flagged isMyRole", () => {
		const out = computeModel(bundle, session());
		expect(out.suggestions.length).toBe(5);
		expect(out.suggestions.some((b) => b.isMyRole)).toBe(false);
	});

	test("no NaN leaks with enemies present (Lbar / matchup guards)", () => {
		const out = computeModel(
			bundle,
			session({ myRole: 2, side: "dire", enemyPicks: [H.spectre, H.axe] }),
		);
		for (const block of out.suggestions) {
			for (const e of block.entries) {
				expect(Number.isFinite(e.score)).toBe(true);
				for (const v of Object.values(e.components)) {
					expect(Number.isFinite(v)).toBe(true);
				}
			}
		}
	});

	test("unknown hero id in session does not crash or poison scores", () => {
		const out = computeModel(
			bundle,
			session({ myRole: 1, enemyPicks: [99999 as HeroId] }),
		);
		// Unknown enemy is dropped from inference; output stays finite.
		expect(out.enemyRoles).toEqual([]);
		expect(
			out.suggestions.every((b) =>
				b.entries.every((e) => Number.isFinite(e.score)),
			),
		).toBe(true);
	});
});
