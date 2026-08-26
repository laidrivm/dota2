/**
 * The entry point's outcomes: which of the three steps a run reaches, what it
 * leaves served when one of them fails, and the exit code the command turns
 * that into.
 *
 * Every case runs the whole job against the scripted source, because the thing
 * under test is the order and the stopping — what each step does on its own is
 * covered where that step lives.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SQL } from "bun";
import { cleaner, requiresDatabase, url } from "./db.fixture.ts";
import { PART, PUBLISHED } from "./export/publish.ts";
import { icons, PATCH, RUN_AT } from "./ingest/ingest.fixture.ts";
import { bundles, jobDeps } from "./run.fixture.ts";
import { runJob } from "./run.ts";

requiresDatabase();

const clean = cleaner();
const iconsDir = icons();
const bundle = bundles();

/**
 * The same connection with the build's own transaction refusing.
 *
 * A whole run opens exactly two: the ingest's staging write and, after it, the
 * build's statistics write. So the second is the build's, and counting them is
 * how a raise is put inside the build without the ingest that feeds it failing
 * first. A stub for the reason `build.fixture.ts`'s own is — every constraint
 * on the tables the build writes is mirrored on the staging table it reads
 * from, so no row the schema admits produces this raise.
 */
function refusingTheBuild(sql: SQL): SQL {
	let opened = 0;
	return new Proxy(sql, {
		get(target, key) {
			const held = Reflect.get(target, key);
			if (key !== "begin")
				return typeof held === "function" ? held.bind(target) : held;
			return (...args: unknown[]) =>
				++opened > 1
					? Promise.reject(new Error("the statistics write refused"))
					: (held as (...a: unknown[]) => Promise<unknown>).apply(target, args);
		},
	});
}

/** What a run that failed was meant to have left untouched. */
const PREVIOUS = '{"snapshotId":0}';

/** A directory holding no `.env`, which is where every command below runs. */
const away = bundle();

/**
 * The command this module is, run as the deployment will run it.
 *
 * The environment is built rather than inherited, and the working directory is
 * an empty one: bun reads a `.env` out of the directory it starts in, and
 * `.env.example` — which names `BUNDLE_DIR` and tells a reader to copy it —
 * is exactly how a developer comes to have one. A case that leaves a variable
 * unset has to be able to mean it.
 */
const command = (args: string[], env: Record<string, string>) =>
	Bun.spawnSync(["bun", join(import.meta.dir, "run.ts"), ...args], {
		cwd: away,
		env: {
			PATH: Bun.env.PATH ?? "",
			HOME: Bun.env.HOME ?? "",
			DATABASE_URL: url ?? "",
			...env,
		},
	});

