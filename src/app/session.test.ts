import { describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Session } from "../types.ts";
import { type Action, applyAction, usedAs } from "./session.ts";

/** Every test that is not about the ban limit works far below it. */
const NO_LIMIT = 100;

const applied = (session: Session, ...actions: Action[]) =>
	actions.reduce((s, action) => applyAction(s, action, NO_LIMIT), session);

describe("side and role", () => {
	test("selects a side", () => {
		const next = applied(EMPTY_SESSION(), { kind: "side", side: "radiant" });
		expect(next.side).toBe("radiant");
	});

	test("re-selecting the current side keeps it selected", () => {
		const twice = applied(
			EMPTY_SESSION(),
			{ kind: "side", side: "radiant" },
			{ kind: "side", side: "radiant" },
		);
		expect(twice.side).toBe("radiant");
	});

	test("leaves the rest of the draft alone", () => {
		const before: Session = {
			...EMPTY_SESSION(),
			bans: [14, 22],
			enemyPicks: [8],
			teamPicks: { "1": null, "2": 5, "3": null, "4": null, "5": null },
		};

		const after = applied(before, { kind: "side", side: "dire" });

		expect(after.bans).toEqual(before.bans);
		expect(after.enemyPicks).toEqual(before.enemyPicks);
		expect(after.teamPicks).toEqual(before.teamPicks);
		expect(after.createdAt).toBe(before.createdAt);
	});
});

describe("bans", () => {
	test("a ban is appended last", () => {
		const after = applied(
			EMPTY_SESSION(),
			{ kind: "banAdd", hero: 14 },
			{ kind: "banAdd", hero: 22 },
		);
		expect(after.bans).toEqual([14, 22]);
	});

	test("removing the middle ban keeps the order of the others", () => {
		const after = applied(
			{ ...EMPTY_SESSION(), bans: [14, 22, 8] },
			{ kind: "banRemove", index: 1 },
		);
		expect(after.bans).toEqual([14, 8]);
	});

	test.each([-1, 3])(
		"removing at out-of-range index %p changes nothing",
		(i) => {
			const before = { ...EMPTY_SESSION(), bans: [14, 22, 8] };
			expect(applied(before, { kind: "banRemove", index: i }).bans).toEqual(
				before.bans,
			);
		},
	);

	test("removing from an empty ban list changes nothing", () => {
		const before = EMPTY_SESSION();
		expect(applied(before, { kind: "banRemove", index: 0 })).toEqual(before);
	});

	test("a ban one below the limit is accepted", () => {
		const before = { ...EMPTY_SESSION(), bans: [1, 2] };
		const after = applyAction(before, { kind: "banAdd", hero: 3 }, 3);
		expect(after.bans).toEqual([1, 2, 3]);
	});

	test("a ban at the limit is refused", () => {
		const before = { ...EMPTY_SESSION(), bans: [1, 2, 3] };
		const after = applyAction(before, { kind: "banAdd", hero: 4 }, 3);
		expect(after).toEqual(before);
	});

	test("no snapshot means no limit to ban against, so nothing is banned", () => {
		const before = EMPTY_SESSION();
		expect(applyAction(before, { kind: "banAdd", hero: 1 }, 0)).toEqual(before);
	});
});

describe("team picks", () => {
	test("setting one role leaves the other four empty", () => {
		const after = applied(EMPTY_SESSION(), {
			kind: "teamSet",
			role: 2,
			hero: 14,
		});
		expect(after.teamPicks).toEqual({
			"1": null,
			"2": 14,
			"3": null,
			"4": null,
			"5": null,
		});
	});

	test("setting an occupied role replaces the hero that was there", () => {
		const after = applied(
			EMPTY_SESSION(),
			{ kind: "teamSet", role: 2, hero: 14 },
			{ kind: "teamSet", role: 2, hero: 22 },
		);
		expect(after.teamPicks["2"]).toBe(22);
		expect(Object.values(after.teamPicks)).not.toContain(14);
	});

	test("clearing a role leaves the other four unchanged", () => {
		const before = {
			...EMPTY_SESSION(),
			teamPicks: { "1": 3, "2": 5, "3": null, "4": 8, "5": null },
		} satisfies Session;

		const after = applied(before, { kind: "teamClear", role: 4 });

		expect(after.teamPicks).toEqual({
			"1": 3,
			"2": 5,
			"3": null,
			"4": null,
			"5": null,
		});
	});

	test("clearing an empty role changes nothing", () => {
		const before = EMPTY_SESSION();
		expect(applied(before, { kind: "teamClear", role: 3 })).toEqual(before);
	});
});

