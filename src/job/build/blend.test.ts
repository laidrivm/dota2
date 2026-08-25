/**
 * The blend and the smoothing: how fast a patch stops counting once the next
 * one lands, what a statistic's winrate is while both still do, and how much
 * of its distance from neutral survives the sample behind it.
 */
import { describe, expect, test } from "bun:test";
import {
	adj,
	type PatchKind,
	prior,
	type Statistic,
	wrBlend,
} from "./blend.ts";

/** The parameter table the requirement fixes: kind, `k0`, half-life in days. */
const KINDS: [PatchKind, number, number][] = [
	["major", 1000, 1],
	["letter", 3000, 2],
];

describe("the prior's decay", () => {
	// spec: snapshot-build/a-major-patch-on-its-first-day
	test.each(KINDS)(
		"a %s patch's prior is its whole k0 on day 0 [5]",
		(kind, k0) => {
			expect(prior(kind, 0)).toBe(k0);
		},
	);

	test.each(KINDS)(
		"a %s patch's prior is half its k0 one half-life in [6]",
		(kind, k0, h) => {
			expect(prior(kind, h)).toBe(k0 / 2);
		},
	);

	test("a major patch's prior still counts on day 3 [7]", () => {
		expect(prior("major", 3)).toBeGreaterThan(0);
	});

	test("a letter patch's prior still counts on day 6 [8]", () => {
		expect(prior("letter", 6)).toBeGreaterThan(0);
	});
});

describe("the blend", () => {
	test("a statistic inside the window weighs both patches [63]", () => {
		// A prior dropped altogether would answer 60, and one applied at its
		// undecayed `k0` would answer 52.
		expect(wrBlend(1500, 60, prior("major", 1), 40)).toEqual({
			wrBlend: 55,
			nEff: 2000,
		});
	});

	// spec: snapshot-build/a-major-patch-past-its-window
	test("a major patch's day 4 leaves the previous patch nothing [7]", () => {
		const weight = prior("major", 4);

		expect(weight).toBe(0);
		expect(wrBlend(120, 57, weight, 48)).toEqual({ wrBlend: 57, nEff: 120 });
	});

	// spec: snapshot-build/a-letter-patch-past-its-window
	test("a letter patch's day 7 leaves the previous patch nothing [8]", () => {
		const weight = prior("letter", 7);

		expect(weight).toBe(0);
		expect(wrBlend(120, 57, weight, 48)).toEqual({ wrBlend: 57, nEff: 120 });
	});

	// spec: snapshot-build/no-previous-patch-to-blend
	test("no previous patch leaves the current one's own winrate [1]", () => {
		expect(wrBlend(800, 53, prior("major", 0), undefined)).toEqual({
			wrBlend: 53,
			nEff: 800,
		});
	});

	test("a hero the previous patch never held is not pulled to 50 [14]", () => {
		// Reading the missing `wr_old` as a neutral 50 would answer 50.5 here,
		// the prior outweighing the hero's own hundred matches ten to one.
		expect(wrBlend(100, 60, prior("major", 0), undefined)).toEqual({
			wrBlend: 60,
			nEff: 100,
		});
	});

	test("no matches against a live prior is the previous winrate [64]", () => {
		// The other side of the absence rule: a hero nobody has picked yet keeps
		// the previous patch's winrate rather than losing its row.
		expect(wrBlend(0, 50, prior("major", 0), 48)).toEqual({
			wrBlend: 48,
			nEff: 1000,
		});
	});

	// spec: snapshot-build/neither-matches-nor-prior
	test("neither matches nor a surviving prior yields no row [13] [46]", () => {
		// Undefined rather than `NaN`: the quotient is never attempted.
		expect(wrBlend(0, 50, prior("major", 4), 48)).toBeUndefined();
	});
});

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
