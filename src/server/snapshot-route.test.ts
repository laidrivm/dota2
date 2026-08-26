/**
 * What `/snapshot.json` answers with, and which of its two sources it read.
 *
 * The route resolves its source on every request — the published bundle where
 * the publication directory holds one, the committed fixture otherwise — so
 * the cases below write into that directory while the server is running,
 * which is the state a map built at startup cannot answer.
 *
 * The font and icon routes are `static-routes.test.ts`'s; this file is the
 * one route whose source moves.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import rawFixture from "../fixtures/snapshot.json" with { type: "json" };
import { PART, PUBLISHED, publishBundle } from "../job/export/publish.ts";
import type { SnapshotBundle } from "../types.ts";
import { snapshotDir, staticRoutes } from "./static-routes.ts";

const fixture = rawFixture as unknown as SnapshotBundle;

/**
 * The URL the client fetches, written out rather than built from `PUBLISHED`:
 * the two spell the same thing today, and the route is under test for keeping
 * them apart — the URL is the client's contract, the filename is the job's.
 */
const SNAPSHOT_URL = "/snapshot.json";

/** A snapshot id the fixture does not carry, so the two sources differ. */
const PUBLISHED_ID = 999;

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** Publish a bundle carrying `snapshotId` into `dir`, as the export does. */
const publish = (dir: string, snapshotId: number) =>
	publishBundle(dir, { ...fixture, snapshotId });

/** What a response offers as its validator, or the empty string for none. */
const etagOf = (response: Response) => response.headers.get("etag") ?? "";

/** A publication directory of its own, removed when the file finishes. */
const emptyDir = () => {
	const dir = mkdtempSync(join(tmpdir(), "d2ass-served-"));
	made.push(dir);
	return dir;
};

const servers: ReturnType<typeof Bun.serve>[] = [];
afterAll(async () => {
	for (const server of servers) await server.stop(true);
});

/** A server reading `dir` for its bundle, stopped when the file finishes. */
const serving = (dir: string) => {
	const server = Bun.serve({
		port: 0,
		routes: staticRoutes(undefined, pathToFileURL(`${dir}/`)),
	});
	servers.push(server);
	return server.url.origin;
};

/** The directory every case that does not need its own writes into. */
let shared: string;
let origin: string;
beforeAll(() => {
	shared = emptyDir();
	origin = serving(shared);
});

// spec: snapshot-export/nothing-published-yet
test("a publication directory holding no bundle serves the fixture [55]", async () => {
	// Holding the wreck of a crashed export, which is the state group 7's
	// publication leaves and the one a reader must never be handed: the route
	// resolves a name, and this is not that name.
	await Bun.write(join(shared, PART), '{"half": ');

	const response = await fetch(`${origin}${SNAPSHOT_URL}`);

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toStartWith("application/json");
	// The fixture is revalidated for the reason the bundle is: the pipeline
	// republishes this URL, and a client holding either must ask.
	expect(response.headers.get("cache-control")).toBe("no-cache");
	expect((await response.json()).snapshotId).toBe(fixture.snapshotId);
});

// spec: snapshot-export/nothing-published-yet
test("a publication directory that is not there serves the fixture [28]", async () => {
	// Every clone before the first export, `bun run dev` included — and the
	// deployment between mounting the volume and filling it.
	const absent = await fetch(
		`${serving(join(shared, "never-written"))}${SNAPSHOT_URL}`,
	);

	expect(absent.status).toBe(200);
	expect((await absent.json()).snapshotId).toBe(fixture.snapshotId);
});

// spec: snapshot-export/a-bundle-has-been-published
test("a published bundle is served in preference to the fixture [29]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	// Before and after, over one running server: the export writes this
	// directory while the server runs, so a source resolved once at startup
	// would serve the fixture forever.
	expect((await (await fetch(`${at}${SNAPSHOT_URL}`)).json()).snapshotId).toBe(
		fixture.snapshotId,
	);

	await publish(dir, PUBLISHED_ID);

	const response = await fetch(`${at}${SNAPSHOT_URL}`);
	expect(response.status).toBe(200);
	expect((await response.json()).snapshotId).toBe(PUBLISHED_ID);
});

test("the publication directory is the repository's own [96]", () => {
	// The one anchor no request can report on: a wrong one holds no bundle,
	// and the route answers that with the fixture — which is exactly what a
	// clone that has never exported gets. Derived from git rather than from
	// this file's location, because that location is what the anchor is under
	// test for.
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
		.stdout.toString()
		.trim();

	expect(fileURLToPath(snapshotDir)).toBe(`${top}/snapshot/`);
});

