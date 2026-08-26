/**
 * What a suite driving the entry point needs: a whole run's dependencies over
 * the source `ingest.fixture.ts` scripts, a bundle directory per case, and a
 * connection whose build refuses.
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
export function refusingTheBuild(sql: SQL): SQL {
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
