import { describe, expect, test } from "bun:test";
import { bundle, def, H, session, team } from "./model.fixture.ts";
import { computeModel } from "./model.ts";
import type { Session, SnapshotBundle } from "./types.ts";

/**
 * What the model recommends: the per-role suggestion blocks (§3), and what a
 * hero the snapshot has too little data on does to them (§7.5).
 */

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
		expect(def(out.suggestions[0]).role).toBe(3);
		expect(def(out.suggestions[0]).isMyRole).toBe(true);
		expect(out.suggestions.filter((b) => b.isMyRole)).toHaveLength(1);
	});

	test("block truncates to suggestionsPerRole (5)", () => {
		const out = computeModel(bundle, session({ myRole: 1 }));
		for (const block of out.suggestions) {
			expect(block.entries.length).toBeLessThanOrEqual(5);
		}
		// The carry pool has >5 candidates, so role 1 fills.
		expect(def(out.suggestions.find((b) => b.role === 1)).entries).toHaveLength(
			5,
		);
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
			def(
				def(
					computeModel(bundle, s).suggestions.find((b) => b.role === 1),
				).entries.find((e) => e.hero === H.clinkz),
			);
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
		const p = def(out.enemyRoles[0]).probs;
		expect(p["1"]).toBeCloseTo(p["3"], 9);
		expect(p["1"]).toBeGreaterThan(p["2"]);
		expect(p["1"]).toBeGreaterThan(p["4"]);
	});

	// Spectre is a top-5 role-1 candidate, which is what makes it the hero
	// worth flagging: its pos-1 share going to 0 must take it out of the block,
	// independent of `hero.sufficient`.
	const spectreInRole1 = (b: SnapshotBundle) =>
		def(
			computeModel(b, session({ myRole: 1, side: "radiant" })).suggestions.find(
				(x) => x.role === 1,
			),
		).entries.some((e) => e.hero === H.spectre);

	test("a hero with a sufficient position is a candidate for that role", () => {
		expect(spectreInRole1(bundle)).toBe(true);
	});

	test("a sufficient hero with an insufficient position is dropped from that role", () => {
		const patched = structuredClone(bundle);
		const spectre = def(patched.heroes.find((h) => h.id === H.spectre));
		def(spectre.positions["1"]).sufficient = false;

		expect(spectreInRole1(patched)).toBe(false);
	});
});
