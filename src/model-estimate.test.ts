import { describe, expect, test } from "bun:test";
import { bundle, def, H, session, team } from "./model.fixture.ts";
import { computeModel } from "./model.ts";
import type { HeroId, Session } from "./types.ts";

/**
 * What the model concludes: the win estimate (§4), that the same input gives
 * the same output (§7.6), and what it does with input it should not have been
 * given at all.
 */

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

	test("present at a full 5v5 draft", () => {
		expect(computeModel(bundle, full("radiant")).winEstimate).not.toBeNull();
	});

	test("absent with five of mine and four of theirs", () => {
		const almost = full("radiant");
		almost.enemyPicks = almost.enemyPicks.slice(0, 4);

		expect(computeModel(bundle, almost).winEstimate).toBeNull();
	});

	test("absent with four of mine and five of theirs", () => {
		const fourTeam = full("radiant");
		fourTeam.teamPicks = { ...fourTeam.teamPicks, "5": null };

		expect(computeModel(bundle, fourTeam).winEstimate).toBeNull();
	});

	test("winProbability is a logistic of advantage", () => {
		const out = def(computeModel(bundle, full("radiant")).winEstimate);
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
		const a = def(computeModel(bundle, original).winEstimate);
		const b = def(computeModel(bundle, mirror).winEstimate);
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
