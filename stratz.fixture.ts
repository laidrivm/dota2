/**
 * What the client's tests drive it with: a `fetch` that answers from a script
 * instead of a network, and a way to run the client forward over `bun:test`'s
 * fake timers.
 *
 * No suite here calls the live API. A test that did would be a test of someone
 * else's availability, and would need a key to run at all — the one thing a
 * public repository's CI cannot be given. The shapes below are taken from the
 * responses recorded in `docs/context/stratz-probe-2026-08.md`.
 */
import { expect, jest } from "bun:test";
import { createClient } from "./stratz.ts";

/** A key with the shape of one and none of the value. */
export const KEY = "test-key-not-a-real-token";

/** The smallest query that stands in for any of the pulls. */
export const Q = "{ heroStats { __typename } }";

/** A client bound to `KEY` and to a stubbed transport. */
export const client = (fetch: typeof globalThis.fetch) =>
	createClient({ env: { STRATZ_API_KEY: KEY }, fetch });

/** One request the stub was asked to make, and when. */
export type Call = { url: string; init: RequestInit; at: number };

/** How the stub answers one call. */
export type Reply = (init: RequestInit) => Promise<Response>;

/**
 * A `fetch` answering `replies` in order, the last one repeating for every
 * later call — so a test asserting four identical failures scripts one.
 */
export function stub(replies: Reply[]): {
	fetch: typeof globalThis.fetch;
	calls: Call[];
} {
	const calls: Call[] = [];
	const fetch = ((url: string | URL | Request, init: RequestInit = {}) => {
		calls.push({ url: String(url), init, at: Date.now() });
		const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
		if (reply === undefined) throw new Error("the stub was scripted no reply");
		return reply(init);
	}) as unknown as typeof globalThis.fetch;
	return { fetch, calls };
}

/** A JSON reply, `200` unless another status is asked for. */
export const json =
	(
		body: unknown,
		init: { status?: number; headers?: Record<string, string> } = {},
	): Reply =>
	async () =>
		new Response(JSON.stringify(body), {
			status: init.status ?? 200,
			headers: { "content-type": "application/json", ...init.headers },
		});

/** A GraphQL success carrying an empty envelope. */
export const ok = (data: unknown = { heroStats: {} }): Reply => json({ data });

/**
 * Cloudflare's interstitial: the shape a request that omits the `User-Agent`
 * is answered with, whether or not it carried a key.
 */
export const challenge = (): Reply => async () =>
	new Response("<html><body>Just a moment…</body></html>", {
		status: 403,
		headers: { "content-type": "text/html; charset=UTF-8" },
	});

/** A JSON reply carrying rate-limit headers, `200` unless told otherwise. */
export const limited = (headers: Record<string, string>, status = 200): Reply =>
	json({ data: {} }, { status, headers });

/**
 * An attempt that never completes, failing only when its own timeout aborts
 * it — which is what a stalled connection looks like from the client's side.
 */
export const stalls = (): Reply => (init) =>
	new Promise<Response>((_, reject) => {
		init.signal?.addEventListener("abort", () =>
			reject(new Error("the attempt was aborted")),
		);
	});

/**
 * An attempt whose headers arrive but whose body never finishes streaming.
 * A status alone is not a complete response, so this is the other half of the
 * stall `stalls` covers — and the one a client that stopped its clock at the
 * headers would sit on for ever.
 */
export const stallsMidBody = (): Reply => async (init) =>
	new Response(
		new ReadableStream({
			start(controller) {
				init.signal?.addEventListener("abort", () =>
					controller.error(new Error("the body was abandoned")),
				);
			},
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);

/**
 * The error `work` raised, or `undefined` where it did not — so a test that is
 * about a failure asserts on the failure rather than on a rejection landing.
 *
 * The key is asserted absent here rather than in the one test that names it:
 * every failure the client raises passes through this helper, so a path added
 * later is covered without anyone remembering to cover it.
 */
export const raisedBy = (work: Promise<unknown>) =>
	settle(work).then(
		() => undefined,
		(error: Error) => {
			expect(error.message).not.toContain(KEY);
			expect(error.stack ?? "").not.toContain(KEY);
			return error;
		},
	);

/** Let every already-resolved continuation run. */
const turns = async () => {
	for (let i = 0; i < 64; i++) await Promise.resolve();
};

/**
 * Run `work` to its end over fake timers, firing each pending timer in turn.
 *
 * `bun:test` has no async timer advance — `advanceTimersByTimeAsync` is absent
 * in Bun 1.3, so the sync advance has to be paired with a microtask drain by
 * hand, and the loop is what stands in for it.
 *
 * Running out of timers with the work still pending raises rather than
 * returning. Fake timers replace the clock `bun:test` runs its own per-test
 * timeout on, so nothing else would ever cut the wait short: returning a
 * promise that can no longer settle hangs the whole run instead of failing
 * one test, which in CI is a stuck job rather than a red one.
 */
export async function settle<T>(work: Promise<T>): Promise<T> {
	let pending = true;
	const watched = work.finally(() => {
		pending = false;
	});
	watched.catch(() => {});
	for (;;) {
		await turns();
		if (!pending) break;
		if (jest.getTimerCount() === 0)
			throw new Error(
				"the work is waiting on something that is not a timer, so it can no longer settle",
			);
		jest.advanceTimersToNextTimer();
	}
	return watched;
}
