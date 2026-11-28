/** The page's view of `/api/cm/meta`, over a stub that answers one response. */
import { expect, test } from "bun:test";
import type { Fetcher } from "./api.ts";
import { NO_META, readMeta, uploadMeta } from "./meta-api.ts";

const answering =
	(response: Response | Error): Fetcher =>
	async () => {
		if (response instanceof Error) throw response;
		return response;
	};

// spec: cm-meta-import/nothing-uploaded-yet
test("an empty store reads as five positions without meta", async () => {
	const empty = Response.json({ positions: NO_META });
	expect(await readMeta(answering(empty))).toEqual(NO_META);
});

test("a stored position reads as itself, the others empty", async () => {
	const pos3 = {
		patch: "7.41f",
		uploadedAt: "2026-11-28T00:00:00.000Z",
		heroes: {},
	};
	const one = Response.json({ positions: { ...NO_META, "3": pos3 } });
	expect(await readMeta(answering(one))).toEqual({ ...NO_META, "3": pos3 });
});

test.each([
	["a network failure", new TypeError("offline")],
	["a 401", new Response(null, { status: 401 })],
	["a body of another shape", Response.json({ nope: 1 })],
])("%s reads as no meta", async (_, answer) => {
	expect(await readMeta(answering(answer))).toEqual(NO_META);
});

test.each([
	[
		Response.json({ position: 3, heroes: 60, patch: "7.41f", uploadedAt: "x" }),
		"Stored pos 3: 60 heroes, patch 7.41f.",
	],
	[
		new Response(null, { status: 413 }),
		"That file is larger than 5 MB, so it is not a d2pt meta file.",
	],
	[
		new Response(null, { status: 422 }),
		"That file is not a d2pt meta file for one position.",
	],
	[
		new Response(null, { status: 401 }),
		"Your session has ended. Sign in again to upload.",
	],
	[new TypeError("offline"), "The upload failed. Try again shortly."],
])("an upload answered %p says so", async (answer, message) => {
	expect(await uploadMeta("{}", answering(answer))).toBe(message);
});
