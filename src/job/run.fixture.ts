/**
 * What a suite driving the entry point needs: a whole run's dependencies over
 * the source `ingest.fixture.ts` scripts and a bundle directory per case.
 *
 * Its own file rather than the suite's, because the outcome cases and the
 * end-to-end case in `export/pipeline.test.ts` both drive a whole run and
 * would otherwise assemble the same dependencies twice.
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
