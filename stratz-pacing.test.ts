/**
 * The per-second ceiling the API publishes, and the quota verdict that ends a
 * run rather than pacing it.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
	client,
	limited,
	ok,
	Q,
	raisedBy,
	settle,
	stub,
} from "./stratz.fixture.ts";

/** The API's own per-second ceiling and the span it is counted over. */
const PER_SECOND = 8;
const WINDOW_MS = 1000;

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("the ceiling the client paces under", () => {
	// spec: snapshot-ingest/the-ninth-request-in-a-second
	test("eight back-to-back requests all go out inside one second [4]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await settle(
			Promise.all(Array.from({ length: PER_SECOND }, () => query(Q))),
		);

		expect(calls).toHaveLength(PER_SECOND);
		const first = calls[0]?.at ?? 0;
		expect(calls.every((call) => call.at - first < WINDOW_MS)).toBe(true);
	});

	// The boundary from below: the ceiling is eight, so the eighth is the last
	// one that owes no wait. A client pacing at seven would fail here and pass
	// every test above.
	// spec: snapshot-ingest/the-ninth-request-in-a-second
	test("the eighth inside one second is not delayed [7]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await settle(
			Promise.all(Array.from({ length: PER_SECOND }, () => query(Q))),
		);

		expect(calls[PER_SECOND - 1]?.at).toBe(calls[0]?.at);
	});

	// spec: snapshot-ingest/the-ninth-request-in-a-second
	test("the ninth waits a second from the first of the eight [5]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await settle(
			Promise.all(Array.from({ length: PER_SECOND + 1 }, () => query(Q))),
		);

		expect(calls).toHaveLength(PER_SECOND + 1);
		expect(calls[PER_SECOND]?.at).toBe((calls[0]?.at ?? 0) + WINDOW_MS);
	});

	// spec: snapshot-ingest/the-ninth-request-in-a-second
	test("a request past the window is not delayed further [6]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);
		await settle(
			Promise.all(Array.from({ length: PER_SECOND }, () => query(Q))),
		);
		const eighth = calls[PER_SECOND - 1]?.at ?? 0;
		jest.advanceTimersByTime(WINDOW_MS);

		await settle(query(Q));

		expect(calls[PER_SECOND]?.at).toBe(eighth + WINDOW_MS);
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
