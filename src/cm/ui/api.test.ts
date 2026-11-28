/**
 * The CM page's view of the API: every answer the sign-in and session routes
 * can give, mapped to what the page shows. The network is a stub that answers
 * one fixed response, so each case names the server state it stands for.
 */
import { describe, expect, test } from "bun:test";
import { readSession, signIn, signOut } from "./api.ts";

const problem = (status: number, code: string, headers = {}) =>
	new Response(JSON.stringify({ status, code }), {
		status,
		headers: { "content-type": "application/problem+json", ...headers },
	});

const answering =
	(response: Response | Error): typeof fetch =>
	async () => {
		if (response instanceof Error) throw response;
		return response;
	};

describe("reading the session", () => {
	test("a 200 is signed in, with its expiry", async () => {
		const ok = Response.json({
			signedIn: true,
			expiresAt: "2026-12-28T00:00:00.000Z",
		});
		expect(await readSession(answering(ok))).toEqual({
			kind: "signed-in",
			expiresAt: "2026-12-28T00:00:00.000Z",
		});
	});

	test("a 401 is signed out", async () => {
		const state = await readSession(answering(problem(401, "not-signed-in")));
		expect(state).toEqual({ kind: "signed-out" });
	});

	test("a 503 is not configured", async () => {
		const state = await readSession(
			answering(problem(503, "cm-not-configured")),
		);
		expect(state).toEqual({ kind: "not-configured" });
	});

	test.each([
		[
			"a static host's 404 page",
			new Response("<!doctype html>", { status: 404 }),
		],
		["a network failure", new TypeError("Failed to fetch")],
		["a 200 that is not the session shape", Response.json({ hello: 1 })],
	])("%s is unavailable", async (_, answer) => {
		expect(await readSession(answering(answer))).toEqual({
			kind: "unavailable",
		});
	});
});

describe("signing in", () => {
	test("a 204 is signed in", async () => {
		const result = await signIn(
			"correct horse battery",
			answering(new Response(null, { status: 204 })),
		);
		expect(result).toEqual({ kind: "signed-in" });
	});

	test("a wrong password says so", async () => {
		const result = await signIn(
			"nope",
			answering(problem(401, "wrong-password")),
		);
		expect(result).toEqual({ kind: "error", message: "Wrong password." });
	});

	test("a 429 names the seconds to wait", async () => {
		const result = await signIn(
			"nope",
			answering(problem(429, "too-many-attempts", { "retry-after": "125" })),
		);
		expect(result).toEqual({
			kind: "error",
			message: "Too many attempts. Try again in 125 seconds.",
		});
	});

	test("a 503 is not configured", async () => {
		const result = await signIn(
			"anything",
			answering(problem(503, "cm-not-configured")),
		);
		expect(result).toEqual({ kind: "not-configured" });
	});

	test("anything else is reported as unavailable, not thrown", async () => {
		const result = await signIn("x", answering(new TypeError("offline")));
		expect(result).toEqual({
			kind: "error",
			message: "The CM service is unavailable. Try again shortly.",
		});
	});
});

describe("signing out", () => {
	test.each([
		["a 204", new Response(null, { status: 204 })],
		["a 401 for a session already gone", problem(401, "not-signed-in")],
	])("%s leaves the page signed out", async (_, answer) => {
		expect(await signOut(answering(answer))).toEqual({ kind: "signed-out" });
	});
});
