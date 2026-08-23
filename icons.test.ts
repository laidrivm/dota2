/**
 * The mirror: what it fetches, what it refuses to fetch again, and what a
 * reader sees while a file is being written.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { iconPath, mirrorIcons } from "./icons.ts";

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A mirror directory of its own, removed when the file finishes. */
const emptyDir = () => {
	const dir = mkdtempSync(join(tmpdir(), "d2ass-icons-"));
	made.push(dir);
	return dir;
};

/** Bytes standing in for an image; nothing here reads their format. */
const IMAGE = new Uint8Array(1024).fill(7);

const CLINKZ = { shortName: "clinkz", imageUrl: "https://cdn.example/c.png" };
const LINA = { shortName: "lina", imageUrl: "https://cdn.example/l.png" };

/** A `fetch` answering every call with `IMAGE`, and the calls it was asked. */
function serving(reply?: () => Promise<Response>) {
	const calls: string[] = [];
	const fetch = (async (url: string | URL) => {
		calls.push(String(url));
		return reply ? await reply() : new Response(IMAGE);
	}) as unknown as typeof globalThis.fetch;
	return { fetch, calls };
}

/** The names the directory holds, temporary ones included. */
const held = (dir: string) => readdirSync(dir).sort();

// spec: hero-reference/the-first-run
test("a first run leaves a file for every hero [44]", async () => {
	const dir = emptyDir();
	const { fetch, calls } = serving();

	await mirrorIcons([CLINKZ, LINA], dir, fetch);

	expect(held(dir)).toEqual(["clinkz.png", "lina.png"]);
	expect(calls).toEqual([CLINKZ.imageUrl, LINA.imageUrl]);
});

// spec: hero-reference/the-first-run
test("what a hero carries is a path on this origin, not a URL [47]", () => {
	// The column is what `app-shell` reaches: a bundle carrying the source's
	// URL would be a third-party request the running client is forbidden.
	expect(iconPath("clinkz")).toBe("/icons/clinkz.png");
	expect(iconPath("clinkz")).toStartWith("/");
});

// spec: hero-reference/a-file-already-mirrored
test("a run with every file present issues no request [46]", async () => {
	const dir = emptyDir();
	await mirrorIcons([CLINKZ, LINA], dir, serving().fetch);
	const { fetch, calls } = serving();

	await mirrorIcons([CLINKZ, LINA], dir, fetch);

	expect(calls).toEqual([]);
});

// spec: hero-reference/a-file-already-mirrored
test("a hero already mirrored survives a refetch that would fail [54]", async () => {
	const dir = emptyDir();
	await mirrorIcons([CLINKZ], dir, serving().fetch);
	const refused = serving(async () => new Response("gone", { status: 404 }));

	await mirrorIcons([CLINKZ], dir, refused.fetch);

	expect(held(dir)).toEqual(["clinkz.png"]);
	expect(refused.calls).toEqual([]);
});

test("a run carrying no hero issues no request and does not fail", () => {
	// The reference is mirrored from a response, and a response carrying no
	// hero is the caller's failure to raise, not this module's to guess at.
	const dir = emptyDir();
	const { fetch, calls } = serving();

	const run = mirrorIcons([], dir, fetch);

	expect(run).resolves.toBeUndefined();
	expect(calls).toEqual([]);
});

// spec: hero-reference/the-first-run
test.each(["../escaped", "sub/hero", "", "clinkz.png"])(
	"a hero named %p is refused before anything is written",
	async (shortName) => {
		// `icon` is a path this application serves, so what the mirror will
		// write under is a slug and nothing else — a name that climbs, nests or
		// carries its own extension is the source's error, not a file to make.
		const dir = emptyDir();
		const { fetch, calls } = serving();

		const failed = await mirrorIcons(
			[{ shortName, imageUrl: CLINKZ.imageUrl }],
			dir,
			fetch,
		).then(
			() => null,
			(error: Error) => error.message,
		);

		expect(failed).toMatch(/not a name this mirror will write/);
		expect(held(dir)).toEqual([]);
		expect(calls).toEqual([]);
	},
);

describe("a hero the tables lack whose image cannot be fetched", () => {
	// spec: hero-reference/a-new-hero-whose-image-cannot-be-fetched
	test.each([
		[
			"a status the source refuses",
			async () => new Response("", { status: 500 }),
		],
		[
			"a request that never arrives",
			async () => {
				throw new Error("no route to host");
			},
		],
	])("%s ends the run [53]", async (_, reply) => {
		const dir = emptyDir();

		const failed = await mirrorIcons([CLINKZ], dir, serving(reply).fetch).then(
			() => null,
			(error: Error) => error.message,
		);

		expect(failed).toMatch(/clinkz/);
		// Nothing is left for an `icon` to name — neither a file under the name
		// the route serves nor the wreck of the download under the other one.
		expect(held(dir)).toEqual([]);
	});
});
