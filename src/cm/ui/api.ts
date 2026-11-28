/**
 * The CM page's calls to `/api/cm/`, each answer mapped to what the page
 * shows. Nothing here throws: a static host, a dropped connection and an
 * unexpected body all land on a state the page can render.
 */

export type SessionState =
	| { kind: "signed-in"; expiresAt: string }
	| { kind: "signed-out" }
	| { kind: "not-configured" }
	| { kind: "unavailable" };

export type SignInResult =
	| { kind: "signed-in" }
	| { kind: "not-configured" }
	| { kind: "error"; message: string };

/** The slice of `fetch` the calls use, so a test can stand in for it. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const SESSION = "/api/cm/session";
const UNAVAILABLE = "The CM service is unavailable. Try again shortly.";

/** How long a request may hang before the page gives up on it. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** The response, or `null` when the request never got one or took too long. */
async function call(fetcher: Fetcher, init?: RequestInit) {
	try {
		return await fetcher(SESSION, {
			credentials: "same-origin",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			...init,
		});
	} catch {
		return null;
	}
}

export async function readSession(
	fetcher: Fetcher = fetch,
): Promise<SessionState> {
	const response = await call(fetcher);
	if (response?.status === 401) return { kind: "signed-out" };
	if (response?.status === 503) return { kind: "not-configured" };
	if (response?.status === 200) {
		const body = await response.json().catch(() => null);
		if (body?.signedIn === true && typeof body.expiresAt === "string")
			return { kind: "signed-in", expiresAt: body.expiresAt };
	}
	// A static host answers its own 404 page, which is this same case.
	return { kind: "unavailable" };
}

export async function signIn(
	password: string,
	fetcher: Fetcher = fetch,
): Promise<SignInResult> {
	const response = await call(fetcher, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ password }),
	});
	switch (response?.status) {
		case 204:
			return { kind: "signed-in" };
		case 401:
			return { kind: "error", message: "Wrong password." };
		case 429: {
			const wait = response.headers.get("retry-after") ?? "a few";
			return {
				kind: "error",
				message: `Too many attempts. Try again in ${wait} seconds.`,
			};
		}
		case 422:
			return { kind: "error", message: "Enter the password." };
		case 503:
			return { kind: "not-configured" };
		default:
			return { kind: "error", message: UNAVAILABLE };
	}
}

/**
 * Signed out only once the server confirms it: a 204, or a 401 for a session
 * already gone. Anything else leaves the cookie where it was, so the page must
 * not show the sign-in form over a session a reload would restore.
 */
export async function signOut(
	fetcher: Fetcher = fetch,
): Promise<{ kind: "signed-out" } | { kind: "error"; message: string }> {
	const response = await call(fetcher, { method: "DELETE" });
	if (response?.status === 204 || response?.status === 401)
		return { kind: "signed-out" };
	return { kind: "error", message: "Signing out failed. Try again." };
}
