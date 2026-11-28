/**
 * The CM API's password and session: signing in, what a request without a
 * valid session gets, and the API closed while no usable password is set.
 * The app is exercised through `request`, with the clock injected, so no
 * server is started and no case waits on real time.
 */
import { describe, expect, test } from "bun:test";
import { cmApi } from "./cm/api.ts";

const PASSWORD = "correct horse battery";
const DAY = 86_400;
/** 2026-11-28T00:00:00Z, in milliseconds. */
const T0 = Date.UTC(2026, 10, 28);

const api = (password: string | undefined = PASSWORD, now = () => T0) =>
	cmApi({ password, now });

const signIn = (app: ReturnType<typeof cmApi>, password = PASSWORD) =>
	app.request("/api/cm/session", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ password }),
	});

/** The `cm_session` value a sign-in set, without its attributes. */
const cookieOf = (response: Response) =>
	(response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

const readSession = (app: ReturnType<typeof cmApi>, cookie?: string) =>
	app.request("/api/cm/session", {
		headers: cookie === undefined ? {} : { cookie },
	});

const PROBLEM_KEYS = ["action", "code", "detail", "status", "title", "type"];

async function problem(response: Response) {
	expect(response.headers.get("content-type")).toBe("application/problem+json");
	const body = (await response.json()) as Record<string, unknown>;
	expect(Object.keys(body).sort()).toEqual(PROBLEM_KEYS);
	expect(body.status).toBe(response.status);
	return body;
}

describe("signing in", () => {
	// spec: cm-access/signing-in-with-the-password
	test("the password answers 204 with the session cookie's five attributes", async () => {
		const response = await signIn(api());
		expect(response.status).toBe(204);
		const cookie = response.headers.get("set-cookie") ?? "";
		const [pair, ...attributes] = cookie.split(";").map((part) => part.trim());
		expect(pair).toMatch(/^cm_session=\d+\.[A-Za-z0-9_-]+$/);
		expect(attributes.sort()).toEqual(
			[
				"HttpOnly",
				"Max-Age=2592000",
				"Path=/api/cm",
				"SameSite=Strict",
				"Secure",
			].sort(),
		);
	});

	// spec: cm-access/signing-in-with-the-password
	test("the session reads back as signed in until 30 days on", async () => {
		const app = api();
		const cookie = cookieOf(await signIn(app));
		const response = await readSession(app, cookie);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			signedIn: true,
			expiresAt: new Date(T0 + 30 * DAY * 1000).toISOString(),
		});
	});

	test("a body that is not JSON is 422, not a server error", async () => {
		const response = await api().request("/api/cm/session", {
			method: "POST",
			body: "password=correct",
		});
		expect(response.status).toBe(422);
		expect((await problem(response)).code).toBe("invalid-body");
	});

	test.each([
		["without a password", { secret: PASSWORD }],
		["with a numeric password", { password: 123456789012 }],
		["of null", null],
	])("a JSON body %s is 422", async (_, body) => {
		const response = await api().request("/api/cm/session", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		expect(response.status).toBe(422);
		expect((await problem(response)).code).toBe("invalid-body");
	});

	test("a sign-in body over 1 KB is refused before it is parsed", async () => {
		const response = await api().request("/api/cm/session", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ password: "x".repeat(1024) }),
		});
		expect(response.status).toBe(413);
		expect((await problem(response)).code).toBe("too-large");
	});

	test.each([
		["a sign-in", (app: ReturnType<typeof cmApi>) => signIn(app)],
		["a session read", (app: ReturnType<typeof cmApi>) => readSession(app)],
		[
			"a closed API",
			() => readSession(cmApi({ password: undefined, now: () => T0 })),
		],
	])("%s is never cached", async (_, send) => {
		const response = await send(api());
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	test("a wrong password signs nobody in", async () => {
		const response = await signIn(api(), "correct horse batterY");
		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toBeNull();
		const body = await problem(response);
		expect(body.code).toBe("wrong-password");
	});
});

describe("a request without a valid session", () => {
	/** A validly signed cookie for the given expiry, taken from a real sign-in. */
	async function cookieExpiringAt(expirySeconds: number) {
		const signedAt = expirySeconds * 1000 - 30 * DAY * 1000;
		return cookieOf(await signIn(api(PASSWORD, () => signedAt)));
	}

	// spec: cm-access/a-request-without-a-valid-session
	test.each([
		["no cookie", undefined],
		["an empty cookie", "cm_session="],
		["a non-numeric expiry", "cm_session=soon.abcd"],
		["no signature", "cm_session=1795000000"],
	])("%s is 401 not-signed-in", async (_, cookie) => {
		const response = await readSession(api(), cookie);
		expect(response.status).toBe(401);
		const body = await problem(response);
		expect(body.code).toBe("not-signed-in");
		expect(body.action).toContain("/cm");
	});

	// spec: cm-access/a-request-without-a-valid-session
	test("a signature with one character changed is refused", async () => {
		const app = api();
		const cookie = cookieOf(await signIn(app));
		const last = cookie.at(-1) === "A" ? "B" : "A";
		const response = await readSession(app, cookie.slice(0, -1) + last);
		expect(response.status).toBe(401);
	});

	// spec: cm-access/a-request-without-a-valid-session
	test("a cookie expired a second ago is refused, one with a second left is not", async () => {
		const now = Math.floor(T0 / 1000);
		const expired = await cookieExpiringAt(now - 1);
		const live = await cookieExpiringAt(now + 1);
		expect((await readSession(api(), expired)).status).toBe(401);
		expect((await readSession(api(), live)).status).toBe(200);
	});

	// spec: cm-access/a-request-without-a-valid-session
	test("a changed password ends the session it signed", async () => {
		const cookie = cookieOf(await signIn(api()));
		const rotated = api("a different password entirely");
		const response = await readSession(rotated, cookie);
		expect(response.status).toBe(401);
		expect((await problem(response)).code).toBe("not-signed-in");
	});
});

