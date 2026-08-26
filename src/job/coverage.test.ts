/**
 * What a run covered, on the snapshot the run built: which days the meta pull
 * reached, whether the source's cap or the patch's own age fixed them, and
 * which weeks the pair pull covered.
 *
 * Every case here varies the patch's age and nothing else, because the age is
 * the only input the record has: the window arithmetic itself is covered
 * without a database in `meta-window.test.ts` and `pairs-weeks.test.ts`, and
 * what these cases add is that the answer reaches the row.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "./build/build.fixture.ts";
import { buildSnapshot } from "./build/build.ts";
import { cleaner, requiresDatabase, url } from "./db.fixture.ts";
import { PART } from "./export/publish.ts";
import { DAY_MS, icons, RUN_AT } from "./ingest/ingest.fixture.ts";
import { bundles, covered, day, jobDeps } from "./run.fixture.ts";
import { runJob } from "./run.ts";

requiresDatabase();

const clean = cleaner();
const iconsDir = icons();
const bundle = bundles();

/** The UTC midnight the run instant's own day begins at, which every window ends at. */
const MIDNIGHT = Date.parse("2026-08-21T00:00:00.000Z");

/** A patch released `days` complete UTC days before `RUN_AT`'s window ends. */
const releasedFor = (days: number) =>
	new Date(MIDNIGHT - days * DAY_MS).toISOString();

/** A whole run over a patch released then, and the row it left behind. */
async function ran(released: string, at = RUN_AT) {
	const sql = await clean();
	const report = await runJob(
		jobDeps(sql, { icons: iconsDir, bundle: bundle() }, at, { released }),
		at,
	);
	expect(report).toBeNull();
	return covered(sql);
}

describe.skipIf(url === undefined)("what a run covered", () => {
	// spec: snapshot-ingest/a-run-the-patch-bound
	test("a window the patch bound is recorded with its own bounds [92]", async () => {
		const row = await ran(releasedFor(7));

		expect(day(row.meta_first_day)).toBe("2026-08-14T00:00:00.000Z");
		// The last day the window includes, a day before the exclusive bound it
		// ends at — the run pulled no matches from the 21st.
		expect(day(row.meta_last_day)).toBe("2026-08-20T00:00:00.000Z");
		expect(row.meta_capped_by_source).toBe(false);
		expect(row.pair_weeks?.map(day)).toEqual(["2026-08-13T00:00:00.000Z"]);
	});

	// spec: snapshot-ingest/a-run-the-source-s-cap-bound
	test("a patch older than the cap records the thirty days reached [93]", async () => {
		const row = await ran(releasedFor(150));

		expect(row.meta_capped_by_source).toBe(true);
		expect(day(row.meta_first_day)).toBe("2026-07-22T00:00:00.000Z");
		expect(day(row.meta_last_day)).toBe("2026-08-20T00:00:00.000Z");
		// Four weeks, which is the pair pull's own bound rather than the meta
		// window's: thirty days span more than four.
		expect(row.pair_weeks?.map(day)).toEqual([
			"2026-07-23T00:00:00.000Z",
			"2026-07-30T00:00:00.000Z",
			"2026-08-06T00:00:00.000Z",
			"2026-08-13T00:00:00.000Z",
		]);
	});

	// spec: snapshot-ingest/a-patch-exactly-as-old-as-the-cap
	test("a patch exactly as old as the cap is not recorded as bound [101]", async () => {
		const row = await ran(releasedFor(30));

		// The two windows coincide, so the cap discarded no day the patch held.
		expect(row.meta_capped_by_source).toBe(false);
		expect(day(row.meta_first_day)).toBe("2026-07-22T00:00:00.000Z");
	});

	// spec: snapshot-ingest/a-run-the-patch-bound
	test("a patch detected today records one day as first and last", async () => {
		const row = await ran(releasedFor(0));

		// No whole day of the patch's own has passed, and the window falls back
		// on the most recent complete day rather than on nothing.
		expect(day(row.meta_first_day)).toBe("2026-08-20T00:00:00.000Z");
		expect(day(row.meta_last_day)).toBe("2026-08-20T00:00:00.000Z");
	});

	// spec: snapshot-ingest/a-run-the-patch-bound
	test("a patch younger than a week records no week beside its days", async () => {
		// A Monday, so the patch was released on the boundary of the week the
		// run falls inside — a week the source has nothing complete for.
		const at = new Date("2026-08-24T12:00:00.000Z");

		const row = await ran("2026-08-20T00:00:00.000Z", at);

		expect(row.pair_weeks).toEqual([]);
		expect(day(row.meta_first_day)).toBe("2026-08-20T00:00:00.000Z");
		expect(day(row.meta_last_day)).toBe("2026-08-23T00:00:00.000Z");
	});

	// spec: snapshot-ingest/a-snapshot-the-entry-point-did-not-complete
	test("a snapshot no entry point completed carries null coverage [94]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);

		await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const row = await covered(sql, NEW_PATCH);
		// Published, so the nulls are not a state validation refuses: the row
		// exists unfilled between the build and a write no run made.
		expect(row.status).toBe("published");
		expect(row.meta_first_day).toBeNull();
		expect(row.meta_last_day).toBeNull();
		expect(row.meta_capped_by_source).toBeNull();
		expect(row.pair_weeks).toBeNull();
	});

	// spec: snapshot-ingest/a-build-that-ends-failed
	test("a build ending failed still carries what its run covered [99]", async () => {
		const sql = await clean();

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: bundle() }, RUN_AT, {
				unbeaten: true,
			}),
			RUN_AT,
		);

		expect(report).toContain("build");
		const row = await covered(sql);
		expect(row.status).toBe("failed");
		expect(day(row.meta_first_day)).toBe("2026-08-14T00:00:00.000Z");
		expect(row.pair_weeks?.map(day)).toEqual(["2026-08-13T00:00:00.000Z"]);
	});

	// spec: snapshot-ingest/an-export-that-fails-after-the-record
	test("an export failing after the record leaves it standing [100]", async () => {
		const sql = await clean();
		const dir = bundle();
		mkdirSync(join(dir, PART));

		const report = await runJob(
			jobDeps(sql, { icons: iconsDir, bundle: dir }, RUN_AT),
			RUN_AT,
		);

		expect(report).toContain("export");
		const row = await covered(sql);
		// The record says what the run covered, not that a bundle shipped.
		expect(row.status).toBe("published");
		expect(day(row.meta_first_day)).toBe("2026-08-14T00:00:00.000Z");
		expect(day(row.meta_last_day)).toBe("2026-08-20T00:00:00.000Z");
	});
});