describe("enemy picks", () => {
	test("an enemy pick is appended last", () => {
		const after = applied(
			{ ...EMPTY_SESSION(), enemyPicks: [1, 2, 3] },
			{ kind: "enemyAdd", hero: 4 },
		);
		expect(after.enemyPicks).toEqual([1, 2, 3, 4]);
	});

	test("removing the first enemy pick keeps the order of the rest", () => {
		const after = applied(
			{ ...EMPTY_SESSION(), enemyPicks: [1, 2, 3] },
			{ kind: "enemyRemove", index: 0 },
		);
		expect(after.enemyPicks).toEqual([2, 3]);
	});

	test("a sixth enemy pick is refused", () => {
		const before = { ...EMPTY_SESSION(), enemyPicks: [1, 2, 3, 4, 5] };
		expect(applied(before, { kind: "enemyAdd", hero: 6 })).toEqual(before);
	});

	test.each([-1, 3])(
		"removing at out-of-range index %p changes nothing",
		(index) => {
			const before = { ...EMPTY_SESSION(), enemyPicks: [1, 2, 3] };
			expect(
				applied(before, { kind: "enemyRemove", index }).enemyPicks,
			).toEqual(before.enemyPicks);
		},
	);
});

describe("single occupancy", () => {
	const picked: Session = {
		...EMPTY_SESSION(),
		bans: [1],
		teamPicks: { "1": 2, "2": null, "3": null, "4": null, "5": null },
		enemyPicks: [3],
	};

	// The picker labels a taken tile with what `usedAs` answers, so the label
	// and the reducer's refusal above can never disagree about the same hero.
	test.each([
		["ban", 1],
		["team", 2],
		["enemy", 3],
	])("a hero in the draft is used as %p", (where, hero) => {
		expect(usedAs(picked, hero)).toBe(where as "ban" | "team" | "enemy");
	});

	test("a hero nowhere in the draft is used nowhere", () => {
		expect(usedAs(picked, 9)).toBeNull();
	});

	test("an empty session uses no hero at all", () => {
		expect(usedAs(EMPTY_SESSION(), 1)).toBeNull();
	});

	test.each([
		["a banned hero", 1],
		["a hero on my team", 2],
		["a hero on the enemy team", 3],
	])("%s cannot be banned again", (_label, hero) => {
		expect(applied(picked, { kind: "banAdd", hero })).toEqual(picked);
	});

	// Single occupancy makes this a no-op rather than a rewrite. It is what the
	// picker of 2c will hit when a slot is "replaced" with the hero already in
	// it, and it must stay harmless.
	test("setting a slot to the hero it already holds changes nothing", () => {
		expect(applied(picked, { kind: "teamSet", role: 1, hero: 2 })).toEqual(
			picked,
		);
	});

	test("a banned hero cannot be set as a team pick", () => {
		expect(applied(picked, { kind: "teamSet", role: 3, hero: 1 })).toEqual(
			picked,
		);
	});

	test("an enemy hero cannot be added twice", () => {
		expect(applied(picked, { kind: "enemyAdd", hero: 3 })).toEqual(picked);
	});

	test("replacing a slot frees the hero it held", () => {
		const after = applied(
			picked,
			{ kind: "teamSet", role: 1, hero: 9 },
			{ kind: "banAdd", hero: 2 },
		);
		expect(after.teamPicks["1"]).toBe(9);
		expect(after.bans).toEqual([1, 2]);
	});
});

describe("the reducer contract", () => {
	test.each([
		["side", { kind: "side", side: "dire" }],
		["role", { kind: "role", role: 4 }],
		["banAdd", { kind: "banAdd", hero: 9 }],
		["banRemove", { kind: "banRemove", index: 0 }],
		["teamSet", { kind: "teamSet", role: 1, hero: 9 }],
		["teamClear", { kind: "teamClear", role: 1 }],
		["enemyAdd", { kind: "enemyAdd", hero: 9 }],
		["enemyRemove", { kind: "enemyRemove", index: 0 }],
	] satisfies [string, Action][])(
		"%s does not mutate its input",
		(_l, action) => {
			const before: Session = {
				...EMPTY_SESSION(),
				bans: [1],
				teamPicks: { "1": 2, "2": null, "3": null, "4": null, "5": null },
				enemyPicks: [3],
			};
			const snapshot = structuredClone(before);

			applyAction(before, action, NO_LIMIT);

			expect(before).toEqual(snapshot);
		},
	);
});
