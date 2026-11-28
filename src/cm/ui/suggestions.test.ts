/** A suggestion's parts as the board shows them, against its score as shown. */
import { expect, test } from "bun:test";
import type { Suggestion } from "../engine/suggest.ts";
import { shownParts } from "./suggestions.tsx";

const entry = (score: number, parts: Partial<Suggestion["components"]>) =>
	({
		hero: 1,
		score,
		components: {
			meta: 0,
			comfort: 0,
			side: 0,
			phase: 0,
			synergy: 0,
			matchups: 0,
			lookahead: 0,
			...parts,
		},
	}) as Suggestion;

const total = (parts: [string, number][]) =>
	Math.round(parts.reduce((sum, [, value]) => sum + value, 0) * 10) / 10;

// spec: cm-model/components-add-up-to-the-score
test("three parts of 0.14 show as 0.1 each, with the rounding in the lookahead", () => {
	const shown = shownParts(
		entry(0.42, { meta: 0.14, side: 0.14, phase: 0.14 }),
	);
	expect(shown).toEqual([
		["meta", 0.1],
		["side", 0.1],
		["phase", 0.1],
		["lookahead", 0.1],
	]);
	expect(total(shown)).toBe(0.4);
});

test("parts too small to show leave their sum to the lookahead, not to nothing", () => {
	const shown = shownParts(
		entry(0.12, { meta: 0.04, side: 0.04, phase: 0.04 }),
	);
	expect(shown).toEqual([["lookahead", 0.1]]);
});

test("parts that already add up show no lookahead", () => {
	const shown = shownParts(entry(-1.5, { meta: -1, synergy: -0.5 }));
	expect(shown).toEqual([
		["meta", -1],
		["synergy", -0.5],
	]);
});
