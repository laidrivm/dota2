import { describe, expect, test } from "bun:test";
import { bundle, def, H, session, team } from "./model.fixture.ts";
import { computeModel } from "./model.ts";

/**
 * What the model reads off a draft before it scores anything: which phase the
 * draft is in, and which role each enemy pick is playing. Scoring is
 * `model-scoring.test.ts`'s and the win estimate `model-estimate.test.ts`'s.
 */

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
		const probs = def(out.enemyRoles[0]).probs;
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
		expect(def(two.enemyRoles[0]).probs["5"]).toBeLessThan(
			def(one.enemyRoles[0]).probs["5"],
		);
	});

	test("injectivity: openness stays within [0,1] and lowest on contested roles", () => {
		// Lich and Oracle are both pos5-dominant. Because an assignment gives a
		// role to at most one of them, no role can be occupied twice — which is
		// what keeps openness off negative values — and the backtracking that
		// frees a role again is what leaves the roles neither plays near 1.
		const open = computeModel(
			bundle,
			session({ enemyPicks: [H.lich, H.oracle] }),
		).enemyOpenRoles;
		for (const value of Object.values(open)) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
		expect(open["5"]).toBeLessThan(open["4"]);
		expect(open["4"]).toBeLessThan(open["1"]);
	});

	test("ε floor: a 0-share role still gets nonzero marginal", () => {
		// Anti-Mage is pos1-only; role 3 has zero share but must stay > 0.
		const out = computeModel(bundle, session({ enemyPicks: [H.antiMage] }));
		expect(def(out.enemyRoles[0]).probs["3"]).toBeGreaterThan(0);
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
