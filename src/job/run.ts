/**
 * The job: the ingest, the build and the export in that order, and one report
 * saying which of them a run stopped at.
 *
 * It owns no schedule and no alert — the deployment owns both, and both want
 * an exit code rather than a log line. So the function returns the report and
 * the command below turns it into the code; nothing here retries, and nothing
 * here decides what a failure is worth waking somebody for.
 *
 * A step that fails stops the run where it stands, which is what leaves the
 * previously published bundle serving: the export is the only step that
 * touches the served file, and it runs last.
 */
import type { SQL } from "bun";
import { buildSnapshot } from "./build/build.ts";
import { connect, connectionString } from "./db.ts";
import { exportSnapshot } from "./export/publish.ts";
import {
	type Covered,
	type Deps as IngestDeps,
	ingest,
} from "./ingest/ingest.ts";
import { DAY_MS } from "./ingest/meta.ts";
import { createClient } from "./ingest/stratz.ts";

/** What a run needs: what the ingest needs, and where the bundle is published. */
export type Deps = IngestDeps & { bundleDir: string };

/** The step's name and the reason, in the words the command prints unchanged. */
const failed = (step: string, error: unknown) =>
	`the ${step} failed: ${error instanceof Error ? error.message : String(error)}`;

/**
 * Carry one run through its three steps, and return the report of the one that
 * failed — or `null` where none did.
 *
 * `at` is an argument for the reason every window in the ingest takes one: a
 * run over the same instant and the same source covers the same days.
 */
export async function runJob(deps: Deps, at: Date): Promise<string | null> {
	let covered: Covered;
	try {
		covered = await ingest(deps, at);
	} catch (error) {
		return failed("ingest", error);
	}

	let snapshotId: number;
	let status: string;
	try {
		snapshotId = await buildSnapshot(deps.sql, covered.patchId, at);
		// As soon as the build returns a row and whatever outcome it settled at:
		// a build that ends `failed` is the case where the window it read is
		// most worth having, and an export that fails after this falsifies
		// nothing the record claims — it says what the run covered, not that a
		// bundle shipped.
		//
		// Inside the build's own `try` deliberately, though the write is not
		// the build's: a run has three steps to report and this is on the row
		// the build just made, so a write that refuses is reported against the
		// step that produced what it was writing about.
		await record(deps.sql, snapshotId, covered);
		// A build that refuses its own statistics settles the row at `failed`
		// and returns it rather than raising, so the outcome is read off the
		// row — inside this block for the same reason the write is, so that a
		// read the connection refuses is reported as the step it was about
		// rather than rejecting out of a function whose whole contract is to
		// return a report.
		const [row] = await deps.sql`SELECT status FROM snapshots
			WHERE snapshot_id = ${snapshotId}`;
		status = row.status;
	} catch (error) {
		return failed("build", error);
	}
	// The export is not run over a snapshot that did not publish: what it would
	// publish is the snapshot before this one, which is already the file being
	// served.
	if (status !== "published")
		return `the build left snapshot ${snapshotId} at ${status}`;

	try {
		await exportSnapshot(deps.sql, deps.bundleDir);
	} catch (error) {
		return failed("export", error);
	}
	return null;
}

/**
 * Record on the row the build produced what the run covered.
 *
 * The day recorded as last is the last day the window **includes**, where
 * `MetaWindow` ends at the exclusive bound after it: a record read as the
 * wrong one of the two claims a day of matches the run never pulled.
 *
 * The weeks are bound through `sql.array` with the column's own type rather
 * than handed over bare, which the driver sends as the array's `toString()`
 * and Postgres refuses as a malformed array literal (bun 1.3.14). An empty
 * list arrives as an empty array and not a null: a run that covered no week is
 * not a run nobody recorded.
 */
async function record(
	sql: SQL,
	snapshotId: number,
	covered: Covered,
): Promise<void> {
	await sql`UPDATE snapshots SET
			meta_first_day = ${covered.window.start},
			meta_last_day = ${new Date(covered.window.end.getTime() - DAY_MS)},
			meta_capped_by_source = ${covered.window.cappedBySource},
			pair_weeks = ${sql.array(covered.weeks, "TIMESTAMPTZ")}
		WHERE snapshot_id = ${snapshotId}`;
}

/** A directory or a key a run cannot start without, or a throw naming it. */
function required(name: string): string {
	const value = (Bun.env[name] ?? "").trim();
	if (value === "")
		throw new Error(`${name} is unset or empty; no run was started`);
	return value;
}

/**
 * The command: the whole job, or the export alone when told so.
 *
 * The export is the only step with a mode of its own, because it is the only
 * one worth repeating on its own — it renders whatever snapshot published last,
 * so a run whose export failed is finished by this without paying for the
 * ingest and the build again. An argument that is not `export` is refused
 * rather than falling through to the whole job, which would spend a quota on a
 * typo.
 */
async function command(mode: string | undefined): Promise<string | null> {
	const bundleDir = required("BUNDLE_DIR");
	const sql = await connect(connectionString());
	try {
		if (mode === "export")
			return await exportSnapshot(sql, bundleDir).then(
				() => null,
				(error: unknown) => failed("export", error),
			);
		if (mode !== undefined)
			return `${mode} is not a step this job runs on its own; only the export is`;
		return await runJob(
			{
				sql,
				query: createClient(),
				iconsDir: required("ICONS_DIR"),
				bundleDir,
			},
			new Date(),
		);
	} finally {
		await sql.close();
	}
}

if (import.meta.main) {
	// Caught here rather than left to the runtime: `required` and `connect`
	// throw before any step has run, and an uncaught rejection answers a
	// deployment with a stack trace where the variable it has to set is the
	// only useful line.
	const report = await command(Bun.argv[2]).catch((error: unknown) =>
		error instanceof Error ? error.message : String(error),
	);
	if (report !== null) console.error(report);
	process.exit(report === null ? 0 : 1);
}
