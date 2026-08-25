/**
 * Where a build's snapshot ends up: `published` when the checks pass,
 * `failed` when one refuses, and which snapshot is newest afterwards.
 *
 * The checks themselves are `validate.test.ts`'s, which reaches their
 * boundaries without a database. What is here is the transition and what a
 * refusal leaves behind, both of which are rows.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import {
	BUILT_AT,
	NEW_PATCH,
	OLD_PATCH,
	OTHER,
	seeded,
	stage,
} from "./build.fixture.ts";
import { buildSnapshot } from "./build.ts";

requiresDatabase();

const clean = cleaner();

/** The snapshot the export would take, or `undefined` where none published. */
const newestPublished = async (sql: SQL): Promise<number | undefined> => {
	const [row] = await sql`SELECT snapshot_id FROM snapshots
		WHERE status = 'published' ORDER BY snapshot_id DESC LIMIT 1`;
	return row === undefined ? undefined : Number(row.snapshot_id);
};

const statusOf = async (sql: SQL, id: number): Promise<string> => {
	const [row] = await sql`SELECT status FROM snapshots
		WHERE snapshot_id = ${id}`;
	return row.status;
};

describe.skipIf(url === undefined)("where a build's snapshot ends up", () => {
	// spec: snapshot-build/the-first-snapshot
	test("the first snapshot ever built publishes [15]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);

		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// Nothing has published, so the hero count has nothing to be compared
		// against — and a first snapshot that could never publish would leave
		// every later one comparing against nothing forever.
		expect(await statusOf(sql, built)).toBe("published");
		expect(await newestPublished(sql)).toBe(built);
	});

	// spec: snapshot-build/validation-passes
	test("a build satisfying every check publishes and is newest [16]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH);
		const first = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await stage(sql, NEW_PATCH);

		const second = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// The count this one is checked against is the first one's, so this is
		// the pass with something to compare rather than the pass with nothing.
		expect(await statusOf(sql, first)).toBe("published");
		expect(await statusOf(sql, second)).toBe("published");
		expect(await newestPublished(sql)).toBe(second);
	});

	// spec: snapshot-build/validation-fails
	test("a refused build leaves the previously published one newest [24]", async () => {
		const sql = await seeded(clean);
		await stage(sql, OLD_PATCH);
		const published = await buildSnapshot(
			sql,
			OLD_PATCH,
			new Date("2026-07-02T00:00:00.000Z"),
		);
		await stage(sql, NEW_PATCH);
		// Refused through the hero count rather than the shares sum the
		// criterion names: shares are computed by normalising a hero's own
		// picks, so no staging the schema admits produces a hero whose shares
		// sum to anything but 1 — that half is `validate.test.ts`'s, on rows
		// handed to the check directly. This table is the one the count is
		// taken from, so a window that picked one hero fewer is this row gone.
		await sql`DELETE FROM staging_hero_stats
			WHERE patch_id = ${NEW_PATCH} AND hero_id = ${OTHER}`;

		const refused = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		expect(await statusOf(sql, refused)).toBe("failed");
		expect(await newestPublished(sql)).toBe(published);
	});

	test("the count comes from the newest published snapshot alone [88]", async () => {
		const sql = await seeded(clean);
		// An older published snapshot holding one hero, a newer one holding
		// two, and — newer than both — a `failed` one holding three. A failed
		// snapshot keeps the statistics it wrote, so it really can hold more
		// heroes than anything published: it is refused for what those rows
		// say, not for how many there are.
		await stage(sql, OLD_PATCH);
		await sql`DELETE FROM staging_hero_stats
			WHERE patch_id = ${OLD_PATCH} AND hero_id = ${OTHER}`;
		await buildSnapshot(sql, OLD_PATCH, new Date("2026-07-02T00:00:00.000Z"));
		await stage(sql, OLD_PATCH);
		await buildSnapshot(sql, OLD_PATCH, new Date("2026-07-03T00:00:00.000Z"));
		await failedHoldingMore(sql);

		await stage(sql, NEW_PATCH);
		const matching = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
		await sql`DELETE FROM staging_hero_stats
			WHERE patch_id = ${NEW_PATCH} AND hero_id = ${OTHER}`;
		const short = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		// Two heroes clear the newest published snapshot's two — and would not
		// clear the failed one's three, which is how a count that read past
		// `status` shows up here.
		expect(await statusOf(sql, matching)).toBe("published");
		// One hero falls below those two, and would clear the *older*
		// published snapshot's one, which is how a reversed ordering shows up.
		expect(await statusOf(sql, short)).toBe("failed");
	});
});

/**
 * A `failed` snapshot holding a hero row for one hero more than staging has.
 *
 * Written directly rather than built: what this stands for is a snapshot
 * refused for what its rows say, whose rows outlive the refusal — and no
 * check 4a implements refuses a snapshot that is otherwise this large.
 */
async function failedHoldingMore(sql: SQL): Promise<void> {
	await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
		VALUES (9000, 'H9000', 'h9000', '/icons/h9000.png', now())
		ON CONFLICT DO NOTHING`;
	const [row] = await sql`INSERT INTO snapshots
			(created_at, patch_id, prior_patch_id, prior_weight, status)
		VALUES (now(), ${OLD_PATCH}, NULL, 0, 'failed') RETURNING snapshot_id`;
	await sql`INSERT INTO hero_stats (snapshot_id, hero_id, matches, contest_rate,
			side_adj_radiant, side_adj_dire, phase_adj_1, phase_adj_2,
			phase_adj_last, sufficient)
		SELECT ${row.snapshot_id}, hero_id, 0, 0, 0, 0, 0, 0, 0, false
		FROM heroes WHERE hero_id >= 9000`;
}
