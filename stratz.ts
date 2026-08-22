/**
 * The STRATZ GraphQL client: the two headers the Cloudflare gate wants, pacing
 * under the published per-second ceiling, bounded retries, and a failure path
 * that tells an unmet challenge apart from a rejected key.
 *
 * Time is read from `Date.now()` and waited on with `setTimeout` rather than
 * through an injected clock: the tests drive both with `bun:test`'s fake
 * timers, so the production path carries no seam it does not need. Only
 * `fetch` is injectable, because a stub is the only way to exercise a
 * transport without a network.
 */

/** Where the statistics API answers. */
const ENDPOINT = "https://api.stratz.com/graphql";

/**
 * The value that clears the Cloudflare challenge. The key alone does not: a
 * request carrying the token and omitting this header is answered `403` with
 * Cloudflare's HTML interstitial, exactly as a keyless one is
 * (`docs/context/stratz-probe-2026-08.md`).
 */
const USER_AGENT = "STRATZ_API";

/** Requests the API admits per second — its own published ceiling. */
const PER_SECOND = 8;

/** The span that ceiling is counted over. */
const WINDOW_MS = 1000;

/** Attempts one request gets in total, the first included. */
const ATTEMPTS = 4;

/** The wait before the first retry; each later one doubles it. */
const FIRST_BACKOFF_MS = 1000;

/**
 * How long one attempt may stay open, the body's arrival included. `fetch`
 * waits indefinitely by default, and a run that suspends never reaches the
 * single outcome the job promises. Thirty seconds sits far above the largest
 * response the probe measured (17 KB) rather than being derived from a
 * latency: it bounds a stall, and is not a performance budget.
 */
const ATTEMPT_TIMEOUT_MS = 30_000;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What one attempt came to. */
type Attempt =
	| { kind: "body"; body: unknown }
	/** Retrying cannot help; the run ends here. */
	| { kind: "fatal"; message: string }
	/** The service might yet accept this request. */
	/** Terminal for the whole run, not merely for this request. */
	| { kind: "quota"; message: string }
	| { kind: "retry"; message: string };

const fatal = (message: string): Attempt => ({ kind: "fatal", message });
const quota = (message: string): Attempt => ({ kind: "quota", message });
const retry = (message: string): Attempt => ({ kind: "retry", message });

/**
 * Whether a response reports a rate-limit window with nothing left in it.
 *
 * The remainder headers are matched by shape rather than enumerated. The probe
 * recorded the four `x-ratelimit-limit-*` ceilings and noted that remainders
 * ride alongside them, but not the remainder headers' own names — so an
 * enumeration here would be four guesses, and would miss a fifth window the
 * service added.
 *
 * A blank value is excluded because `Number("")` is 0, which would end a
 * healthy run on an empty header. An unparseable one needs no exclusion of its
 * own: it yields `NaN`, and every comparison against `NaN` is false.
 */
function exhausted(headers: Headers): boolean {
	for (const [name, value] of headers) {
		if (!/^x-ratelimit-remaining-/i.test(name)) continue;
		if (value.trim() !== "" && Number(value) <= 0) return true;
	}
	return false;
}

/**
 * Hold the caller until fewer than `PER_SECOND` requests sit inside the last
 * window, then record this one. `issued` holds the timestamps still inside
 * that window, oldest first, and so never grows past `PER_SECOND`.
 *
 * The path that does not wait reaches the `push` without an `await`, which is
 * what makes this correct for concurrent callers with no lock: a caller that
 * finds room claims it in the same microtask turn it checked in, so two
 * callers cannot both read the same free slot.
 */
async function reserve(issued: number[]): Promise<void> {
	for (;;) {
		const now = Date.now();
		while (issued.length > 0 && now - (issued[0] as number) >= WINDOW_MS)
			issued.shift();
		if (issued.length < PER_SECOND) break;
		await sleep(WINDOW_MS - (now - (issued[0] as number)));
	}
	issued.push(Date.now());
}

/** What a `403` means, which its status alone does not say. */
function forbidden(headers: Headers): Attempt {
	// The gate answers a request missing the header with the same status as one
	// carrying a bad token, so the content type is the only thing that tells
	// them apart.
	const type = headers.get("content-type") ?? "";
	return fatal(
		type.includes("json")
			? "the API rejected the key"
			: "the Cloudflare challenge was not met: the request needs the User-Agent header",
	);
}

