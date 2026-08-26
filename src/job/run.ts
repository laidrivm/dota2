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
import { buildSnapshot } from "./build/build.ts";
import { connect, connectionString } from "./db.ts";
import { exportSnapshot } from "./export/publish.ts";
import { type Deps as IngestDeps, ingest } from "./ingest/ingest.ts";
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
	let patchId: string;
	try {
		patchId = (await ingest(deps, at)).patchId;
	} catch (error) {
		return failed("ingest", error);
	}

	let snapshotId: number;
	try {
		snapshotId = await buildSnapshot(deps.sql, patchId, at);
	} catch (error) {
		return failed("build", error);
	}
	// A build that refuses its own statistics settles the row at `failed` and
	// returns it rather than raising, so the outcome is read off the row. The
	// export is not run over it: what it would publish is the snapshot before
	// this one, which is already the file being served.
	const [row] = await deps.sql`SELECT status FROM snapshots
		WHERE snapshot_id = ${snapshotId}`;
	if (row.status !== "published")
		return `the build left snapshot ${snapshotId} at ${row.status}`;

	try {
		await exportSnapshot(deps.sql, deps.bundleDir);
	} catch (error) {
		return failed("export", error);
	}
	return null;
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
	const report = await command(Bun.argv[2]);
	if (report !== null) console.error(report);
	process.exit(report === null ? 0 : 1);
}
