/**
 * What a response means, which its status alone does not say: the gate and a
 * rejected key share a status, and a rejected query rides on a success.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import {
	challenge,
	client,
	json,
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

describe("the two things a 403 can mean", () => {
	// spec: snapshot-ingest/the-challenge-not-the-key
	test("a 403 carrying HTML names the User-Agent, not the key [11]", async () => {
		const { fetch } = stub([challenge()]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("User-Agent");
		expect(raised?.message).not.toMatch(/key/i);
	});

	// The requirement reads "whose `content-type` is not JSON", and a `403`
	// carrying no content type at all is the boundary of that wording.
	// spec: snapshot-ingest/the-challenge-not-the-key
	test("a 403 with no content-type reports the challenge [11]", async () => {
		const { fetch } = stub([async () => new Response(null, { status: 403 })]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toContain("User-Agent");
	});

	// The same status as the two above, and the only one of the three whose
	// content type is JSON — so what tells a rejected key from an unmet
	// challenge can only be that header.
	// spec: snapshot-ingest/the-key-not-the-challenge
	test("a 403 carrying JSON reports the key as rejected [12]", async () => {
		const { fetch } = stub([json({ error: "unauthorized" }, { status: 403 })]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised?.message).toMatch(/key/i);
		expect(raised?.message).not.toContain("User-Agent");
	});
});

describe("a rejected query under a success status", () => {
	/**
	 * GraphQL reports a rejected query at `200`, so a status-only reading would
	 * take the empty `data` for an empty result and write staging rows of
	 * nothing. The run has to fail instead — which at this layer means the
	 * query raises rather than resolving.
	 */
	// spec: snapshot-ingest/errors-under-a-success-status
	test("a 200 carrying a non-empty errors array fails the run [17]", async () => {
		const { fetch } = stub([
			json({ data: null, errors: [{ message: "Cannot query field bogus" }] }),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(raised?.message).toContain("Cannot query field bogus");
	});

	/**
	 * A body that does not parse is treated as an incomplete transfer and
	 * retried, not as a rejected query — a truncated response is exactly the
	 * transient the retry policy exists for. Pinned because the classification
	 * is a choice the requirement does not make, and reads as an oversight.
	 */
	// spec: snapshot-ingest/errors-under-a-success-status
	test("a 200 whose body is not JSON is retried, then fails [17]", async () => {
		const { fetch, calls } = stub([
			async () =>
				new Response("<html>gateway</html>", {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		]);
		const query = client(fetch);

		const raised = await raisedBy(query(Q));

		expect(raised).toBeInstanceOf(Error);
		expect(calls).toHaveLength(4);
	});

	// The boundary the rule turns on: `errors` present but empty is not a
	// failure, so a client testing the key's presence rather than the array's
	// length would fail here.
	// spec: snapshot-ingest/errors-under-a-success-status
	test("a 200 carrying an empty errors array is a success [17]", async () => {
		const { fetch } = stub([json({ data: { heroStats: {} }, errors: [] })]);
		const query = client(fetch);

		const body = await settle(query(Q));

		expect(body).toEqual({ data: { heroStats: {} }, errors: [] });
	});
});
