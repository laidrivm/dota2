import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SESSION, type Session } from "../types.ts";
import { persist, restore, SESSION_KEY } from "./session-storage.ts";

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
		// `createdAt` is the one field a fresh session sets to now. Strictly,
		// because `toEqual` treats a key holding `undefined` as absent — and a
		// field the guard let through unset is exactly what these cases store.
		expect(session).toStrictEqual({
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
