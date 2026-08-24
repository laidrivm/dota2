/**
 * A whole source, answered from a script: the patch list, the hero reference,
 * the three statistics pulls, and the images the mirror writes — and what the
 * two run suites read the database through afterwards.
 *
 * Two heroes stand in for the reference's 127, so a pair matrix is one row.
 * Every shape is the one recorded in `docs/context/stratz-probe-2026-08.md`;
 * no suite here reaches a network.
 */

import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SQL } from "bun";
import { ingest } from "./ingest.ts";
import type { Query } from "./stratz.ts";

/** A UTC day, as both windows count one. */
export const DAY_MS = 86_400_000;

/** Matches one hero played on one day of the window. */
const PER_DAY = 10;

/**
 * The one capture `pattern` finds in `sent`, or a throw. A fixture that quietly
 * answered `NaN` would fail somewhere else, under the module's name.
 */
function named(sent: string, pattern: RegExp): string {
	const found = pattern.exec(sent);
	if (found?.[1] === undefined)
		throw new Error(`the request matched no ${pattern.source}: ${sent}`);
	return found[1];
}

/** The reference this fixture answers with, numbered clear of other suites. */
export const HEROES = [9001, 9002];

/** A patch released well before any run instant here, and its own id. */
export const PATCH = "z9.41";
export const RELEASED = "2026-08-14T00:00:00.000Z";

/** A run a week into the patch's life, and one a day later. */
export const RUN_AT = new Date("2026-08-21T12:00:00.000Z");
export const NEXT_DAY = new Date("2026-08-22T12:00:00.000Z");

/** What one meta row carries, whichever hero it names. */
export const COUNTS = { matchCount: 10, winCount: 5 };

/** Every staging row these suites' heroes have, in a comparable shape. */
export const staged = async (sql: SQL) => ({
	positions: await sql`SELECT patch_id, hero_id, position, matches, wins
		FROM staging_hero_position_stats WHERE hero_id >= 9000
		ORDER BY hero_id, position`,
	heroes: (
		await sql`SELECT patch_id, hero_id, matches, wins, contest_rate
			FROM staging_hero_stats WHERE hero_id >= 9000 ORDER BY hero_id`
	).map((row: { contest_rate: number }) => ({
		...row,
		// Compared as the `real` it is stored as. Measured on this driver
		// (bun 1.3.14): the first read of a `real` column on a connection
		// answers 5.0285716 and every read after it answers
		// 5.028571605682373 — one float4 value, two JS renderings, so a raw
		// comparison of two reads fails on representation alone.
		contest_rate: Math.fround(row.contest_rate),
	})),
	matchups: await sql`SELECT patch_id, hero_id, enemy_id, matches, wins
		FROM staging_hero_matchups WHERE hero_id >= 9000
		ORDER BY hero_id, enemy_id`,
	synergies: await sql`SELECT patch_id, hero_id, ally_id, matches, wins
		FROM staging_hero_synergies WHERE hero_id >= 9000
		ORDER BY hero_id, ally_id`,
});

/** A run over the source this file scripts, at `at`, mirroring into `dir`. */
export const run = (
	sql: SQL,
	dir: string,
	at: Date,
	options: { pairsFail?: boolean } = {},
) =>
	ingest(
		{
			sql,
			query: sourceQuery(at, options).query,
			fetch: sourceFetch(),
			iconsDir: dir,
		},
		at,
	);

/** A directory the mirror may write into, removed when the file finishes. */
export function icons(): string {
	const dir = mkdtempSync(join(tmpdir(), "d2ass-icons-"));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

/**
 * A `fetch` answering the patch list and every image request. The list carries
 * one entry because `patches.ts` reads the newest as the last of them.
 */
export const sourceFetch = (
	patches: unknown[] = [{ name: PATCH, date: RELEASED }],
) =>
	(async (url: string | URL) =>
		String(url).includes("opendota")
			? new Response(JSON.stringify(patches), {
					headers: { "content-type": "application/json" },
				})
			: new Response(new Uint8Array([137, 80, 78, 71]), {
					headers: { "content-type": "image/png" },
				})) as unknown as typeof globalThis.fetch;

/**
 * A `query` answering all four documents a run issues.
 *
 * The meta rows are one per hero per day asked for, so a window's length
 * reaches the staged counts and two runs over different windows can be told
 * apart. The ban rows sit on the window's last day, which is always the day
 * before the run instant's own whatever the patch's age.
 */
export function sourceQuery(at: Date, options: { pairsFail?: boolean } = {}) {
	const query: Query = async (sent) => {
		if (sent.includes("constants { heroes"))
			return {
				data: {
					constants: {
						heroes: HEROES.map((id, n) => ({
							id,
							displayName: `Hero ${n}`,
							shortName: `hero${n}`,
						})),
					},
				},
			};
		if (sent.includes("winDay")) {
			// Checked rather than coerced: a document that stopped naming its
			// window would otherwise answer an empty list, which reads as a
			// source with no rows rather than as a fixture that missed.
			const take = Number(named(sent, /take: (\d+)/));
			return {
				data: {
					heroStats: {
						winDay: HEROES.flatMap((heroId) =>
							Array.from({ length: take }, () => ({
								heroId,
								matchCount: PER_DAY,
								winCount: PER_DAY / 2,
							})),
						),
					},
				},
			};
		}
		if (sent.includes("banDay")) {
			// The window's last day, which is the one before the run instant's.
			const day = Math.floor(at.getTime() / DAY_MS) - 1;
			return {
				data: {
					heroStats: {
						banDay: HEROES.map((heroId) => ({
							heroId,
							day,
							matchCount: 2,
						})),
					},
				},
			};
		}
		if (sent.includes("matchUp")) {
			if (options.pairsFail)
				throw new Error("the API answered 500; 4 attempts made");
			const heroId = Number(named(sent, /heroId: (\d+)/));
			const rows = HEROES.filter((id) => id !== heroId).map((heroId2) => ({
				heroId2,
				matchCount: 6,
				winCount: 3,
			}));
			return { data: { heroStats: { matchUp: [{ vs: rows, with: rows }] } } };
		}
		throw new Error(
			`the fixture was asked something it does not answer: ${sent}`,
		);
	};
	return { query };
}
