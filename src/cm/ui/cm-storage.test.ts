/**
 * The CM session in localStorage: kept under a key of its own, read back
 * whole or not at all, and never touching the All Pick page's session.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { SESSION_KEY } from "../../app/session-storage.ts";
import {
	CM_SESSION_KEY,
	persistSession,
	restoreSession,
} from "./cm-storage.ts";
import { emptySession, reduce } from "./session.ts";

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

const midDraft = () =>
	[14, 26, 8].reduce(
		(s, hero) => reduce(s, { type: "enter", hero }),
		reduce(reduce(emptySession(), { type: "side", side: "dire" }), {
			type: "pickOrder",
			pickOrder: "second",
		}),
	);

test("nothing stored starts an empty session", () => {
	expect(restoreSession()).toEqual(emptySession());
});

test("a stored session comes back as it was", () => {
	persistSession(midDraft());
	expect(restoreSession()).toEqual(midDraft());
});

test.each([
	["text that is not JSON", "{"],
	["a session of another version", JSON.stringify({ ...midDraft(), v: 2 })],
])("%s starts an empty session", (_, raw) => {
	store.set(CM_SESSION_KEY, raw);
	expect(restoreSession()).toEqual(emptySession());
});

test("the CM key is its own, and the All Pick session is left as it was", () => {
	store.set(SESSION_KEY, "all-pick");
	persistSession(midDraft());
	expect(CM_SESSION_KEY).not.toBe(SESSION_KEY);
	expect(store.get(SESSION_KEY)).toBe("all-pick");
	expect([...store.keys()].sort()).toEqual(
		[CM_SESSION_KEY, SESSION_KEY].sort(),
	);
});

// spec: cm-draft/resetting-the-draft
test("reset clears the steps and keeps the setup and rosters", () => {
	const named = reduce(midDraft(), {
		type: "nickname",
		team: "ours",
		index: 0,
		name: "Kept",
	});
	const reset = reduce(named, { type: "reset" });
	expect(reset.steps).toEqual([]);
	expect(reset).toEqual({ ...named, steps: [] });
	expect(reduce(reset, { type: "reset" })).toBe(reset);
});
