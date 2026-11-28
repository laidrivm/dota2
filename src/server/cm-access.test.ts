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
