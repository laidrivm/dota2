/**
 * The search's budget on the full shipped snapshot (cm-model, *The search
 * answers within its budget*). Outside `src/cm/engine/` on purpose: Stryker
 * runs the engine's tests once per mutant, and a case that spends the whole
 * budget each time would make that run hours long without killing anything.
 */
import { expect, test } from "bun:test";
import { bundle } from "../model.fixture.ts";
import type { DraftState, Rostered } from "./engine/draft.ts";
import { search } from "./engine/search.ts";

const unplaced: Rostered = { position: null, rank: null, signatures: [] };
const five = () => [0, 1, 2, 3, 4].map(() => unplaced);

// spec: cm-model/the-search-answers-within-its-budget
test.each([
	["the first ban", []],
	["the first pick", bundle.heroes.slice(0, 7).map((h) => h.id)],
])(
	"%s on the full snapshot reaches depth 2 or more inside 1700 ms",
	(_, steps) => {
		const state: DraftState = {
			side: "radiant",
			pickOrder: "first",
			steps,
			ours: five(),
			theirs: five(),
		};
		const start = performance.now();
		const result = search(bundle, state);
		const elapsed = performance.now() - start;
		expect(result?.depth).toBeGreaterThanOrEqual(2);
		expect(elapsed).toBeLessThan(1700);
	},
	// One search measured at 1.5 s by its own budget; three times that.
	5_000,
);