describe("errors outside the routes", () => {
	test("an unknown path, signed in, is a 404 problem", async () => {
		const app = api();
		const cookie = cookieOf(await signIn(app));
		const response = await app.request("/api/cm/nope", { headers: { cookie } });
		expect(response.status).toBe(404);
		expect((await problem(response)).code).toBe("not-found");
	});

	test("a handler that throws is a 500 problem, not plain text", async () => {
		const app = api();
		app.get("/boom", () => {
			throw new Error("boom");
		});
		const cookie = cookieOf(await signIn(app));
		const logged = console.error;
		console.error = () => {};
		try {
			const response = await app.request("/api/cm/boom", {
				headers: { cookie },
			});
			expect(response.status).toBe(500);
			expect((await problem(response)).code).toBe("internal");
		} finally {
			console.error = logged;
		}
	});
});

describe("no usable password configured", () => {
	// spec: cm-access/no-password-configured
	test.each([
		["absent", undefined],
		["empty", ""],
		["11 characters", "abcdefghijk"],
		["12 spaces", " ".repeat(12)],
	])("%s closes sign-in and the session read alike", async (_, password) => {
		// Not `api(password)`: its default would stand in for an absent one.
		const app = cmApi({ password, now: () => T0 });
		for (const response of [
			await signIn(app, "anything"),
			await readSession(app),
		]) {
			expect(response.status).toBe(503);
			const body = await problem(response);
			expect(body.code).toBe("cm-not-configured");
			expect(body.action).toContain("CM_PASSWORD");
		}
	});

	// spec: cm-access/no-password-configured
	test("12 characters configures it", async () => {
		const response = await signIn(api("abcdefghijkl"), "abcdefghijkl");
		expect(response.status).toBe(204);
	});
});

describe("wrong passwords are limited", () => {
	/** An app on a clock the case moves by hand, in milliseconds. */
	const clocked = () => {
		const clock = { now: T0 };
		return { clock, app: cmApi({ password: PASSWORD, now: () => clock.now }) };
	};

	// spec: cm-access/repeated-wrong-passwords
	test("the eleventh attempt within 15 minutes is 429, the right password included", async () => {
		const { clock, app } = clocked();
		for (let i = 0; i < 10; i++) {
			const response = await signIn(app, "wrong password!");
			expect(response.status).toBe(401);
			clock.now += 60_000;
		}
		const response = await signIn(app);
		expect(response.status).toBe(429);
		expect((await problem(response)).code).toBe("too-many-attempts");
		const retry = Number(response.headers.get("retry-after"));
		expect(retry).toBeGreaterThanOrEqual(1);
		expect(retry).toBeLessThanOrEqual(900);
		// The oldest failure was ten minutes ago, so five minutes remain.
		expect(retry).toBe(300);
	});

	// spec: cm-access/repeated-wrong-passwords
	test("a failure exactly 900 s old no longer counts", async () => {
		const { clock, app } = clocked();
		for (let i = 0; i < 10; i++) await signIn(app, "wrong password!");
		clock.now += 899_999;
		expect((await signIn(app)).status).toBe(429);
		clock.now += 1;
		expect((await signIn(app)).status).toBe(204);
	});

	// spec: cm-access/repeated-wrong-passwords
	test("a session signed in before the ten stays signed in", async () => {
		const { app } = clocked();
		const cookie = cookieOf(await signIn(app));
		for (let i = 0; i < 10; i++) await signIn(app, "wrong password!");
		expect((await readSession(app, cookie)).status).toBe(200);
	});

	test("a 429 does not extend the lockout", async () => {
		const { clock, app } = clocked();
		for (let i = 0; i < 10; i++) await signIn(app, "wrong password!");
		clock.now += 600_000;
		for (let i = 0; i < 5; i++) await signIn(app, "wrong password!");
		clock.now += 300_000;
		expect((await signIn(app)).status).toBe(204);
	});
});

describe("the API serves its own origin only", () => {
	const fromOrigin = (origin: string | null, app = api()) =>
		app.request("http://d2ass.example/api/cm/session", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(origin === null ? {} : { origin }),
			},
			body: JSON.stringify({ password: PASSWORD }),
		});

	// spec: cm-access/a-request-from-another-origin
	test("another origin is 403 and sets no cookie", async () => {
		const response = await fromOrigin("https://evil.example");
		expect(response.status).toBe(403);
		expect(response.headers.get("set-cookie")).toBeNull();
		expect((await problem(response)).code).toBe("cross-origin");
	});

	// spec: cm-access/a-request-from-another-origin
	test.each([
		["the deployment's own origin", "https://d2ass.example"],
		["no Origin header", null],
	])("%s passes, and no response allows other origins", async (_, origin) => {
		const response = await fromOrigin(origin);
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
	});

	// spec: cm-access/a-request-from-another-origin
	test("the origin check runs before the closed-API check", async () => {
		const closed = cmApi({ password: undefined, now: () => T0 });
		expect((await fromOrigin("https://evil.example", closed)).status).toBe(403);
	});

	test("refused origins do not count toward the wrong-password limit", async () => {
		const app = api();
		for (let i = 0; i < 12; i++) await fromOrigin("https://evil.example", app);
		expect((await signIn(app)).status).toBe(204);
	});

	test("an unknown path, signed out, is 401 before it is 404", async () => {
		const response = await api().request("/api/cm/nope");
		expect(response.status).toBe(401);
	});
});
