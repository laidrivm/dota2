/**
 * The immediate ranking for the step in progress (cm-model, *The step in
 * progress gets ranked suggestions*): who is eligible, how a score is built,
 * and that its components account for all of it.
 */
import { expect, test } from "bun:test";
import type { HeroEntry } from "../../types.ts";
import type { DraftState, Rostered } from "./draft.ts";
import { bundle, everywhere, hero } from "./engine.fixture.ts";
import { suggest } from "./suggest.ts";

const unplaced: Rostered = { position: null, rank: null, signatures: [] };
const state = (
	steps: number[],
	over: Partial<DraftState> = {},
): DraftState => ({
	side: "radiant",
	pickOrder: "first",
	steps,
	ours: [0, 1, 2, 3, 4].map(() => unplaced),
	theirs: [0, 1, 2, 3, 4].map(() => unplaced),
	...over,
});

/** Heroes 1–12, each worth its id / 10 at every position. */
const graded = (): HeroEntry[] =>
	Array.from({ length: 12 }, (_, i) =>
		hero(i + 1, {
			"1": (i + 1) / 10,
			"2": (i + 1) / 10,
			"3": (i + 1) / 10,
			"4": (i + 1) / 10,
			"5": (i + 1) / 10,
		}),
	);

const sum = (parts: Record<string, number>) =>
	Object.values(parts).reduce((total, part) => total + part, 0);

const SEVEN_BANS = [1, 2, 3, 4, 5, 6, 7];

// spec: cm-model/components-add-up-to-the-score
test("a pick's components add up to its score", () => {
	const b = bundle(graded(), {
		synergies: { "12": { "8": 0.7 }, "8": { "12": 0.7 } },
	});
	// Step 8 is ours; step 9's enemy hero 8 is not yet in. Picks so far: none.
	const result = suggest(b, state(SEVEN_BANS));
	expect(result?.action).toBe("pick");
	expect(result?.team).toBe("ours");
	for (const entry of result?.entries ?? [])
		expect(Math.abs(sum(entry.components) - entry.score)).toBeLessThan(0.05);
	// The best free hero, 12, leads at its meta of 1.2.
	expect(result?.entries[0]).toMatchObject({ hero: 12 });
	expect(result?.entries[0]?.score).toBeCloseTo(1.2, 10);
});

test("a ban's components are the enemy's would-be pick, and they sum to its score", () => {
	const result = suggest(bundle(graded()), state([]));
	expect(result).toMatchObject({ action: "ban", team: "ours" });
	const [first] = result?.entries ?? [];
	// Banning 12 denies the enemy its 1.2: the meta part is the enemy's.
	expect(first?.hero).toBe(12);
	expect(first?.components.meta).toBeCloseTo(1.2, 10);
	expect(first?.score).toBeCloseTo(1.2, 10);
	expect(
		Math.abs(sum(first?.components ?? {}) - (first?.score ?? 0)),
	).toBeLessThan(0.05);
});

test("on an enemy pick, the heroes the enemy is expected to take come first", () => {
	// Step 9 is the enemy's pick once ours, hero 8, is in.
	const result = suggest(bundle(graded()), state([...SEVEN_BANS, 8]));
	expect(result).toMatchObject({ action: "pick", team: "theirs" });
	expect(result?.entries.map((entry) => entry.hero)).toEqual([12, 11, 10, 9]);
	// Their gain is the captain's loss.
	expect(result?.entries[0]?.score).toBeCloseTo(-1.2, 10);
});

test("fewer than five eligible heroes return that many, none taken or insufficient", () => {
	const heroes = [
		hero(1, everywhere),
		hero(2, everywhere),
		hero(3, everywhere, { sufficient: false }),
		hero(4, everywhere),
	];
	const result = suggest(bundle(heroes), state([1]));
	expect(result?.entries.map((entry) => entry.hero).sort()).toEqual([2, 4]);
});

test("a hero able to play only a position the team has filled is not offered", () => {
	// Hero 9 is ours at position 1, the only position heroes 8 and 9 play.
	// Heroes 20–31 fill the bans and the enemy's picks; step 14 is ours.
	const fillers = Array.from({ length: 12 }, (_, i) =>
		hero(20 + i, { "5": 0 }),
	);
	const b = bundle([
		hero(8, { "1": 1 }),
		hero(9, { "1": 2 }),
		hero(10, { "2": 0.5 }),
		...fillers,
	]);
	const steps = [20, 21, 22, 23, 24, 25, 26, 9, 27, 28, 29, 30, 31];
	const result = suggest(b, state(steps));
	expect(result).toMatchObject({ action: "pick", team: "ours" });
	const offered = result?.entries.map((entry) => entry.hero);
	expect(offered).not.toContain(8);
	expect(offered).toContain(10);
});

test("nothing is suggested once the draft is complete", () => {
	const steps = Array.from({ length: 24 }, (_, i) => 101 + i);
	expect(suggest(bundle(graded()), state(steps))).toBeNull();
});
