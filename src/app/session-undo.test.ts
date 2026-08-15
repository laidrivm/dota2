import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Session } from "../types.ts";
import {
	type Action,
	applyAction,
	closesUndoWindow,
	confirmsReset,
	resetDraft,
} from "./session.ts";
import {
	BACKUP_KEY,
	clearBackup,
	persist,
	readBackup,
	restore,
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

/** What the reducer writes comes back as what it wrote. */
describe("a draft survives the round trip", () => {
	test("two changes in sequence both reach storage", () => {
		const withSide = applied(restore(), { kind: "side", side: "dire" });
		persist(withSide);
		const withRole = applied(withSide, { kind: "role", role: 2 });
		persist(withRole);

		const restored = restore();
		expect(restored.side).toBe("dire");
		expect(restored.myRole).toBe(2);
	});

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
