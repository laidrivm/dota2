/**
 * The ceilings the client paces under — every window the response states, not
 * the shortest of them.
 *
 * A run measured against the real API issued about 226 requests a minute
 * against a stated 150 because it held the second window alone, so the cases
 * below state more than one window and check the client against each. The
 * ceilings are the response's; nothing here restates a number the service
 * enforces except as the response that carries it.
 *
 * What a spent window means is unchanged here and still ends the run on any of
 * them; narrowing that to the longest is `-13b`'s.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
	client,
	limited,
	ok,
	paced,
	Q,
	raisedBy,
	settle,
	stub,
} from "./stratz.fixture.ts";

/** The spans the API's window names stand for, which is what pacing waits out. */
const SECOND = 1_000;
const MINUTE = 60_000;

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

/** `n` queries issued together, run forward until every one has settled. */
const burst = (query: (q: string) => Promise<unknown>, n: number) =>
	settle(Promise.all(Array.from({ length: n }, () => query(Q))));

describe("the ceilings the client paces under", () => {
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a window's stated limit goes out inside that window [102]", async () => {
		const { fetch, calls } = stub([
			paced({ second: { limit: 8, remaining: 7 } }),
		]);
		const query = client(fetch);

		await burst(query, 8);

		expect(calls).toHaveLength(8);
		const first = calls[0]?.at ?? 0;
		expect(calls.every((call) => call.at - first < SECOND)).toBe(true);
	});

	// The boundary from below: the ceiling is what the response states, so the
	// eighth is the last that owes no wait. A client pacing at seven would fail
	// here and pass every case above.
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("the last request inside the ceiling is not delayed [102]", async () => {
		const { fetch, calls } = stub([
			paced({ second: { limit: 8, remaining: 7 } }),
		]);
		const query = client(fetch);

		await burst(query, 8);

		expect(calls[7]?.at).toBe(calls[0]?.at);
	});

	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("the request past the ceiling waits the window out [102]", async () => {
		const { fetch, calls } = stub([
			paced({ second: { limit: 8, remaining: 7 } }),
		]);
		const query = client(fetch);

		await burst(query, 9);

		expect(calls).toHaveLength(9);
		expect(calls[8]?.at).toBe((calls[0]?.at ?? 0) + SECOND);
	});

	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a request past the window is not delayed further [6]", async () => {
		const { fetch, calls } = stub([
			paced({ second: { limit: 8, remaining: 7 } }),
		]);
		const query = client(fetch);
		await burst(query, 8);
		const eighth = calls[7]?.at ?? 0;
		jest.advanceTimersByTime(SECOND);

		await settle(query(Q));

		expect(calls[8]?.at).toBe(eighth + SECOND);
	});

	/**
	 * The defect this group exists for. Ten a minute beside a hundred a second
	 * is the same shape as 150 a minute beside 8 a second and a hundredth of
	 * the requests: a client holding the second window alone issues all eleven
	 * at once, where one holding both waits the minute out for the eleventh.
	 */
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a longer window binds where the shorter one does not [104]", async () => {
		const { fetch, calls } = stub([
			paced({
				second: { limit: 100, remaining: 99 },
				minute: { limit: 10, remaining: 9 },
			}),
		]);
		const query = client(fetch);

		await burst(query, 11);

		expect(calls).toHaveLength(11);
		// The first ten owe nothing: the minute holds them and the second is
		// nowhere near its own hundred.
		expect(calls[9]?.at).toBe(calls[0]?.at);
		expect(calls[10]?.at).toBe((calls[0]?.at ?? 0) + MINUTE);
	});

	/**
	 * Neither window is the one to pace by on its own: the second binds inside
	 * the first two seconds and the minute binds after them, so a client
	 * holding either alone lands a request at the wrong instant.
	 */
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("both windows bind, each where it is the tighter [104]", async () => {
		const { fetch, calls } = stub([
			paced({
				second: { limit: 2, remaining: 1 },
				minute: { limit: 5, remaining: 4 },
			}),
		]);
		const query = client(fetch);

		await burst(query, 6);

		const first = calls[0]?.at ?? 0;
		// Two a second: the third and fifth each wait a second on the second
		// window, and the sixth waits the minute out on the minute window.
		expect(calls.map((call) => call.at - first)).toEqual([
			0,
			0,
			SECOND,
			SECOND,
			2 * SECOND,
			MINUTE,
		]);
	});

	/**
	 * The ceilings are read rather than declared, so a service that moved one
	 * is followed with no edit here. Asserted by moving it: the first response
	 * states two a second, and from then on the client holds two.
	 */
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("the ceiling paced is the one the response stated [103]", async () => {
		const { fetch, calls } = stub([
			paced({ second: { limit: 2, remaining: 1 } }),
		]);
		const query = client(fetch);

		await burst(query, 4);

		const first = calls[0]?.at ?? 0;
		expect(calls.map((call) => call.at - first)).toEqual([
			0,
			0,
			SECOND,
			SECOND,
		]);
	});

	/**
	 * Before the first response there is no ceiling to hold, so the first
	 * request goes out unpaced. Stated because it is the one request a client
	 * cannot pace and a reader would otherwise call a gap.
	 */
	// spec: snapshot-ingest/a-window-at-its-stated-ceiling
	test("a response stating no window paces nothing [103]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await burst(query, 20);

		expect(calls).toHaveLength(20);
		expect(calls.every((call) => call.at === calls[0]?.at)).toBe(true);
	});
});

