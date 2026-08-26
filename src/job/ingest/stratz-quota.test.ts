/**
 * What a window with nothing left in it means: the run ends there.
 *
 * Unchanged by the pacing this group rewrites, and kept apart from it so the
 * two halves of the quota requirement are read separately. Narrowing the
 * verdict from any window to the longest the response states is `-13b`'s.
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

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
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
	 * The one a sequential caller cannot reach: a second query held on the cold
	 * start, or on a window's ceiling, while the first meets the verdict. It
	 * wakes into a client that already knows the quota is spent, and a check
	 * made only on the way in would let it reach the network anyway.
	 */
	// spec: snapshot-ingest/a-window-reports-nothing-remaining
	test("a request already waiting is refused once a window is spent [83]", async () => {
		const { fetch, calls } = stub([
			limited({ "x-ratelimit-remaining-minute": "0" }),
			ok(),
		]);
		const query = client(fetch);

		const outcomes = await settle(Promise.allSettled([query(Q), query(Q)]));

		expect(outcomes.every((o) => o.status === "rejected")).toBe(true);
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
