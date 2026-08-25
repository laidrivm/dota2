/**
 * The smoothing `blend.ts` applies after the blend: how far a winrate's
 * distance from neutral survives the sample size behind it.
 *
 * The blend itself is `blend.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import { adj, type Statistic } from "./blend.ts";

/**
 * The `k` each statistic is stated to smooth by. Naming them here is what
 * makes these two cases pin the table rather than a single shared constant:
 * `n_eff = k` halves a delta only for the statistic's own `k`.
 */
const CONSTANTS: [Statistic, number][] = [
	["position", 300],
	["side", 500],
	["phase", 500],
	["matchup", 400],
	["synergy", 400],
];

describe("smoothing towards neutral", () => {
	// spec: snapshot-build/sample-equal-to-the-constant
	test.each(CONSTANTS)(
		"a %s sample equal to its own k halves the raw delta [9] [12]",
		(statistic, k) => {
			expect(adj(statistic, { wrBlend: 54, nEff: k })).toBe(2);
		},
	);

	// spec: snapshot-build/a-sample-far-below-the-constant
	test.each(CONSTANTS)(
		"a %s sample a ninth of its own k leaves a tenth of it [2]",
		(statistic, k) => {
			expect(adj(statistic, { wrBlend: 60, nEff: k / 9 })).toBeCloseTo(1, 10);
		},
	);
});
