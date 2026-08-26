/**
 * The whole producer, end to end: staging in, and the client's own loader
 * accepting what comes out.
 *
 * Every step between them is covered on its own elsewhere — the arithmetic
 * without a database, the render and the contract check against the shipped
 * fixture, the route against a directory of its own. What no other case
 * reaches is the joins: that the rows the build wrote are the rows the render
 * reads, that what the publication leaves on disk is what the route resolves,
 * and that the payload arriving at the client is one it will take.
 *
 * Staged through `build.fixture.ts` rather than from `src/fixtures/snapshot.json`
 * itself, though the task named that file: its hero ids are Valve's, and this
 * database's cleaner reclaims the sentinel range alone — seeding the fixture's
 * own heroes would leave rows behind that no suite can remove.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadSnapshot } from "../../app/snapshot.ts";
import { staticRoutes } from "../../server/static-routes.ts";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { exportSnapshot } from "./publish.ts";

requiresDatabase();

const clean = cleaner();

const made: string[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
const realFetch = globalThis.fetch;
afterAll(async () => {
	for (const server of servers) await server.stop(true);
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(url === undefined)("staging to the client's loader", () => {
	afterAll(() => {
		globalThis.fetch = realFetch;
	});

	// spec: snapshot-export/a-bundle-has-been-published
	test("a built snapshot is exported, served, and accepted [45]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		const dir = mkdtempSync(join(tmpdir(), "d2ass-pipeline-"));
		made.push(dir);

		await exportSnapshot(sql, dir);

		const server = Bun.serve({
			port: 0,
			routes: staticRoutes(undefined, pathToFileURL(`${dir}/`)),
		});
		servers.push(server);
		// The client fetches one relative URL and this is the only thing in the
		// way of it: the origin it would have been loaded from. Everything the
		// loader does with the answer — the validation, the caching, the
		// fallback — is its own, and is what this case is here to run.
		globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
			realFetch(
				new URL(input instanceof Request ? input.url : input, server.url),
				init,
			)) as typeof fetch;

		const bundle = await loadSnapshot();

		// The snapshot this run built, not the committed fixture standing in
		// for it: the fixture carries `snapshotId` 1 and 33 heroes.
		expect(bundle?.snapshotId).toBe(built);
		expect(bundle?.heroes).toHaveLength(2);
	});
});

test("the fetch the case above replaced is given back", () => {
	// `bun test` runs every file in one process, and three suites here stub
	// `fetch` for themselves — so the file that pays for a restore that did
	// not take is some later one, which is why this is asserted rather than
	// assumed.
	expect(globalThis.fetch).toBe(realFetch);
});
