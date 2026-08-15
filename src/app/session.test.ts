import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Session } from "../types.ts";
import {
	type Action,
	applyAction,
	closesUndoWindow,
	confirmsReset,
	resetDraft,
	usedAs,
} from "./session.ts";
import {
	BACKUP_KEY,
	clearBackup,
	persist,
	readBackup,
	restore,
	SESSION_KEY,
	writeBackup,
} from "./session-storage.ts";

/** Every test that is not about the ban limit works far below it. */
const NO_LIMIT = 100;

const applied = (session: Session, ...actions: Action[]) =>
	actions.reduce((s, action) => applyAction(s, action, NO_LIMIT), session);

let store: Map<string, string>;

beforeEach(() => {
	store = new Map<string, string>();
	(globalThis as { localStorage?: unknown }).localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, v);
		},
		removeItem: (k: string) => {
			store.delete(k);
		},
	};
});

afterEach(() => {
	(globalThis as { localStorage?: unknown }).localStorage = undefined;
});

describe("restore", () => {
	test("no stored value starts an empty session", () => {
		const session = restore();
		expect(session.v).toBe(1);
		expect(session.side).toBeNull();
		expect(session.myRole).toBeNull();
		expect(session.bans).toEqual([]);
		expect(session.enemyPicks).toEqual([]);
	});

	test("a stored session round-trips deeply equal", () => {
		const stored: Session = {
			...EMPTY_SESSION(),
			side: "dire",
			myRole: 2,
			bans: [14, 22],
			enemyPicks: [8],
		};
		persist(stored);

		expect(restore()).toEqual(stored);
	});

	test.each([
		["unparseable JSON", "{not json"],
		["null", "null"],
		["an array", "[]"],
		["a number", "7"],
		["a future schema version", '{"v":2,"side":"dire"}'],
		["a v1 fragment with no teamPicks", '{"v":1,"bans":[],"enemyPicks":[]}'],
		[
			"a v1 session missing a role slot",
			'{"v":1,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null}}',
		],
		[
			"a v1 session whose bans are not a list",
			'{"v":1,"bans":null,"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		// An array answers `in` for "1" through "5" exactly as the role keys do,
		// so key presence alone lets one through as the five slots.
		[
			"a v1 session whose teamPicks is an array",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"myRole":null,"bans":[],"enemyPicks":[],"teamPicks":[0,1,2,3,4,5]}',
		],
		// Absent, not null: the screen choice asks `side === null`, so restoring
		// this as `undefined` opens the board over a session with no side.
		[
			"a v1 session with no side",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","myRole":null,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session with no myRole",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session with no createdAt",
			'{"v":1,"side":null,"myRole":null,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session whose side is not a side",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":"purple","myRole":null,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session whose myRole is not a role",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"myRole":9,"bans":[],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session whose bans hold something other than a hero id",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"myRole":null,"bans":["oops"],"enemyPicks":[],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
		[
			"a v1 session whose team slot holds something other than a hero id",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"myRole":null,"bans":[],"enemyPicks":[],"teamPicks":{"1":"x","2":null,"3":null,"4":null,"5":null}}',
		],
		// The type says at most five; the reducer refuses a sixth, so a stored
		// sixth can only have come from somewhere the reducer never wrote.
		[
			"a v1 session holding a sixth enemy pick",
			'{"v":1,"createdAt":"2026-08-15T00:00:00.000Z","side":null,"myRole":null,"bans":[],"enemyPicks":[1,2,3,4,5,6],"teamPicks":{"1":null,"2":null,"3":null,"4":null,"5":null}}',
		],
	])("discards %s for an empty session", (_label, raw) => {
		store.set(SESSION_KEY, raw);

		let session: Session | undefined;
		expect(() => {
			session = restore();
		}).not.toThrow();
		// The whole session, not `side` and `myRole` alone: a stored value may
		// carry those two correctly and be malformed elsewhere, and asking only
		// about them passes whether the value was discarded or handed back.
		// `createdAt` is the one field a fresh session sets to now.
		expect(session).toEqual({
			...EMPTY_SESSION(),
			createdAt: session?.createdAt as string,
		});
	});

	test("an unreadable storage still yields a session", () => {
		(globalThis as { localStorage?: unknown }).localStorage = {
			getItem: () => {
				throw new DOMException("access denied", "SecurityError");
			},
			setItem: () => {},
		};
		expect(restore().side).toBeNull();
	});
});

