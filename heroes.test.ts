/**
 * The hero reference under repeated runs: what an insert writes once, what an
 * update is allowed to touch, and what survives a response that omits a hero.
 *
 * The heroes here are numbered from 9000 so that the rows the other suites
 * seed are neither read nor removed by these cases: this file deletes its own
 * range and nothing else, there being no delete path in the module itself.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { opener, requiresDatabase, url } from "./db.fixture.ts";
import { type HeroReference, upsertHeroes } from "./heroes.ts";

requiresDatabase();

/** The run instant an insert is expected to write, and a later one. */
const FIRST_RUN = new Date("2026-08-19T03:00:00.000Z");
const SECOND_RUN = new Date("2026-08-20T03:00:00.000Z");

const CLINKZ: HeroReference = {
	heroId: 9001,
	name: "Clinkz",
	shortName: "clinkz",
	icon: "/icons/clinkz.png",
};

const LINA: HeroReference = {
	heroId: 9002,
	name: "Lina",
	shortName: "lina",
	icon: "/icons/lina.png",
};

describe.skipIf(url === undefined)("upserting the hero reference", () => {
	const open = opener();

	/** A connection over which this file's heroes are absent. */
	const clean = async () => {
		const sql = await open();
		await sql`DELETE FROM heroes WHERE hero_id >= 9000`;
		return sql;
	};

	/** The rows this file's heroes have, by id. */
	const rows = async (sql: SQL) =>
		await sql`SELECT hero_id, name, short_name, icon, first_seen_at
			FROM heroes WHERE hero_id >= 9000 ORDER BY hero_id`;

	test("a run carrying no hero writes nothing and does not fail", async () => {
		// The reference is upserted from a response, and a response carrying no
		// hero is the caller's failure to raise, not this module's to guess at.
		const sql = await clean();

		await upsertHeroes(sql, [], FIRST_RUN);

		expect(await rows(sql)).toEqual([]);
	});

	// spec: hero-reference/a-hero-that-is-new
	test("a hero the tables lack is inserted at the run instant [45]", async () => {
		const sql = await clean();

		await upsertHeroes(sql, [CLINKZ], FIRST_RUN);

		const [row] = await rows(sql);
		expect([row.hero_id, row.name, row.short_name, row.icon]).toEqual([
			CLINKZ.heroId,
			CLINKZ.name,
			CLINKZ.shortName,
			CLINKZ.icon,
		]);
		expect(row.first_seen_at.toISOString()).toBe(FIRST_RUN.toISOString());
	});

	// spec: hero-reference/a-hero-the-response-omits
	test("a hero a later run omits keeps its row and its instant [51]", async () => {
		const sql = await clean();
		await upsertHeroes(sql, [CLINKZ, LINA], FIRST_RUN);

		await upsertHeroes(sql, [LINA], SECOND_RUN);

		const kept = (await rows(sql))[0];
		expect(kept.hero_id).toBe(CLINKZ.heroId);
		expect(kept.first_seen_at.toISOString()).toBe(FIRST_RUN.toISOString());
	});

	// spec: hero-reference/a-hero-that-was-renamed
	test("a renamed hero takes the new name and keeps its instant [52]", async () => {
		const sql = await clean();
		await upsertHeroes(sql, [CLINKZ], FIRST_RUN);

		await upsertHeroes(
			sql,
			[{ ...CLINKZ, name: "Bone Fletcher", shortName: "bone_fletcher" }],
			SECOND_RUN,
		);

		const [row] = await rows(sql);
		expect([row.name, row.short_name]).toEqual([
			"Bone Fletcher",
			"bone_fletcher",
		]);
		expect(row.first_seen_at.toISOString()).toBe(FIRST_RUN.toISOString());
	});

	// spec: hero-reference/a-run-that-fails-after-the-upsert
	test("a failure after the upsert leaves the rows standing [66]", async () => {
		const sql = await clean();
		await upsertHeroes(sql, [CLINKZ], FIRST_RUN);

		// A statement that cannot succeed, standing in for whichever later step
		// of the run fails: these rows are written outside the staging
		// transaction, so nothing rolls them back with it.
		await sql`INSERT INTO heroes VALUES (${CLINKZ.heroId}, 'x', 'x', 'x', now())`.then(
			() => null,
			String,
		);

		expect((await rows(sql)).map((row: { name: string }) => row.name)).toEqual([
			CLINKZ.name,
		]);
	});

	// spec: hero-reference/a-run-that-fails-after-the-upsert
	test("a repeat of a run that failed afterwards changes nothing [66]", async () => {
		const sql = await clean();
		// The failure is the caller's, after the upsert returned: what the
		// criterion fixes is that these rows are not undone by it and that the
		// run that follows writes the same rows again.
		await upsertHeroes(sql, [CLINKZ, LINA], FIRST_RUN);
		const before = await rows(sql);

		await upsertHeroes(sql, [CLINKZ, LINA], SECOND_RUN);

		expect(await rows(sql)).toEqual(before);
	});
});
