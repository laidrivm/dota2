import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Role, type Session } from "../types.ts";
import {
	type Action,
	applyAction,
	closesEditor,
	type HotkeyContext,
	hotkeyContext,
	hotkeyFor,
	persist,
	restore,
	SESSION_KEY,
} from "./session.ts";

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
	};
});

afterEach(() => {
	(globalThis as { localStorage?: unknown }).localStorage = undefined;
});

const keystroke = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
	key,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	...modifiers,
});

const press = (
	key: string,
	modifiers: Partial<KeyboardEvent> = {},
	context: HotkeyContext = "setup",
) => hotkeyFor(keystroke(key, modifiers), context);

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
	])("discards %s for an empty session", (_label, raw) => {
		store.set(SESSION_KEY, raw);

		let session: Session | undefined;
		expect(() => {
			session = restore();
		}).not.toThrow();
		expect(session?.side).toBeNull();
		expect(session?.myRole).toBeNull();
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

describe("hotkeys", () => {
	test.each([
		["r", "radiant"],
		["R", "radiant"],
		["d", "dire"],
		["D", "dire"],
	])("%s selects %s", (key, side) => {
		expect(press(key)).toEqual({ kind: "side", side: side as "radiant" });
	});

	const roleKeys: [string, string, Role][] = [
		["1", "c", 1],
		["2", "m", 2],
		["3", "o", 3],
		["4", "s", 4],
		["5", "f", 5],
	];

	test.each(roleKeys)(
		"digit %s and letter %s both mean role %p",
		(digit, letter, role) => {
			expect(press(digit)).toEqual({ kind: "role", role });
			expect(press(letter)).toEqual({ kind: "role", role });
			expect(press(letter.toUpperCase())).toEqual({ kind: "role", role });
		},
	);

	test.each(["6", "0", "x", "Enter", " ", "Escape"])(
		"%s is not a hotkey",
		(key) => {
			expect(press(key)).toBeNull();
		},
	);

	test.each(["ctrlKey", "metaKey", "altKey"] as const)(
		"%s held makes it the browser's keystroke, not ours",
		(modifier) => {
			expect(press("r", { [modifier]: true })).toBeNull();
			expect(press("3", { [modifier]: true })).toBeNull();
		},
	);
});

describe("hotkey context", () => {
	const ready: Session = { ...EMPTY_SESSION(), side: "dire", myRole: 2 };

	test.each([
		["an empty session", EMPTY_SESSION(), false, "setup"],
		[
			"a session with only a side",
			{ ...EMPTY_SESSION(), side: "dire" },
			false,
			"setup",
		],
		["a set-up session", ready, false, "board"],
		["a set-up session with the editor open", ready, true, "editor"],
		["an empty session with the editor open", EMPTY_SESSION(), true, "editor"],
	] satisfies [string, Session, boolean, HotkeyContext][])(
		"%s routes to %s",
		(_label, session, editorOpen, context) => {
			expect(hotkeyContext(session, editorOpen)).toBe(context);
		},
	);

	test.each(["setup", "editor"] as const)(
		"side and role keys are live in the %s context",
		(context) => {
			expect(press("r", {}, context)).toEqual({
				kind: "side",
				side: "radiant",
			});
			expect(press("3", {}, context)).toEqual({ kind: "role", role: 3 });
		},
	);

	test.each(["r", "d", "1", "2", "3", "4", "5", "c", "m", "o", "s", "f"])(
		"%s does nothing on the board — proposal 2c owns those keys",
		(key) => {
			expect(press(key, {}, "board")).toBeNull();
		},
	);

	test("Esc closes the editor and is not a session change", () => {
		expect(closesEditor(keystroke("Escape"))).toBe(true);
		expect(press("Escape", {}, "editor")).toBeNull();
	});

	test.each(["Enter", "e", "b", " "])("%s does not close the editor", (key) => {
		expect(closesEditor(keystroke(key))).toBe(false);
	});

	test("a modified Esc belongs to the browser", () => {
		expect(closesEditor(keystroke("Escape", { metaKey: true }))).toBe(false);
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
});

describe("single occupancy", () => {
	const picked: Session = {
		...EMPTY_SESSION(),
		bans: [1],
		teamPicks: { "1": 2, "2": null, "3": null, "4": null, "5": null },
		enemyPicks: [3],
	};

	test.each([
		["a banned hero", 1],
		["a hero on my team", 2],
		["a hero on the enemy team", 3],
	])("%s cannot be banned again", (_label, hero) => {
		expect(applied(picked, { kind: "banAdd", hero })).toEqual(picked);
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
