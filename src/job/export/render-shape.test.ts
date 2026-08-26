/**
 * What a rendered bundle looks like once it is JSON.
 *
 * Read through `JSON.parse(JSON.stringify(...))` rather than off the object
 * the render returned, because what the client sees is the parsed text: a
 * `Date` survives one and becomes a string in the other, and the criterion is
 * about what arrives.
 *
 * Which snapshot is rendered is `render.test.ts`'s; the key check itself is
 * `keys.test.ts`'s, over the shipped fixture.
 */
import { describe, expect, test } from "bun:test";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { renderBundle } from "./render.ts";

requiresDatabase();

const clean = cleaner();

/** Every key at every depth, in no particular order. */
const keysOf = (value: unknown): string[] =>
	Array.isArray(value)
		? value.flatMap(keysOf)
		: typeof value === "object" && value !== null
			? Object.entries(value).flatMap(([key, held]) => [key, ...keysOf(held)])
			: [];

describe.skipIf(url === undefined)("what a rendered bundle looks like", () => {
	// spec: snapshot-export/renamed-at-the-boundary
	test("every key is renamed at the boundary, at every depth [34]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const bundle = JSON.parse(JSON.stringify(await renderBundle(sql)));

		// Walked here rather than through `checkKeys`, which the render has
		// already run: a node that check forgets to visit is invisible to it
		// and visible to this. Both kinds, since an id key is not camelCase.
		const wrong = keysOf(bundle).filter(
			(key) =>
				!/^[a-z][A-Za-z0-9]*$/.test(key) && !/^(0|[1-9][0-9]*)$/.test(key),
		);
		expect(wrong).toEqual([]);
		// Not vacuous: the walk reaches the depths, not just the root.
		expect(keysOf(bundle)).toContain("radiant");
	});

	test("the four renamed keys arrive as the JSON types declared [35]", async () => {
		const sql = await seeded(clean);
		await stage(sql, NEW_PATCH);
		const built = await buildSnapshot(sql, NEW_PATCH, BUILT_AT);

		const bundle = JSON.parse(JSON.stringify(await renderBundle(sql)));

		expect(bundle.snapshotId).toBe(built);
		expect(bundle.patch.isMajor).toBe(true);
		// Anchored at both ends. `docs/api-design.md` says a timestamp carries
		// an offset, and one without is a different instant on every machine
		// that reads it.
		expect(bundle.createdAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/,
		);
		// The bare calendar date, which is what the shipped contract holds:
		// `src/fixtures/snapshot.json` carries "2026-07-14" for this key.
		expect(bundle.patch.detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
