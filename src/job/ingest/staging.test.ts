/**
 * The staging write on its own: what a newer patch ages out, what one bad row
 * takes down with it, and what an empty run writes.
 *
 * The cases about a whole run — a repeat, a day's difference, a pull that
 * fails — are `ingest.test.ts`'s.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { opener, requiresDatabase, url } from "../db.fixture.ts";
import { type Staged, writeStaging } from "./staging.ts";

requiresDatabase();

/** Three patches, oldest first, so a third run can age the first out. */
const PATCHES = [
	["z9.38", "2026-05-01T00:00:00.000Z"],
	["z9.39", "2026-06-01T00:00:00.000Z"],
	["z9.40", "2026-07-01T00:00:00.000Z"],
] as const;

const HERO = 9001;
const OTHER = 9002;

/** One patch's worth of rows, told apart by `matches`. */
const rows = (matches: number): Staged => ({
	positions: [{ heroId: HERO, position: 1, matches, wins: 0 }],
	heroes: [{ heroId: HERO, matches, wins: 0, contestRate: 0.5 }],
	matchups: [{ heroId: HERO, otherId: OTHER, matches, wins: 0 }],
	synergies: [{ heroId: HERO, otherId: OTHER, matches, wins: 0 }],
});

describe.skipIf(url === undefined)("what one write leaves behind", () => {
	const open = opener();

	/** A connection holding `patches` and this file's heroes, and no staging row. */
	const clean = async (
		patches: readonly (readonly [string, string])[] = PATCHES,
	) => {
		const sql = await open();
		await sql`DELETE FROM staging_hero_position_stats WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_stats WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_matchups WHERE hero_id >= 9000`;
		await sql`DELETE FROM staging_hero_synergies WHERE hero_id >= 9000`;
		await sql`DELETE FROM heroes WHERE hero_id >= 9000`;
		await sql`DELETE FROM patches WHERE patch_id LIKE 'z9.%'`;
		for (const heroId of [HERO, OTHER])
			await sql`INSERT INTO heroes (hero_id, name, short_name, icon, first_seen_at)
				VALUES (${heroId}, ${`H${heroId}`}, ${`h${heroId}`},
					${`/icons/h${heroId}.png`}, now())`;
		for (const [patchId, releasedAt] of patches)
			await sql`INSERT INTO patches (patch_id, base_version, is_major, detected_at)
				VALUES (${patchId}, ${patchId}, true, ${new Date(releasedAt)})`;
		return sql;
	};

	/** Which patches each staging table still holds rows for. */
	const held = async (sql: SQL) => ({
		positions:
			await sql`SELECT DISTINCT patch_id FROM staging_hero_position_stats
			WHERE hero_id >= 9000 ORDER BY patch_id`,
		heroes: await sql`SELECT DISTINCT patch_id FROM staging_hero_stats
			WHERE hero_id >= 9000 ORDER BY patch_id`,
		matchups: await sql`SELECT DISTINCT patch_id FROM staging_hero_matchups
			WHERE hero_id >= 9000 ORDER BY patch_id`,
		synergies: await sql`SELECT DISTINCT patch_id FROM staging_hero_synergies
			WHERE hero_id >= 9000 ORDER BY patch_id`,
	});

	// spec: snapshot-ingest/rows-from-an-older-patch
	test("a newer patch keeps the previous one and drops what is older [38]", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.38", rows(1));
		await writeStaging(sql, "z9.39", rows(2));

		await writeStaging(sql, "z9.40", rows(3));

		// Two patches kept, and the retention is what ages the third out — no
		// sweep runs on a schedule.
		const kept = [{ patch_id: "z9.39" }, { patch_id: "z9.40" }];
		expect(await held(sql)).toEqual({
			positions: kept,
			heroes: kept,
			matchups: kept,
			synergies: kept,
		});
	});

	// spec: snapshot-ingest/rows-from-an-older-patch
	test("the previous patch's own rows are left as they were [38]", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.39", rows(2));

		await writeStaging(sql, "z9.40", rows(3));

		const [row] = await sql`SELECT matches FROM staging_hero_position_stats
				WHERE patch_id = 'z9.39'`;
		expect(row?.matches).toBe(2);
	});

	// spec: snapshot-ingest/a-run-that-fails-part-way
	test("one row the table refuses takes the whole write with it [37]", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.40", rows(5));

		const bad = rows(7);
		// More wins than matches, which `staging_hero_matchups` declares against
		// and the pulls refuse before this — the last edge, reached here only by
		// handing the write a row nothing else would.
		bad.matchups = [{ heroId: HERO, otherId: OTHER, matches: 1, wins: 9 }];
		const failed = await writeStaging(sql, "z9.40", bad).then(
			() => null,
			(error: Error) => error.message,
		);

		expect(failed).not.toBeNull();
		// The delete that opened the transaction is rolled back with it, so the
		// previous run's rows are still there rather than gone with nothing
		// written in their place.
		const [row] = await sql`SELECT matches FROM staging_hero_position_stats
				WHERE patch_id = 'z9.40'`;
		expect(row?.matches).toBe(5);
	});

	// spec: snapshot-ingest/a-hero-the-window-holds-no-picks-for
	test("a zero-pick hero row meets the bounds the table declares [97]", async () => {
		const sql = await clean();
		const staged = rows(3);
		// Reachable only since the totals came from the reference: a hero the
		// window has no sample of meets `CHECK (wins BETWEEN 0 AND matches)`
		// with both of its bounds at 0.
		staged.heroes = [
			...staged.heroes,
			{ heroId: OTHER, matches: 0, wins: 0, contestRate: 0 },
		];

		await writeStaging(sql, "z9.40", staged);

		const [row] = await sql`SELECT matches, wins FROM staging_hero_stats
			WHERE patch_id = 'z9.40' AND hero_id = ${OTHER}`;
		expect(row).toEqual({ matches: 0, wins: 0 });
	});

	test("the suite covers every staging table but the two nothing fills", async () => {
		// Stated as an exemption rather than left implicit in the four tables
		// the helpers above name: a staging table added later would otherwise
		// be cleared by nothing and compared by nothing, and every case here
		// would pass over it in silence.
		const sql = await open();
		const found = await sql`SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name LIKE 'staging\_%'
			ORDER BY table_name`;

		expect(
			found
				.map((row: { table_name: string }) => row.table_name)
				// Side and phase are this change's stated non-goals: the tables
				// exist so the build can query them and nothing writes them.
				.filter(
					(name: string) =>
						name !== "staging_hero_sides" && name !== "staging_hero_phases",
				),
		).toEqual([
			"staging_hero_matchups",
			"staging_hero_position_stats",
			"staging_hero_stats",
			"staging_hero_synergies",
		]);
	});

	// spec: snapshot-ingest/rows-from-an-older-patch
	test("a first run with no earlier patch keeps its own rows [38]", async () => {
		// The branch where there is no previous patch to measure retention
		// against: the two readings of it, "drop nothing" and "drop everything
		// else", are indistinguishable on a table that holds three patches.
		const sql = await clean([PATCHES[0]]);

		await writeStaging(sql, "z9.38", rows(1));

		expect(await held(sql)).toEqual({
			positions: [{ patch_id: "z9.38" }],
			heroes: [{ patch_id: "z9.38" }],
			matchups: [{ patch_id: "z9.38" }],
			synergies: [{ patch_id: "z9.38" }],
		});
	});

	// spec: snapshot-ingest/rows-from-an-older-patch
	test("a run under an older patch leaves a newer patch's rows [38]", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.40", rows(3));

		// A backfill, or last night's job repeated: retention is stated against
		// the previous patch's release rather than a count of patches, so what
		// is newer than the one being written survives.
		await writeStaging(sql, "z9.39", rows(2));

		expect(await held(sql)).toEqual({
			positions: [{ patch_id: "z9.39" }, { patch_id: "z9.40" }],
			heroes: [{ patch_id: "z9.39" }, { patch_id: "z9.40" }],
			matchups: [{ patch_id: "z9.39" }, { patch_id: "z9.40" }],
			synergies: [{ patch_id: "z9.39" }, { patch_id: "z9.40" }],
		});
	});

	test("a patch no row holds is refused before anything is deleted", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.40", rows(5));

		const failed = await writeStaging(sql, "z9.99", rows(1)).then(
			() => null,
			(error: Error) => error.message,
		);

		expect(failed).toContain("which no row holds");
		const [row] = await sql`SELECT matches FROM staging_hero_position_stats
			WHERE patch_id = 'z9.40'`;
		expect(row?.matches).toBe(5);
	});

	test("a write carrying no row clears the patch and adds nothing", async () => {
		const sql = await clean();
		await writeStaging(sql, "z9.40", rows(5));

		await writeStaging(sql, "z9.40", {
			positions: [],
			heroes: [],
			matchups: [],
			synergies: [],
		});

		// The bulk insert builds its column list from the rows, so an empty
		// array has to be guarded rather than passed through.
		expect(await held(sql)).toEqual({
			positions: [],
			heroes: [],
			matchups: [],
			synergies: [],
		});
	});
});
