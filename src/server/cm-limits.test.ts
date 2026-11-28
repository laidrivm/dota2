/**
 * The CM API's limits: the wrong-password budget, the origin check, and the
 * problem responses for paths and errors outside the routes.
 */
import { describe, expect, test } from "bun:test";
import { cmApi } from "./cm/api.ts";
import {
	api,
	cookieOf,
	PASSWORD,
	problem,
	readSession,
	signIn,
	T0,
} from "./cm-access.fixture.ts";

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
		const last = await signIn(app);
		expect(last.status).toBe(429);
		// One millisecond left still rounds up to a whole second, never 0.
		expect(last.headers.get("retry-after")).toBe("1");
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

	/**
	 * A wrong sign-in whose body arrives only when `release` is called, so
	 * the case controls when it passes the early budget check and when it
	 * reaches the password comparison.
	 */
	const heldWrongSignIn = (app: ReturnType<typeof cmApi>) => {
		let release = () => {};
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				release = () => {
					controller.enqueue(
						new TextEncoder().encode(
							JSON.stringify({ password: "wrong password!" }),
						),
					);
					controller.close();
				};
			},
		});
		const response = app.request("/api/cm/session", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
			// Node's fetch types require it for a stream body; Bun accepts it.
			duplex: "half",
		} as RequestInit);
		return { response, release: () => release() };
	};

	// spec: cm-access/repeated-wrong-passwords
	test("wrong passwords racing past the early check still stop at ten", async () => {
		const { app } = clocked();
		for (let i = 0; i < 9; i++) await signIn(app, "wrong password!");
		const first = heldWrongSignIn(app);
		const second = heldWrongSignIn(app);
		first.release();
		second.release();
		const statuses = [
			(await first.response).status,
			(await second.response).status,
		].sort();
		expect(statuses).toEqual([401, 429]);
		expect((await signIn(app)).status).toBe(429);
	});

	test("failures stay ordered by time when the clock steps back", async () => {
		const { clock, app } = clocked();
		clock.now = T0 + 10_000;
		await signIn(app, "wrong password!");
		clock.now = T0;
		for (let i = 0; i < 9; i++) await signIn(app, "wrong password!");
		// The nine at T0 have left the window; only the one at T0 + 10 s is in it.
		clock.now = T0 + 900_000;
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

	test.each([
		["an opaque `null` origin", "null"],
		["another port on the same host", "https://d2ass.example:8443"],
	])("%s is refused too", async (_, origin) => {
		expect((await fromOrigin(origin)).status).toBe(403);
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

	test("wrong passwords from another origin do not count toward the limit", async () => {
		const app = api();
		for (let i = 0; i < 12; i++) {
			const response = await app.request(
				"http://d2ass.example/api/cm/session",
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						origin: "https://evil.example",
					},
					body: JSON.stringify({ password: "wrong password!" }),
				},
			);
			expect(response.status).toBe(403);
		}
		expect((await signIn(app)).status).toBe(204);
	});

	test("an unknown path, signed out, is 401 before it is 404", async () => {
		const response = await api().request("/api/cm/nope");
		expect(response.status).toBe(401);
	});
});
