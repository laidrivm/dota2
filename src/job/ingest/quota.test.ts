/**
 * The quota arithmetic without a client in front of it: which windows a
 * response states, and when the next request may go out.
 *
 * What the client does with those answers — holding a burst until the first
 * response, waiting a window out — is `stratz-pacing.test.ts`'s. These are the
 * readings it rests on.
 */
import { describe, expect, test } from "bun:test";
import { prune, readyAt, stated } from "./quota.ts";

const headers = (pairs: Record<string, string>) => new Headers(pairs);

const SECOND = 1_000;
const MINUTE = 60_000;

describe("the windows a response states", () => {
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a ceiling is taken with the length its name stands for", () => {
		const found = stated(
			headers({
				"x-ratelimit-limit-second": "8",
				"x-ratelimit-limit-minute": "150",
			}),
		);

		// As an object, not a list of pairs: `Headers` iterates its names in
		// alphabetical order, which is not an order this answer has.
		expect(Object.fromEntries(found)).toEqual({
			second: { limit: 8, span: SECOND },
			minute: { limit: 150, span: MINUTE },
		});
	});

	/**
	 * A window this repository has no length for cannot be paced — there is no
	 * span to count requests over — so it is left out rather than kept and
	 * skipped. A ceiling this answered with and `readyAt` then passed over
	 * would read as paced while the client issued past it.
	 */
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a window of an unknown name states nothing", () => {
		const found = stated(headers({ "x-ratelimit-limit-fortnight": "100" }));

		expect([...found]).toEqual([]);
	});

	// A ceiling that is not a number bounds nothing, and a zero one would hold
	// every request for ever rather than pacing any.
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	// A fractional one is here for the reason the others are not obvious: the
	// ceiling is compared against a count, so half a request would have
	// `readyAt` index between two instants and pace the window by nothing.
	test.each([
		["unparseable", "abc"],
		["zero", "0"],
		["blank", ""],
		["fractional", "2.5"],
	])("a %s ceiling states no window", (_, value) => {
		expect(stated(headers({ "x-ratelimit-limit-day": value })).size).toBe(0);
	});
});

describe("when the next request may go out", () => {
	const ceilings = new Map([["second", { limit: 2, span: SECOND }]]);

	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a window with room is ready now", () => {
		expect(readyAt([1_000], ceilings, 1_500)).toBe(1_500);
	});

	// The instant the request that has to leave the window actually leaves it,
	// not a whole window from now: a client waiting the latter paces slower
	// than the ceiling it was given.
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a full window is ready when its oldest request leaves", () => {
		expect(readyAt([1_000, 1_200], ceilings, 1_300)).toBe(2_000);
	});

	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("an instant inside no window is dropped", () => {
		const issued = [1_000, 5_000];

		prune(issued, ceilings, 5_500);

		expect(issued).toEqual([5_000]);
	});
});