// spec: snapshot-export/a-bundle-has-been-published
test("a publication directory whose path needs encoding is read [97]", async () => {
	// `URL.pathname` keeps its percent-encoding, so a checkout under a
	// directory with a space in its name would look to this route like one
	// holding no bundle — and be answered with the fixture, silently and
	// forever. The icon route carries this case for the same reason.
	const spaced = mkdtempSync(join(tmpdir(), "d2ass served "));
	made.push(spaced);
	const at = serving(spaced);
	await publish(spaced, PUBLISHED_ID);

	expect((await (await fetch(`${at}${SNAPSHOT_URL}`)).json()).snapshotId).toBe(
		PUBLISHED_ID,
	);
});

test("the published bundle is revalidated, as the fixture is [42]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await publish(dir, PUBLISHED_ID);

	const response = await fetch(`${at}${SNAPSHOT_URL}`);

	// The URL is republished under the same name, so what the client holds is
	// never fresh on its own account — it asks, and the answer is cheap.
	expect(response.headers.get("cache-control")).toBe("no-cache");
	expect(response.headers.get("content-type")).toStartWith("application/json");
});

// spec: snapshot-export/a-returning-client
test("a request carrying the ETag it was given is answered 304 [40]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await publish(dir, PUBLISHED_ID);
	const first = await fetch(`${at}${SNAPSHOT_URL}`);

	const second = await fetch(`${at}${SNAPSHOT_URL}`, {
		headers: { "if-none-match": etagOf(first) },
	});

	// Not vacuous on an absent header: an empty `If-None-Match` matching an
	// empty `ETag` is exactly how a route that offers no validator would pass.
	expect(etagOf(first)).not.toBe("");
	expect(second.status).toBe(304);
	expect(await second.text()).toBe("");
	// The validator it matched, carried back: a 304 says "what you hold is
	// current", and a client given no tag to hold has nothing to ask with
	// next time.
	expect(etagOf(second)).toBe(etagOf(first));
	expect(second.headers.get("cache-control")).toBe("no-cache");
});

// spec: snapshot-export/a-new-bundle-has-been-published
test("a request carrying a stale ETag is answered with the new bundle [41]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await publish(dir, PUBLISHED_ID);
	const first = await fetch(`${at}${SNAPSHOT_URL}`);

	await publish(dir, PUBLISHED_ID + 1);
	const second = await fetch(`${at}${SNAPSHOT_URL}`, {
		headers: { "if-none-match": etagOf(first) },
	});

	expect(second.status).toBe(200);
	expect(etagOf(second)).not.toBe(etagOf(first));
	expect((await second.json()).snapshotId).toBe(PUBLISHED_ID + 1);
});

// spec: snapshot-export/a-byte-identical-re-export
test("a re-export of identical bytes is still answered 304 [50]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await publish(dir, PUBLISHED_ID);
	const first = await fetch(`${at}${SNAPSHOT_URL}`);
	const before = statSync(join(dir, PUBLISHED), { bigint: true }).mtimeNs;

	// The same bundle published again: a rename puts a different file at the
	// name, so the timestamp moves and the bytes do not.
	await publish(dir, PUBLISHED_ID);
	const second = await fetch(`${at}${SNAPSHOT_URL}`, {
		headers: { "if-none-match": etagOf(first) },
	});

	// Asserted, because the case rests on it: had the file not been rewritten,
	// a validator derived from the timestamp would pass here too.
	expect(statSync(join(dir, PUBLISHED), { bigint: true }).mtimeNs).not.toBe(
		before,
	);
	expect(second.status).toBe(304);
});

// spec: snapshot-export/a-new-bundle-has-been-published
test("the first publication is not served under the fixture's ETag [56]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	// The fixture, which is what this URL answers until an export runs.
	const fixtureTag = etagOf(await fetch(`${at}${SNAPSHOT_URL}`));

	await publish(dir, PUBLISHED_ID);
	const response = await fetch(`${at}${SNAPSHOT_URL}`, {
		headers: { "if-none-match": fixtureTag },
	});

	// The source changed, not just the file: a validator that forgot which of
	// the two it had read would hand the fixture's answer to the bundle.
	expect(fixtureTag).not.toBe("");
	expect(response.status).toBe(200);
	expect(etagOf(response)).not.toBe(fixtureTag);
	expect((await response.json()).snapshotId).toBe(PUBLISHED_ID);
});

// spec: snapshot-export/a-returning-client
test("an If-None-Match naming the current ETag among others is 304 [99]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await publish(dir, PUBLISHED_ID);
	const first = await fetch(`${at}${SNAPSHOT_URL}`);

	// What an intermediary sends: a list, and the current validator weakened.
	const second = await fetch(`${at}${SNAPSHOT_URL}`, {
		headers: { "if-none-match": `"a1b2", W/${etagOf(first)}` },
	});

	expect(second.status).toBe(304);
	expect(await second.text()).toBe("");
});
