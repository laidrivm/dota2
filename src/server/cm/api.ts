/**
 * The Captains Mode API under `/api/cm/`: signing in and reading the session.
 * The checks run in the order the cm-access spec fixes — configuration, then
 * session, then the route — so a closed API answers nothing else.
 */
import { Hono } from "hono";
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

export function cmApi({ password, now = Date.now }: CmOptions) {
	const usable =
		password !== undefined &&
		password.trim() !== "" &&
		password.length >= MIN_PASSWORD
			? password
			: null;

	const app = new Hono<{ Variables: { expiry: number } }>().basePath("/api/cm");

	if (usable === null) {
		app.all("*", () => problem("cm-not-configured"));
		return app;
	}

	app.post("/session", async (c) => {
		const parsed = SignIn.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) return problem("invalid-body");
		if (!passwordMatches(parsed.data.password, usable))
			return problem("wrong-password");
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