/** One attempt at one request, bounded by `ATTEMPT_TIMEOUT_MS`. */
async function attempt(
	doFetch: typeof globalThis.fetch,
	key: string,
	body: string,
): Promise<Attempt> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
	try {
		const response = await doFetch(ENDPOINT, {
			method: "POST",
			headers: {
				authorization: `Bearer ${key}`,
				"user-agent": USER_AGENT,
				"content-type": "application/json",
			},
			body,
			signal: controller.signal,
		});

		// Ahead of every other reading of this response: a window with nothing
		// left is terminal even where the status is a success, and even where it
		// is the `429` the retry policy would otherwise take.
		if (exhausted(response.headers))
			return quota(
				"the API reports no quota remaining in one of its rate-limit windows",
			);

		if (response.status === 403) return forbidden(response.headers);
		if (response.status === 429 || response.status >= 500)
			return retry(`the API answered ${response.status}`);
		if (response.status >= 400)
			return fatal(`the API answered ${response.status}`);

		// Read inside the timeout, not after it: an attempt is bounded by the
		// arrival of a complete response, and a body that never finishes
		// streaming is the stall this bound exists for.
		const parsed = await response.json();
		const errors = (parsed as { errors?: unknown }).errors;
		if (Array.isArray(errors) && errors.length > 0)
			return fatal(`the API answered with errors: ${JSON.stringify(errors)}`);
		return { kind: "body", body: parsed };
	} catch {
		// The cause is deliberately dropped rather than chained. Nothing may
		// carry the key out of this module, and a chained cause is one more
		// message to have to prove clean.
		return retry(
			controller.signal.aborted
				? `the attempt was abandoned after ${ATTEMPT_TIMEOUT_MS} ms with no complete response`
				: "the request did not complete",
		);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Issues one GraphQL query and resolves to the parsed response body — the
 * whole envelope rather than its `data` member, so a caller reads the shape
 * the API documents.
 */
export type Query = (
	query: string,
	variables?: Record<string, unknown>,
) => Promise<unknown>;

/**
 * A client bound to one key, read once here so that a run missing it fails
 * before its first request rather than at whichever pull ran first.
 */
export function createClient(
	deps: {
		fetch?: typeof globalThis.fetch;
		env?: Record<string, string | undefined>;
	} = {},
): Query {
	const env = deps.env ?? Bun.env;
	const doFetch = deps.fetch ?? globalThis.fetch;
	const key = (env.STRATZ_API_KEY ?? "").trim();
	if (key === "")
		throw new Error("STRATZ_API_KEY is unset or empty; no request was issued");

	/**
	 * Timestamps of the requests still inside the last window, oldest first.
	 *
	 * Held per client, and a run is expected to build exactly one. The ceiling
	 * belongs to the key rather than to the object, so two clients over one key
	 * would pace to eight each and issue sixteen — a precondition this module
	 * does not check, because the alternative is module-level state that leaks
	 * between tests.
	 */
	const issued: number[] = [];

	/**
	 * Why the run stopped, once a window has reported nothing left. The verdict
	 * is terminal for the run rather than for the request that met it, and the
	 * client is the only thing that sees every request — so a later pull is
	 * refused here, before it reaches the network.
	 */
	let spent = "";

	return async function query(document, variables) {
		if (spent !== "") throw new Error(spent);
		const body = JSON.stringify({ query: document, variables });
		let last = "";
		for (let n = 1; n <= ATTEMPTS; n++) {
			await reserve(issued);
			const outcome = await attempt(doFetch, key, body);
			if (outcome.kind === "body") return outcome.body;
			if (outcome.kind === "quota") {
				spent = outcome.message;
				throw new Error(outcome.message);
			}
			if (outcome.kind === "fatal") throw new Error(outcome.message);
			last = outcome.message;
			if (n < ATTEMPTS) await sleep(FIRST_BACKOFF_MS * 2 ** (n - 1));
		}
		throw new Error(`${last}; ${ATTEMPTS} attempts made`);
	};
}