describe("the quota verdict", () => {
	/**
	 * A success carrying an exhausted window, so that what ends the run is the
	 * remaining count and not the status — the next request would be refused,
	 * and a run that continued into that refusal would report the refusal as
	 * the fault.
	 */
	// spec: snapshot-ingest/a-window-reports-nothing-remaining
	test("a window with nothing remaining ends the run [16]", async () => {
		const { fetch, calls } = stub([
			limited({ "x-ratelimit-remaining-minute": "0" }),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toMatch(/quota|remaining/i);
		expect(calls).toHaveLength(1);
	});

	/**
	 * A header that carries no number is not a report of zero. Reading one as
	 * zero would end a healthy run on a header the service sent empty or
	 * unparseable — which is what a bare coercion does, since `Number("")` is 0
	 * and `Number("abc")` is `NaN`.
	 */
	// spec: snapshot-ingest/a-window-reports-nothing-remaining
	test.each([
		["blank", ""],
		["unparseable", "abc"],
	])("a %s remaining header does not end the run [16]", async (_, value) => {
		const { fetch } = stub([
			limited({ "x-ratelimit-remaining-minute": value }),
		]);
		const query = client(fetch);

		const body = await settle(query(Q));

		expect(body).toEqual({ data: {} });
	});

	/**
	 * The verdict is terminal for the run, not for the request that met it. A
	 * client that only failed that one request would let the next pull reach
	 * the network — which is the refusal the requirement exists to avoid.
	 */
	// spec: snapshot-ingest/a-window-reports-nothing-remaining
	test("no later request is issued once a window is spent [83]", async () => {
		const { fetch, calls } = stub([
			limited({ "x-ratelimit-remaining-minute": "0" }),
			ok(),
		]);
		const query = client(fetch);
		await raisedBy(query(Q));

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toMatch(/quota|remaining/i);
		expect(calls).toHaveLength(1);
	});

	// Below zero is still nothing left, so the verdict turns on `<= 0` rather
	// than on equality with zero.
	// spec: snapshot-ingest/a-window-reports-nothing-remaining
	test("a negative remaining count ends the run [16]", async () => {
		const { fetch } = stub([limited({ "x-ratelimit-remaining-hour": "-1" })]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toMatch(/quota|remaining/i);
	});
});
