/**
 * The Captains Mode API under `/api/cm/`: signing in and reading the session.
 * The checks run in the order the cm-access spec fixes — origin, then
 * configuration, then session, then the route — so a closed API answers
 * nothing else.
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { problem } from "./problem.ts";
import {
	COOKIE,
	LIFETIME_SECONDS,
	mint,
	passwordMatches,
	verify,
} from "./session.ts";

export interface CmOptions {
	/** `CM_PASSWORD` as the deployment set it, unset included. */
	password: string | undefined;
	/** Milliseconds since the epoch; injected so a test owns the clock. */
	now?: () => number;
}

const SignIn = z.object({ password: z.string() });

const Session = z.object({
	signedIn: z.literal(true),
	expiresAt: z.iso.datetime({ offset: true }),
});

/** Shorter than this, or whitespace alone, counts as no password at all. */
const MIN_PASSWORD = 12;

/** Ten wrong passwords within fifteen minutes close sign-in (cm-access). */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60_000;

/** Whether `origin` names the host `url` was requested on; a malformed one does not. */
function sameHost(origin: string, url: string) {
	try {
		return new URL(origin).host === new URL(url).host;
	} catch {
		return false;
	}
}

export function cmApi({ password, now = Date.now }: CmOptions) {
	const usable =
		password !== undefined &&
		password.trim() !== "" &&
		password.length >= MIN_PASSWORD
			? password
			: null;

	const app = new Hono<{ Variables: { expiry: number } }>().basePath("/api/cm");

	// Hono's defaults are plain text; the contract is problem details throughout.
	app.notFound(() => problem("not-found"));
	app.onError((error) => {
		console.error("cm api:", error);
		return problem("internal");
	});

	// Nothing this API answers may be stored by a shared cache: every response
	// is either about a session or sets one.
	app.use("*", async (c, next) => {
		await next();
		c.res.headers.set("cache-control", "no-store");
	});

	// Before any other check, so a closed API and the wrong-password budget are
	// both out of a foreign page's reach. The host behind the proxy is the one
	// the browser asked for, since the proxy forwards `Host`.
	app.use("*", async (c, next) => {
		const origin = c.req.header("origin");
		if (origin !== undefined && !sameHost(origin, c.req.url))
			return problem("cross-origin");
		await next();
	});

	if (usable === null) {
		app.all("*", () => problem("cm-not-configured"));
		return app;
	}

	// Shared by every caller (design D2): a caller's address behind the proxy
	// cannot be trusted, so the budget bounds guessing by anyone at the cost of
	// letting a stranger delay new sign-ins.
	const failures: number[] = [];
	const lockedFor = (at: number) => {
		while (failures.length > 0 && at - (failures[0] ?? at) >= WINDOW_MS)
			failures.shift();
		if (failures.length < MAX_FAILURES) return 0;
		return Math.ceil(((failures[0] ?? at) + WINDOW_MS - at) / 1000);
	};

	// The one route open to anyone, so the one whose body is bounded before it
	// is read: Bun's own cap is 128 MB.
	const signInLimit = bodyLimit({
		maxSize: 1024,
		onError: () => problem("too-large"),
	});

	app.post("/session", signInLimit, async (c) => {
		const at = now();
		const wait = lockedFor(at);
		if (wait > 0) {
			const response = problem("too-many-attempts");
			response.headers.set("retry-after", String(wait));
			return response;
		}
		const parsed = SignIn.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) return problem("invalid-body");
		if (!passwordMatches(parsed.data.password, usable)) {
			failures.push(at);
			return problem("wrong-password");
		}
		setCookie(c, COOKIE, mint(usable, now()).value, {
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			path: "/api/cm",
			maxAge: LIFETIME_SECONDS,
		});
		return c.body(null, 204);
	});

	// Every route registered below this line needs a session.
	app.use("*", async (c, next) => {
		const expiry = verify(getCookie(c, COOKIE), usable, now());
		if (expiry === null) return problem("not-signed-in");
		c.set("expiry", expiry);
		await next();
	});

	app.get("/session", (c) =>
		c.json(
			Session.parse({
				signedIn: true,
				expiresAt: new Date(c.get("expiry") * 1000).toISOString(),
			}),
		),
	);

	return app;
}
