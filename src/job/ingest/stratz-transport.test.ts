/**
 * The gate the client has to clear on every request, and the key it clears it
 * with — which must reach the wire and nothing else.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	spyOn,
	test,
} from "bun:test";
import {
	challenge,
	client,
	json,
	KEY,
	limited,
	ok,
	Q,
	type Reply,
	raisedBy,
	settle,
	stalls,
	stub,
} from "./stratz.fixture.ts";
import { createClient } from "./stratz.ts";

beforeEach(() => {
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
	// The console spies below are installed per test; left standing they would
	// swallow the runner's own output for every later file.
	jest.restoreAllMocks();
});

describe("the key the run reads", () => {
	// spec: snapshot-ingest/no-key-configured
	test("an unset variable fails the run before any request [1]", () => {
		const { fetch, calls } = stub([ok()]);

		expect(() => createClient({ env: {}, fetch })).toThrow(/STRATZ_API_KEY/);

		expect(calls).toHaveLength(0);
	});

	// An empty value is the shape an `.env` file with the name and no value
	// leaves, so it must not travel as `Bearer ` and be rejected on the wire.
	// spec: snapshot-ingest/no-key-configured
	test("an empty variable is unset rather than an empty Bearer [2]", () => {
		const { fetch, calls } = stub([ok()]);

		expect(() => createClient({ env: { STRATZ_API_KEY: "" }, fetch })).toThrow(
			/STRATZ_API_KEY/,
		);

		expect(calls).toHaveLength(0);
	});
});

describe("the two halves of the gate", () => {
	// spec: snapshot-ingest/both-headers-on-every-request
	test("a request carries both the key and the User-Agent [3]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await settle(query(Q));

		const headers = new Headers(calls[0]?.init.headers);
		expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
		expect(headers.get("user-agent")).toBe("STRATZ_API");
	});

	/**
	 * The headers above are asserted by their own test, and nothing else looked
	 * at what the client actually sends — so a client posting the wrong
	 * envelope, or dropping the variables, passed the whole suite.
	 */
	// spec: snapshot-ingest/both-headers-on-every-request
	test("the request posts the query and its variables as GraphQL [3]", async () => {
		const { fetch, calls } = stub([ok()]);
		const query = client(fetch);

		await settle(query(Q, { heroId: 45 }));

		const init = calls[0]?.init;
		expect(calls[0]?.url).toBe("https://api.stratz.com/graphql");
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("content-type")).toBe(
			"application/json",
		);
		expect(JSON.parse(String(init?.body))).toEqual({
			query: Q,
			variables: { heroId: 45 },
		});
	});
});

/**
 * Idea [10]: the key reaches the wire and nowhere else. The message and the
 * stack are asserted for every failure in `raisedBy`, so what is left here is
 * the console, which needs the per-test spies below — and the enumeration,
 * which is what says the seven paths all reach that assertion at all.
 */
describe("what carries the key", () => {
	const paths: [name: string, replies: Reply[]][] = [
		["a rejected request", [async () => new Response("no", { status: 400 })]],
		["an unmet challenge", [challenge()]],
		["a rejected key", [json({ error: "unauthorized" }, { status: 403 })]],
		["a query the API refused", [json({ errors: [{ message: "bad" }] })]],
		["an exhausted window", [limited({ "x-ratelimit-remaining-day": "0" })]],
		["four server failures", [async () => new Response("", { status: 500 })]],
		["four stalled attempts", [stalls()]],
	];

	test.each(paths)(
		"no failure carries the key: %s [10]",
		async (_, replies) => {
			const said: unknown[] = [];
			// Every callable member of `console` bar its constructor, rather than
			// an enumeration of levels: a key written through `debug`, `trace`,
			// `dir` or `table` passes a scan that names only four of them.
			const sink = console as unknown as Record<
				string,
				(...a: unknown[]) => void
			>;
			for (const name of Object.keys(console)) {
				if (name === "Console" || typeof sink[name] !== "function") continue;
				spyOn(sink, name).mockImplementation((...args: unknown[]) => {
					said.push(...args);
				});
			}
			const { fetch } = stub(replies);
			const query = client(fetch);

			const raised = await raisedBy(query(Q));

			expect(raised).toBeInstanceOf(Error);
			expect(said.map(String).join(" ")).not.toContain(KEY);
		},
	);
});
