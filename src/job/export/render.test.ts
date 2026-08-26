/**
 * Which snapshot the export renders, and what it does when there is none.
 *
 * The bundle's shape is the next two steps'; what is here is the selection
 * alone, over snapshots a real build produced rather than rows written by
 * hand — the export reads what the build wrote, so a fixture of its own would
 * agree with the build only by being kept in step with it.
 */
import { describe, expect, test } from "bun:test";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { renderBundle } from "./render.ts";

requiresDatabase();

const clean = cleaner();

describe.skipIf(url === undefined)("which snapshot is rendered", () => {
	// spec: snapshot-export/a-newer-snapshot-is-still-building
	test("a newer snapshot still building is not the one rendered [30]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const published = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		const newer = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		await sql`UPDATE snapshots SET status = 'building'
			WHERE snapshot_id = ${newer}`;

		const bundle = await renderBundle(sql);

		// The greater id is not the question: that one is a run part way
		// through, and rendering it would publish half a build.
		expect(bundle.snapshotId).toBe(published);
		// And it rendered the snapshot rather than an empty shell of it, so the
		// id above is not the only thing this case would notice.
		expect(bundle.heroes).toHaveLength(2);
	});

	test("the newest of several published snapshots is the one rendered [93]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		const newest = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// Both published, so `status` cannot separate them and only the order
		// can — which the case above cannot say, having left one `building`.
		expect((await renderBundle(sql)).snapshotId).toBe(newest);
	});

	// spec: snapshot-export/nothing-has-ever-been-published
	test("nothing published leaves nothing to render [27]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		// A snapshot that exists and never published, which is the case a
		// selection reading the greatest id would render anyway.
		await sql`UPDATE snapshots SET status = 'failed'
			WHERE snapshot_id = ${built}`;

		await renderBundle(sql).then(
			() => expect.unreachable(),
			(error: Error) =>
				expect(error.message).toContain("no snapshot has published"),
		);
	});
});