describe("persist", () => {
	test("writes every key, including empty and null ones", () => {
		persist(EMPTY_SESSION());

		const written = JSON.parse(store.get(SESSION_KEY) as string);
		expect(Object.keys(written).sort()).toEqual([
			"bans",
			"createdAt",
			"enemyPicks",
			"myRole",
			"side",
			"teamPicks",
			"v",
		]);
		expect(Object.keys(written.teamPicks).sort()).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
		]);
		expect(written.side).toBeNull();
		expect(written.myRole).toBeNull();
	});

	test("a rejected write leaves the caller unharmed", () => {
		(globalThis as { localStorage?: unknown }).localStorage = {
			getItem: () => null,
			setItem: () => {
				throw new DOMException("quota exceeded", "QuotaExceededError");
			},
		};
		expect(() => persist(EMPTY_SESSION())).not.toThrow();
	});
});

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

	test("two changes in sequence both reach storage", () => {
		const withSide = applied(restore(), { kind: "side", side: "dire" });
		persist(withSide);
		const withRole = applied(withSide, { kind: "role", role: 2 });
		persist(withRole);

		const restored = restore();
		expect(restored.side).toBe("dire");
		expect(restored.myRole).toBe(2);
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

describe("reset", () => {
	const drafted: Session = {
		...EMPTY_SESSION(),
		side: "dire",
		myRole: 2,
		bans: [1, 2],
		teamPicks: { "1": 3, "2": 4, "3": null, "4": null, "5": null },
		enemyPicks: [5],
	};

	test("clears the draft and keeps the setup", () => {
		const after = resetDraft(drafted);

		expect(after.bans).toEqual([]);
		expect(after.enemyPicks).toEqual([]);
		expect(Object.values(after.teamPicks)).toEqual([
			null,
			null,
			null,
			null,
			null,
		]);
		expect(after.side).toBe("dire");
		expect(after.myRole).toBe(2);
	});

	test("does not mutate the session it clears", () => {
		const snapshot = structuredClone(drafted);
		resetDraft(drafted);
		expect(drafted).toEqual(snapshot);
	});

	// screens-spec §4: ten picks is a finished draft, and finishing one is the
	// normal reason to start the next.
	test.each([
		["an empty draft", EMPTY_SESSION(), true],
		["a part-filled draft", drafted, true],
		[
			"a complete draft",
			{
				...drafted,
				teamPicks: { "1": 3, "2": 4, "3": 6, "4": 7, "5": 8 },
				enemyPicks: [9, 10, 11, 12, 13],
			},
			false,
		],
		[
			"five team picks and four enemies",
			{
				...drafted,
				teamPicks: { "1": 3, "2": 4, "3": 6, "4": 7, "5": 8 },
				enemyPicks: [9, 10, 11, 12],
			},
			true,
		],
	] satisfies [string, Session, boolean][])(
		"%s asks before resetting: %p",
		(_label, session, asks) => {
			expect(confirmsReset(session)).toBe(asks);
		},
	);
});

describe("the undo backup", () => {
	const drafted: Session = {
		...EMPTY_SESSION(),
		side: "radiant",
		myRole: 5,
		bans: [1, 2, 3, 4],
		teamPicks: { "1": 5, "2": 6, "3": null, "4": null, "5": null },
		enemyPicks: [7],
	};

	test("round-trips the draft it was handed", () => {
		writeBackup(drafted);
		expect(readBackup()).toEqual(drafted);
	});

	test("is absent until a reset writes one", () => {
		expect(readBackup()).toBeNull();
	});

	test("a second reset replaces it instead of stacking", () => {
		const later: Session = { ...drafted, bans: [9] };
		writeBackup(drafted);
		writeBackup(later);

		expect(readBackup()).toEqual(later);
	});

	test("is gone once cleared", () => {
		writeBackup(drafted);
		clearBackup();

		expect(readBackup()).toBeNull();
	});

	test.each([
		["unparseable JSON", "{not json"],
		["null", "null"],
		["a future schema version", '{"v":2,"side":"dire"}'],
		["a v1 fragment with no teamPicks", '{"v":1,"bans":[],"enemyPicks":[]}'],
	])("discards %s rather than offering a broken undo", (_label, raw) => {
		store.set(BACKUP_KEY, raw);

		let backup: Session | null | undefined;
		expect(() => {
			backup = readBackup();
		}).not.toThrow();
		expect(backup).toBeNull();
	});

	// The window closes on a hero entered, not on a key pressed: only the
	// reducer knows whether one was, and the setup a reset keeps is not a draft.
	test.each([
		["banAdd", { kind: "banAdd", hero: 9 }, true],
		["teamSet", { kind: "teamSet", role: 1, hero: 9 }, true],
		["enemyAdd", { kind: "enemyAdd", hero: 9 }, true],
		["side", { kind: "side", side: "dire" }, false],
		["role", { kind: "role", role: 4 }, false],
		["banRemove", { kind: "banRemove", index: 0 }, false],
		["teamClear", { kind: "teamClear", role: 1 }, false],
		["enemyRemove", { kind: "enemyRemove", index: 0 }, false],
	] satisfies [string, Action, boolean][])(
		"an accepted %s ends the undo window: %p",
		(_label, action, ends) => {
			const session: Session = {
				...EMPTY_SESSION(),
				bans: [1],
				teamPicks: { "1": 2, "2": null, "3": null, "4": null, "5": null },
				enemyPicks: [3],
			};
			const after = applyAction(session, action, NO_LIMIT);

			expect(after).not.toBe(session);
			expect(closesUndoWindow(session, after, action)).toBe(ends);
		},
	);

	// The reducer hands back the session it was given whenever it refuses.
	test.each([
		[
			"a ban at the limit",
			{ ...EMPTY_SESSION(), bans: [1, 2, 3] },
			{ kind: "banAdd", hero: 9 } satisfies Action,
			3,
		],
		[
			"a pick of a hero already banned",
			{ ...EMPTY_SESSION(), bans: [9] },
			{ kind: "teamSet", role: 1, hero: 9 } satisfies Action,
			NO_LIMIT,
		],
		[
			"a sixth enemy pick",
			{ ...EMPTY_SESSION(), enemyPicks: [1, 2, 3, 4, 5] },
			{ kind: "enemyAdd", hero: 9 } satisfies Action,
			NO_LIMIT,
		],
	])("%s leaves the undo window open", (_label, session, action, limit) => {
		const after = applyAction(session, action, limit);

		expect(after).toBe(session);
		expect(closesUndoWindow(session, after, action)).toBe(false);
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

	test("eight actions in sequence all survive to storage", () => {
		const after = applied(
			restore(),
			{ kind: "side", side: "dire" },
			{ kind: "role", role: 3 },
			{ kind: "banAdd", hero: 1 },
			{ kind: "banAdd", hero: 2 },
			{ kind: "banRemove", index: 0 },
			{ kind: "teamSet", role: 3, hero: 4 },
			{ kind: "enemyAdd", hero: 5 },
			{ kind: "enemyAdd", hero: 6 },
		);
		persist(after);

		expect(restore()).toEqual({
			...after,
			side: "dire",
			myRole: 3,
			bans: [2],
			teamPicks: { "1": null, "2": null, "3": 4, "4": null, "5": null },
			enemyPicks: [5, 6],
		});
	});
});
