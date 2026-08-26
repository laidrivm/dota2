/**
 * What a suite driving the entry point needs: a whole run's dependencies over
 * the source `ingest.fixture.ts` scripts, a bundle directory per case, and the
 * coverage columns read back off the snapshot a run built.
 *
 * Its own file rather than any one suite's, because three drive a whole run
 * and differ only in what they vary — the outcome of a step, the patch's age,
 * or nothing at all — and would otherwise assemble the same dependencies
 * three times.
 */
import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SQL } from "bun";
import {
	PATCH,
	RELEASED,
	sourceFetch,
	sourceQuery,
} from "./ingest/ingest.fixture.ts";
import type { Deps } from "./run.ts";

/** How the scripted source is bent for one case, all of it optional. */
export type Source = {
	/** When the patch list says this patch was released. */
	released?: string;
	/** The whole patch list, for the cases that want none at all. */
	patches?: unknown[];
	/** A meta pull the build cannot publish, `ingest.fixture.ts` §`unbeaten`. */
	unbeaten?: boolean;
};

/** One run's dependencies at `at`, over the source `source` describes. */
export const jobDeps = (
	sql: SQL,
	dirs: { icons: string; bundle: string },
	at: Date,
	source: Source = {},
): Deps => ({
	sql,
	query: sourceQuery(at, source).query,
	fetch: sourceFetch(
		source.patches ?? [{ name: PATCH, date: source.released ?? RELEASED }],
	),
	iconsDir: dirs.icons,
	bundleDir: dirs.bundle,
});

/**
 * A way to take bundle directories that are removed when the file finishes.
 * Call it at the top level of a suite, as `db.fixture.ts`'s own openers are:
 * it registers the `afterAll` that does the removing.
 */
export function bundles(): () => string {
	const made: string[] = [];
	afterAll(() => {
		for (const dir of made) rmSync(dir, { recursive: true, force: true });
	});
	return () => {
		const dir = mkdtempSync(join(tmpdir(), "d2ass-run-"));
		made.push(dir);
		return dir;
	};
}

/** The newest snapshot of `patchId`: its status and what its run covered. */
export async function covered(sql: SQL, patchId = PATCH) {
	const [row] = await sql`SELECT status, meta_first_day, meta_last_day,
			meta_capped_by_source, pair_weeks
		FROM snapshots WHERE patch_id = ${patchId}
		ORDER BY snapshot_id DESC LIMIT 1`;
	return row as {
		status: string;
		meta_first_day: Date | null;
		meta_last_day: Date | null;
		meta_capped_by_source: boolean | null;
		pair_weeks: Date[] | null;
	};
}

/** A UTC day as an ISO instant, which is how every bound here is compared. */
export const day = (at: Date | null) => at?.toISOString() ?? null;
