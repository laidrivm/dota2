/**
 * What a window with nothing left in it means, which depends on which window
 * it is.
 *
 * A window a run can outwait is not a spent quota — it is a key another caller
 * is also spending, or a window this run entered part-used. Only the longest
 * window the API states ends a run, because no wait inside a run outlasts it.
 * Measured: a run that ended on the minute window left 14 160 of 15 000 daily
 * calls unspent.
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
	states,
	stub,
} from "./stratz.fixture.ts";

const MINUTE = 60_000;

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("a window with nothing left", () => {
	/**
	 * The whole defect in one case: a minute window at zero beside a day window
	 * with plenty left is a run that waits, not a run that ends.
	 */
	// spec: snapshot-ingest/a-refillable-window-reports-nothing-remaining
	test("a refillable window at zero suspends the run [105]", async () => {
		const { fetch, calls } = stub([
			paced({
				minute: { limit: 150, remaining: 0 },
				day: { limit: 15_000, remaining: 14_160 },
			}),
			ok(),
		]);
		const query = client(fetch);

		const body = await settle(query(Q));

		// The one query made two requests: the first met the spent minute and
		// the second went out once it had turned, rather than the run ending
		// with a day's calls unspent.
		expect(body).toEqual({ data: { heroStats: {} } });
		expect(calls).toHaveLength(2);
		expect(calls[1]?.at).toBe((calls[0]?.at ?? 0) + MINUTE);
	});

	/**
	 * "Issuing no request in the meantime" is the client's, not one caller's: a
	 * window with nothing left in it has nothing left for whoever asks next.
	 * A second caller paces by counters that still show room — the key having
	 * been spent elsewhere — and would issue straight into the window the first
	 * is waiting out.
	 */
	// spec: snapshot-ingest/a-refillable-window-reports-nothing-remaining
	test("a spent window holds every caller, not the one that met it [105]", async () => {
		const { fetch, calls } = stub([
			paced({
				minute: { limit: 150, remaining: 0 },
				day: { limit: 15_000, remaining: 14_000 },
			}),
			ok(),
		]);
		const query = client(fetch);

		await settle(Promise.all([query(Q), query(Q)]));

		expect(calls).toHaveLength(3);
		// Neither the first's retry nor the second caller's request goes out
		// before the minute has turned.
		const first = calls[0]?.at ?? 0;
		expect(calls.slice(1).every((call) => call.at >= first + MINUTE)).toBe(
			true,
		);
	});

	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("the longest window at zero ends the run naming it [106]", async () => {
		const { fetch, calls } = stub([
			paced({
				minute: { limit: 150, remaining: 149 },
				day: { limit: 15_000, remaining: 0 },
			}),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("day");
		expect(calls).toHaveLength(1);
	});

	/**
	 * The verdict is terminal for the run, not for the request that met it. A
	 * client that failed only that one request would let the next pull reach
	 * the network — the refusal the requirement exists to avoid.
	 */
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("no later request is issued once the longest window is spent [83]", async () => {
		const { fetch, calls } = stub([
			paced({ day: { limit: 15_000, remaining: 0 } }),
			ok(),
		]);
		const query = client(fetch);
		await raisedBy(query(Q));

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("day");
		expect(calls).toHaveLength(1);
	});

	// Below zero is still nothing left, so the verdict turns on `<= 0` rather
	// than on equality with zero.
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("a negative remaining count ends the run [106]", async () => {
		const { fetch } = stub([paced({ day: { limit: 15_000, remaining: -1 } })]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("day");
	});

	/**
	 * The one a sequential caller cannot reach: a second query held on the cold
	 * start, or on a window's ceiling, while the first meets the verdict. It
	 * wakes into a client that already knows the quota is spent, and a check
	 * made only on the way in would let it reach the network anyway.
	 */
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("a request already waiting is refused once the longest is spent [83]", async () => {
		const { fetch, calls } = stub([
			paced({ day: { limit: 15_000, remaining: 0 } }),
			ok(),
		]);
		const query = client(fetch);

		const outcomes = await settle(Promise.allSettled([query(Q), query(Q)]));

		expect(outcomes.every((o) => o.status === "rejected")).toBe(true);
		expect(calls).toHaveLength(1);
	});

	/**
	 * A window the client cannot put a length to cannot be shown to refill
	 * inside a run, so it is read as at least as long as any it knows and ends
	 * the run rather than suspending it for a span nobody can name.
	 */
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("a window of unknown length at zero ends the run [106]", async () => {
		const { fetch } = stub([
			paced({
				fortnight: { limit: 100, remaining: 0 },
				day: { limit: 15_000, remaining: 14_000 },
			}),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("fortnight");
	});

	/**
	 * A response that states no ceiling gives nothing to compare against, so
	 * the client cannot tell whether a window longer than the spent one exists.
	 * It ends the run rather than waiting one out and finding the quota gone
	 * anyway — which is also what it did before this group, for a source that
	 * names no ceilings at all.
	 */
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test("a spent window beside no stated ceiling ends the run [106]", async () => {
		const { fetch } = stub([limited({ "x-ratelimit-remaining-minute": "0" })]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("minute");
	});

	/**
	 * The bound on waiting, which is the bound on attempts and for the same
	 * reason: a wait is not a failed attempt, but a source answering "nothing
	 * left" for ever would suspend a run whose whole contract is to reach an
	 * outcome and report it.
	 */
	// spec: snapshot-ingest/a-window-that-never-turns
	test("a window that never refills ends the run rather than hanging [105]", async () => {
		const { fetch, calls } = stub([
			paced({
				minute: { limit: 150, remaining: 0 },
				day: { limit: 15_000, remaining: 14_000 },
			}),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("waits made");
		// Four waits, each after an attempt that met the same spent window, and
		// the fifth attempt is where the bound is reached.
		expect(calls).toHaveLength(5);
	});

	/**
	 * A header that carries no number is not a report of zero. Reading one as
	 * zero would end a healthy run on a header the service sent empty or
	 * unparseable — which is what a bare coercion does, since `Number("")` is 0
	 * and `Number("abc")` is `NaN`.
	 */
	// spec: snapshot-ingest/the-longest-window-reports-nothing-remaining
	test.each([
		["blank", ""],
		["unparseable", "abc"],
	])("a %s remaining header does not end the run [16]", async (_, value) => {
		const { fetch } = stub([
			limited({
				...states({ day: { limit: 15_000, remaining: 14_000 } }),
				"x-ratelimit-remaining-minute": value,
			}),
		]);
		const query = client(fetch);

		const body = await settle(query(Q));

		expect(body).toEqual({ data: {} });
	});

	// spec: snapshot-ingest/a-rate-limited-response-with-the-longest-window-spent
	test("a 429 with the longest window spent is attempted once [107]", async () => {
		const { fetch, calls } = stub([
			limited(states({ day: { limit: 15_000, remaining: 0 } }), 429),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("day");
		expect(calls).toHaveLength(1);
	});

	/**
	 * The other half of that rule: a `429` carrying a window that refills is
	 * waited out and the request goes again, where the same status with the
	 * longest window spent is attempted once and abandoned.
	 */
	// spec: snapshot-ingest/a-rate-limited-response-with-the-longest-window-spent
	test("a 429 with only a refillable window spent is waited out [107]", async () => {
		const { fetch, calls } = stub([
			limited(
				states({
					minute: { limit: 150, remaining: 0 },
					day: { limit: 15_000, remaining: 14_000 },
				}),
				429,
			),
			ok(),
		]);
		const query = client(fetch);

		const body = await settle(query(Q));

		expect(body).toEqual({ data: { heroStats: {} } });
		expect(calls).toHaveLength(2);
		expect(calls[1]?.at).toBe((calls[0]?.at ?? 0) + MINUTE);
	});
});
