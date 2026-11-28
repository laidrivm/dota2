/** `/api/cm/report`: the draft report and chat behind the CM session. */
import { expect, test } from "bun:test";
import { cmApi } from "./cm/api.ts";
import type { Ask } from "./cm/report.ts";
import { cookieOf, PASSWORD, signIn, T0 } from "./cm-access.fixture.ts";

async function reporting(ask: Ask | null) {
	const app = cmApi({ password: PASSWORD, now: () => T0, ask });
	const cookie = cookieOf(await signIn(app));
	return (body: unknown, withCookie = true) =>
		app.request("/api/cm/report", {
			method: "POST",
			headers: withCookie ? { cookie } : {},
			body: JSON.stringify(body),
		});
}

const draft = { draft: "Мы — Radiant, первый пик.", messages: [] };

test("a report is the model's answer to the draft", async () => {
	const seen: unknown[] = [];
	const post = await reporting(async (request) => {
		seen.push(request);
		return "Отчёт";
	});
	const response = await post(draft);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ text: "Отчёт" });
	expect(seen).toEqual([draft]);
});

test("without an API key the report answers 503", async () => {
	const response = await (await reporting(null))(draft);
	expect(response.status).toBe(503);
	expect((await response.json()).code).toBe("report-not-configured");
});

test("a body that is no draft answers 422", async () => {
	const response = await (await reporting(async () => "x"))({ draft: "" });
	expect(response.status).toBe(422);
});

test("a model failure answers 502", async () => {
	const post = await reporting(async () => {
		throw new Error("overloaded");
	});
	expect((await post(draft)).status).toBe(502);
});

test("no session, no report", async () => {
	const post = await reporting(async () => "x");
	expect((await post(draft, false)).status).toBe(401);
});
