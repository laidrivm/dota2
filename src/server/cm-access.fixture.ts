/**
 * What the CM access suites share: the password, the clock, and the requests
 * and readers every case is built from.
 */
import { expect } from "bun:test";
import { cmApi } from "./cm/api.ts";

export const PASSWORD = "correct horse battery";
export const DAY = 86_400;
/** 2026-11-28T00:00:00Z, in milliseconds. */
export const T0 = Date.UTC(2026, 10, 28);

export const api = (password: string | undefined = PASSWORD, now = () => T0) =>
	cmApi({ password, now });

export const signIn = (app: ReturnType<typeof cmApi>, password = PASSWORD) =>
	app.request("/api/cm/session", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ password }),
	});

/** The `cm_session` value a sign-in set, without its attributes. */
export const cookieOf = (response: Response) =>
	(response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

export const readSession = (app: ReturnType<typeof cmApi>, cookie?: string) =>
	app.request("/api/cm/session", {
		headers: cookie === undefined ? {} : { cookie },
	});

export const PROBLEM_KEYS = [
	"action",
	"code",
	"detail",
	"status",
	"title",
	"type",
];

export async function problem(response: Response) {
	expect(response.headers.get("content-type")).toBe("application/problem+json");
	const body = (await response.json()) as Record<string, unknown>;
	expect(Object.keys(body).sort()).toEqual(PROBLEM_KEYS);
	expect(body.status).toBe(response.status);
	return body;
}
