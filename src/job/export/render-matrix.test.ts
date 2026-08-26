/**
 * The pair statistics as the client reads them: full matrices keyed by hero
 * id, in both orders.
 *
 * The database stores the two kinds differently — a matchup in both
 * directions, a synergy once under the lower id — and the bundle carries both
 * the same way. What the export derives and what it merely groups is the
 * subject here.
 *
 * `build-pairs.test.ts` covers what the build *stored*; this covers what the
 * export made of it.
 */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import type { SnapshotBundle } from "../../types.ts";
import {
	BUILT_AT,
	HERO,
	NEW_PATCH,
	OTHER,
	seeded,
	stage,
} from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { renderBundle } from "./render.ts";

requiresDatabase();

const clean = cleaner();

const a = String(HERO);
const b = String(OTHER);

/** A bundle rendered over the staging every case here shares. */
const rendered = async (sql: SQL): Promise<SnapshotBundle> => {
	await stage(sql, NEW_PATCH);
	await buildSnapshot(sql, NEW_PATCH, BUILT_AT);
	return renderBundle(sql);
};

describe.skipIf(url === undefined)("the pair matrices", () => {
	// spec: snapshot-export/a-synergy-stored-once
	test("a synergy stored once appears under both hero ids [36]", async () => {
		const bundle = await rendered(await seeded(clean));

		// The schema stores a synergy for `ally_id > hero_id` only, so the
		// other order exists in the bundle by having been derived.
		expect(bundle.synergies[a]?.[b]).toBe(bundle.synergies[b]?.[a] as number);
		// And it is a synergy rather than the 0 an absent one would read as:
		// the fixture stages the pair winning three of five together.
		expect(bundle.synergies[a]?.[b]).toBeGreaterThan(0);
	});

	// spec: snapshot-export/a-matchup-s-mirror
	test("a matchup carries both orders, one negating the other [37]", async () => {
		const bundle = await rendered(await seeded(clean));

		const forward = bundle.matchups[a]?.[b] as number;
		const back = bundle.matchups[b]?.[a] as number;
		// Exactly, not within a tolerance: the build negated one number rather
		// than computing the pair twice, and the export only grouped them.
		expect(forward + back).toBe(0);
		// The fixture stages hero 1 winning six of ten against hero 2, so the
		// forward order is the winning one — without which a matrix of zeros
		// would satisfy the line above.
		expect(forward).toBeGreaterThan(0);
	});

	test("both matrices are keyed by every hero of the pair [36] [37]", async () => {
		const bundle = await rendered(await seeded(clean));

		// Full matrices: a hero that appears only as the other side of a
		// stored row still has a row of its own.
		for (const matrix of [bundle.matchups, bundle.synergies])
			expect(Object.keys(matrix).sort()).toEqual([a, b].sort());
	});

	test("a hero's positions omit every position it was never picked on [38]", async () => {
		const bundle = await rendered(await seeded(clean));

		// The fixture picks hero 1 on position 1 and hero 2 on position 3, and
		// neither anywhere else — so a render inventing keys for the other
		// four, or carrying them at 0, shows up here.
		const positions = Object.fromEntries(
			bundle.heroes.map((hero) => [hero.id, Object.keys(hero.positions)]),
		);
		expect(positions).toEqual({ [HERO]: ["1"], [OTHER]: ["3"] });
	});
});