describe.skipIf(url === undefined)("a run's one outcome", () => {
	// spec: snapshot-ingest/a-run-that-succeeds
	test("all three steps succeeding serve the snapshot just built [56]", async () => {
		const sql = await clean();
		const dir = bundle();

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: dir }, RUN_AT),
			RUN_AT,
		);

		expect(report).toBeNull();
		const [row] = await sql`SELECT snapshot_id, status FROM snapshots
			WHERE patch_id = ${PATCH}`;
		expect(row.status).toBe("published");
		const served = await Bun.file(join(dir, PUBLISHED)).json();
		expect(served.snapshotId).toBe(Number(row.snapshot_id));
	});

	// spec: snapshot-ingest/an-ingest-that-fails
	test("the report names the step that failed and why [57]", async () => {
		const sql = await clean();

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: bundle() }, RUN_AT, {
				patches: [],
			}),
			RUN_AT,
		);

		expect(report).toContain("ingest");
		expect(report).toContain("listed no patch");
	});

	// spec: snapshot-ingest/an-ingest-that-fails
	test("a failing ingest builds nothing and leaves the bundle served [58]", async () => {
		const sql = await clean();
		const dir = bundle();
		await Bun.write(join(dir, PUBLISHED), PREVIOUS);

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: dir }, RUN_AT, { patches: [] }),
			RUN_AT,
		);

		expect(report).not.toBeNull();
		const built = await sql`SELECT snapshot_id FROM snapshots`;
		expect(built).toEqual([]);
		expect(await Bun.file(join(dir, PUBLISHED)).text()).toBe(PREVIOUS);
	});

	// spec: snapshot-ingest/a-build-that-fails
	test("a build ending failed runs no export [59]", async () => {
		const sql = await clean();
		const dir = bundle();
		await Bun.write(join(dir, PUBLISHED), PREVIOUS);

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: dir }, RUN_AT, {
				unbeaten: true,
			}),
			RUN_AT,
		);

		expect(report).toContain("build");
		const [row] =
			await sql`SELECT status FROM snapshots WHERE patch_id = ${PATCH}`;
		expect(row.status).toBe("failed");
		expect(await Bun.file(join(dir, PUBLISHED)).text()).toBe(PREVIOUS);
	});

	// spec: snapshot-ingest/a-build-that-fails
	test("a build that raises runs no export either", async () => {
		const sql = await clean();
		const dir = bundle();
		await Bun.write(join(dir, PUBLISHED), PREVIOUS);

		const report = await runJob(
			jobDeps(refusingTheBuild(sql), { icons: iconsDir, bundle: dir }, RUN_AT),
			RUN_AT,
		);

		// The other half of the criterion: a build ends at `failed` by refusing
		// its own statistics as well as by failing validation, and only the
		// second of the two hands the entry point a row.
		expect(report).toContain("build");
		const [row] =
			await sql`SELECT status FROM snapshots WHERE patch_id = ${PATCH}`;
		expect(row.status).toBe("failed");
		expect(await Bun.file(join(dir, PUBLISHED)).text()).toBe(PREVIOUS);
	});

	// spec: snapshot-ingest/an-export-that-fails
	test("a failing export writes no bundle and leaves the previous one [60]", async () => {
		const sql = await clean();
		const dir = bundle();
		await Bun.write(join(dir, PUBLISHED), PREVIOUS);
		// The name the bundle is written under first, standing as a directory:
		// the write onto it refuses whoever owns the process, where a read-only
		// directory refuses nobody when the tests run as root.
		mkdirSync(join(dir, PART));

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: dir }, RUN_AT),
			RUN_AT,
		);

		expect(report).toContain("export");
		const [row] =
			await sql`SELECT status FROM snapshots WHERE patch_id = ${PATCH}`;
		expect(row.status).toBe("published");
		expect(await Bun.file(join(dir, PUBLISHED)).text()).toBe(PREVIOUS);
	});

	// spec: snapshot-ingest/the-export-invoked-on-its-own
	test("the export invoked alone renders the newest published snapshot [61]", async () => {
		const sql = await clean();
		await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: bundle() }, RUN_AT),
			RUN_AT,
		);
		const dir = bundle();

		// No key, so a client cannot even be constructed: a run that reaches the
		// statistics API under this environment fails instead of exporting, which
		// is what makes the exit code below evidence that none was reached.
		const run = command(["export"], { BUNDLE_DIR: dir, STRATZ_API_KEY: "" });

		expect(run.stderr.toString()).toBe("");
		expect(run.exitCode).toBe(0);
		const [row] = await sql`SELECT snapshot_id FROM snapshots
			WHERE status = 'published' ORDER BY snapshot_id DESC LIMIT 1`;
		const served = await Bun.file(join(dir, PUBLISHED)).json();
		expect(served.snapshotId).toBe(Number(row.snapshot_id));
	});

	// spec: snapshot-ingest/the-export-invoked-on-its-own
	test("no step but the export is invocable on its own", async () => {
		const dir = bundle();

		const run = command(["build"], { BUNDLE_DIR: dir, STRATZ_API_KEY: "" });

		expect(run.exitCode).not.toBe(0);
		expect(run.stderr.toString()).toContain("only the export");
		// Absent rather than empty: a zero size is what both a bundle nobody
		// wrote and a bundle written empty report.
		expect(await Bun.file(join(dir, PUBLISHED)).exists()).toBe(false);
	});

	// spec: snapshot-ingest/an-export-that-fails
	test("the command exits non-zero and names the step that failed", async () => {
		const sql = await clean();
		await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: bundle() }, RUN_AT),
			RUN_AT,
		);
		const dir = bundle();
		mkdirSync(join(dir, PART));

		const run = command(["export"], { BUNDLE_DIR: dir, STRATZ_API_KEY: "" });

		expect(run.exitCode).not.toBe(0);
		expect(run.stderr.toString()).toContain("export");
	});

	// Uncited: no criterion fixes the variables the command reads — the
	// proposal names them and `.env.example` carries them, and a citation to
	// the nearest criterion would claim this case closes one it does not.
	test("a directory a run reads is named when it is unset", () => {
		const run = command(["export"], { STRATZ_API_KEY: "" });

		// Before the connection: a run with nowhere to publish to has no reason
		// to open one, and the variable rather than a stack is what a deployment
		// reads off a failed run — which is the one line asserted below, an
		// uncaught throw being how the same exit code arrives with a dump.
		expect(run.exitCode).not.toBe(0);
		expect(run.stderr.toString().trim().split("\n")).toHaveLength(1);
		expect(run.stderr.toString()).toContain("BUNDLE_DIR");
	});
});
