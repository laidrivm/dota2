/**
 * Which failures are retried, how long the client waits between attempts, and
 * where the quota verdict overrules the retry policy.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
	client,
	limited,
	ok,
	Q,
	raisedBy,
	settle,
	stalls,
	stallsMidBody,
	stub,
} from "./stratz.fixture.ts";

/** Attempts one request gets, and the wait before the first retry. */
const ATTEMPTS = 4;
const FIRST_BACKOFF_MS = 1000;

/** How long one attempt may stay open before it is abandoned. */
const ATTEMPT_TIMEOUT_MS = 30_000;

/** A server-side failure, which the policy retries. */
const fails = async () => new Response("boom", { status: 500 });

/** The gaps between consecutive attempts. */
const gaps = (calls: { at: number }[]) =>
	calls.slice(1).map((call, i) => call.at - (calls[i]?.at ?? 0));

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("what is retried, and how long the client waits", () => {
	// spec: snapshot-ingest/a-failure-that-does-not-clear
	test("the three delays between four attempts double from a second [8]", async () => {
		const { fetch, calls } = stub([fails]);
		const query = client(fetch);

		await raisedBy(query(Q));

		expect(gaps(calls)).toEqual([
			FIRST_BACKOFF_MS,
			FIRST_BACKOFF_MS * 2,
			FIRST_BACKOFF_MS * 4,
		]);
	});

	// spec: snapshot-ingest/a-failure-that-does-not-clear
	test("a fourth failing attempt issues no fifth [9]", async () => {
		const { fetch, calls } = stub([fails]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(ATTEMPTS);
	});

	// spec: snapshot-ingest/a-transient-failure
	test("a 500 then a 200 returns the second body and continues [13]", async () => {
		const { fetch, calls } = stub([fails, ok({ heroStats: { id: 1 } })]);
		const query = client(fetch);

		const body = await settle(query(Q));

		expect(body).toEqual({ data: { heroStats: { id: 1 } } });
		expect(calls).toHaveLength(2);
	});

	// A `4xx` other than `429` states something about the request, which a
	// second identical request cannot change.
	// spec: snapshot-ingest/a-rejected-request
	test("a 400 is attempted exactly once [14]", async () => {
		const { fetch, calls } = stub([
			async () => new Response("bad", { status: 400 }),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(1);
	});
});

describe("an attempt that never completes", () => {
	// spec: snapshot-ingest/a-request-that-never-completes
	test("a stalled attempt is abandoned at 30 seconds and retried [71]", async () => {
		const { fetch, calls } = stub([stalls(), ok()]);
		const query = client(fetch);

		await settle(query(Q));

		expect(calls).toHaveLength(2);
		expect(gaps(calls)).toEqual([ATTEMPT_TIMEOUT_MS + FIRST_BACKOFF_MS]);
	});

	/**
	 * The other half of the stall: the status arrived, so a client that stopped
	 * its clock once the headers landed would wait on this body for ever. What
	 * the requirement bounds is a *complete* response.
	 */
	// spec: snapshot-ingest/a-request-that-never-completes
	test("a body that never completes is abandoned and retried [81]", async () => {
		const { fetch, calls } = stub([stallsMidBody(), ok()]);
		const query = client(fetch);

		await settle(query(Q));

		expect(calls).toHaveLength(2);
		expect(gaps(calls)).toEqual([ATTEMPT_TIMEOUT_MS + FIRST_BACKOFF_MS]);
	});

	// spec: snapshot-ingest/a-stall-that-does-not-clear
	test("four stalled attempts end the run failed rather than hanging [72]", async () => {
		const { fetch, calls } = stub([stalls()]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(ATTEMPTS);
	});
});

describe("where the quota verdict overrules the retry policy", () => {
	// spec: snapshot-ingest/a-failure-that-does-not-clear
	test("four 429s with quota remaining end the run failed [15]", async () => {
		const { fetch, calls } = stub([
			limited({ "x-ratelimit-remaining-minute": "42" }, 429),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(ATTEMPTS);
	});

	/**
	 * The verdict has to be read on every attempt, not only the first. A client
	 * that checked the quota once and then trusted the retry policy passes every
	 * other test here, and would spend four attempts on a window it was told
	 * after the first was empty.
	 */
	// spec: snapshot-ingest/a-rate-limited-response-with-nothing-remaining
	test("a window spent mid-retry stops the run there [84]", async () => {
		const { fetch, calls } = stub([
			fails,
			limited({ "x-ratelimit-remaining-minute": "0" }, 429),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toMatch(/quota|remaining/i);
		expect(calls).toHaveLength(2);
	});

	// The same status as the test above, differing only in what the window
	// reports left — so what stops the retry can only be the remaining count.
	// spec: snapshot-ingest/a-rate-limited-response-with-nothing-remaining
	test("a 429 reporting nothing remaining is attempted once [63]", async () => {
		const { fetch, calls } = stub([
			limited({ "x-ratelimit-remaining-minute": "0" }, 429),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(1);
	});
});
