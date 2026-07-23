import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Role, type Session } from "../types.ts";
import {
	applyHotkey,
	hotkeyFor,
	persist,
	restore,
	SESSION_KEY,
} from "./session.ts";

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

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
	hotkeyFor({
		key,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		...modifiers,
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

describe("applying a hotkey", () => {
	test("selects a side", () => {
		const next = applyHotkey(EMPTY_SESSION(), {
			kind: "side",
			side: "radiant",
		});
		expect(next.side).toBe("radiant");
	});

	test("re-selecting the current side keeps it selected", () => {
		const once = applyHotkey(EMPTY_SESSION(), {
			kind: "side",
			side: "radiant",
		});
		const twice = applyHotkey(once, { kind: "side", side: "radiant" });
		expect(twice.side).toBe("radiant");
	});

	test("leaves the rest of the draft alone", () => {
		const before: Session = {
			...EMPTY_SESSION(),
			bans: [14, 22],
			enemyPicks: [8],
			teamPicks: { "1": null, "2": 5, "3": null, "4": null, "5": null },
		};

		const after = applyHotkey(before, { kind: "side", side: "dire" });

		expect(after.bans).toEqual(before.bans);
		expect(after.enemyPicks).toEqual(before.enemyPicks);
		expect(after.teamPicks).toEqual(before.teamPicks);
		expect(after.createdAt).toBe(before.createdAt);
	});

	test("does not mutate the session it is given", () => {
		const before = EMPTY_SESSION();
		applyHotkey(before, { kind: "role", role: 4 });
		expect(before.myRole).toBeNull();
	});

	test("two changes in sequence both reach storage", () => {
		const withSide = applyHotkey(restore(), {
			kind: "side",
			side: "dire",
		});
		persist(withSide);
		const withRole = applyHotkey(withSide, { kind: "role", role: 2 });
		persist(withRole);

		const restored = restore();
		expect(restored.side).toBe("dire");
		expect(restored.myRole).toBe(2);
	});
});
