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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import rawFixture from "../fixtures/snapshot.json" with { type: "json" };
import { PART, PUBLISHED } from "../job/export/publish.ts";
import type { SnapshotBundle } from "../types.ts";
import { snapshotDir, staticRoutes } from "./static-routes.ts";

const fixture = rawFixture as unknown as SnapshotBundle;

/** A snapshot id the fixture does not carry, so the two sources differ. */
const PUBLISHED_ID = 999;

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

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

	const response = await fetch(`${origin}/${PUBLISHED}`);

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
		`${serving(join(shared, "never-written"))}/${PUBLISHED}`,
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
	expect((await (await fetch(`${at}/${PUBLISHED}`)).json()).snapshotId).toBe(
		fixture.snapshotId,
	);

	await Bun.write(
		join(dir, PUBLISHED),
		JSON.stringify({ ...fixture, snapshotId: PUBLISHED_ID }),
	);

	const response = await fetch(`${at}/${PUBLISHED}`);
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
	await Bun.write(
		join(spaced, PUBLISHED),
		JSON.stringify({ ...fixture, snapshotId: PUBLISHED_ID }),
	);

	expect((await (await fetch(`${at}/${PUBLISHED}`)).json()).snapshotId).toBe(
		PUBLISHED_ID,
	);
});

test("the published bundle is revalidated, as the fixture is [42]", async () => {
	const dir = emptyDir();
	const at = serving(dir);
	await Bun.write(
		join(dir, PUBLISHED),
		JSON.stringify({ ...fixture, snapshotId: PUBLISHED_ID }),
	);

	const response = await fetch(`${at}/${PUBLISHED}`);

	// The URL is republished under the same name, so what the client holds is
	// never fresh on its own account — it asks, and the answer is cheap.
	expect(response.headers.get("cache-control")).toBe("no-cache");
	expect(response.headers.get("content-type")).toStartWith("application/json");
});
