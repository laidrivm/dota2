import { describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Role, type Session } from "../types.ts";
import {
	closesEditor,
	type HotkeyContext,
	hotkeyContext,
	hotkeyFor,
	ownsKeystroke,
	pickerHotkey,
} from "./hotkeys.ts";

/** Every test here works far below the ban limit. */
const NO_LIMIT = 100;

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
			expect(hotkeyContext(session, editorOpen, false)).toBe(context);
		},
	);

	// screens-spec §5 routes to the topmost context, and a modal <dialog> still
	// bubbles its keystrokes to the document listener underneath it.
	test.each([
		["the board", ready, false],
		["the open editor", ready, true],
		["Setup", EMPTY_SESSION(), false],
	] satisfies [string, Session, boolean][])(
		"an open modal outranks %s",
		(_label, session, editorOpen) => {
			expect(hotkeyContext(session, editorOpen, true)).toBe("modal");
		},
	);

	test.each(["r", "d", "3", "f"])("%s is dead while a modal is open", (key) => {
		expect(press(key, {}, "modal")).toBeNull();
	});

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
		"%s changes no session field on the board — it opens the picker instead",
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

	test.each([
		["a select, which types ahead on the same letters", { tagName: "SELECT" }],
		["a text field", { tagName: "INPUT", type: "text" }],
		["a search field", { tagName: "INPUT", type: "search" }],
		["a textarea", { tagName: "TEXTAREA" }],
		["a contenteditable region", { tagName: "DIV", isContentEditable: true }],
	])("%s owns its keystrokes", (_label, target) => {
		expect(ownsKeystroke(target)).toBe(true);
	});

	test.each([
		["nothing focused", null],
		[
			"the side and role chips, which are what the hotkeys drive",
			{
				tagName: "INPUT",
				type: "radio",
			},
		],
		["a checkbox", { tagName: "INPUT", type: "checkbox" }],
		["a button", { tagName: "BUTTON" }],
		["the body", { tagName: "BODY" }],
	])("%s does not", (_label, target) => {
		expect(ownsKeystroke(target)).toBe(false);
	});
});

describe("picker hotkeys", () => {
	const ready: Session = { ...EMPTY_SESSION(), side: "dire", myRole: 2 };
	const open = (
		key: string,
		session: Session = ready,
		banLimit = NO_LIMIT,
		modifiers: Partial<KeyboardEvent> = {},
	) => pickerHotkey(keystroke(key, modifiers), session, banLimit);

	test.each(["b", "B"])("%s opens the picker for a ban", (key) => {
		expect(open(key)).toEqual({ kind: "ban" });
	});

	test.each(["e", "E"])("%s opens the picker for the enemy team", (key) => {
		expect(open(key)).toEqual({ kind: "enemy" });
	});

	test.each([
		["1", "c", 1],
		["2", "m", 2],
		["3", "o", 3],
		["4", "s", 4],
		["5", "f", 5],
	] satisfies [string, string, Role][])(
		"digit %s and letter %s both open the picker for role %p",
		(digit, letter, role) => {
			expect(open(digit)).toEqual({ kind: "team", role });
			expect(open(letter)).toEqual({ kind: "team", role });
		},
	);

	test("a filled role opens all the same — the pick is a replacement", () => {
		const filled: Session = {
			...ready,
			teamPicks: { "1": null, "2": null, "3": 7, "4": null, "5": null },
		};
		expect(open("o", filled)).toEqual({ kind: "team", role: 3 });
	});

	test("a ban one below the limit still opens the picker", () => {
		const session: Session = { ...ready, bans: [1, 2] };
		expect(open("b", session, 3)).toEqual({ kind: "ban" });
	});

	test("no picker for a ban at the limit", () => {
		const session: Session = { ...ready, bans: [1, 2, 3] };
		expect(open("b", session, 3)).toBeNull();
	});

	test("a fifth enemy pick still opens the picker", () => {
		const session: Session = { ...ready, enemyPicks: [1, 2, 3, 4] };
		expect(open("e", session)).toEqual({ kind: "enemy" });
	});

	test("no picker for an enemy when all five are entered", () => {
		const session: Session = { ...ready, enemyPicks: [1, 2, 3, 4, 5] };
		expect(open("e", session)).toBeNull();
	});

	test.each(["6", "0", "x", "Enter", " ", "Escape", "r", "d"])(
		"%s opens nothing",
		(key) => {
			expect(open(key)).toBeNull();
		},
	);

	test.each(["ctrlKey", "metaKey", "altKey"] as const)(
		"%s held leaves the keystroke to the browser",
		(modifier) => {
			expect(open("b", ready, NO_LIMIT, { [modifier]: true })).toBeNull();
			expect(open("3", ready, NO_LIMIT, { [modifier]: true })).toBeNull();
		},
	);
});
