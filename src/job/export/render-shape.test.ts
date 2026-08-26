/**
 * What a rendered bundle looks like once it is JSON.
 *
 * Read through `JSON.parse(JSON.stringify(...))` rather than off the object
 * the render returned, because what the client sees is the parsed text: a
 * `Date` survives one and becomes a string in the other, and the criterion is
 * about what arrives.
 *
 * Which snapshot is rendered is `render.test.ts`'s; the key check itself is
 * `contract.test.ts`'s, over the shipped fixture.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BUILT_AT, NEW_PATCH, seeded, stage } from "../build/build.fixture.ts";
import { buildSnapshot } from "../build/build.ts";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { renderBundle, utcDate } from "./render.ts";

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
		// The instant itself, not a pattern it fits: a shape test passes for
		// `9999-99-99` and for a timestamp an hour out, and what has to be true
		// is that this is the build instant, carrying an offset as
		// `docs/api-design.md` says a timestamp does.
		expect(bundle.createdAt).toBe(BUILT_AT.toISOString());
		// The bare calendar date, which is what the shipped contract holds, and
		// the date on the UTC timeline: `build.fixture.ts` seeds this patch at
		// midnight UTC, so a slice taken in local time reads the day before
		// wherever the offset is negative — which a pattern cannot see.
		expect(bundle.patch.detectedAt).toBe("2026-08-01");
	});
});

/** The zone this file found, which the block below must give back. */
const AT_LOAD = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("the calendar date the bundle carries", () => {
	const zone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = "America/New_York";
	});
	afterAll(() => {
		// `UTC` rather than deleting the variable where it arrived unset, and
		// measured rather than assumed on both halves: `bun test` starts in UTC
		// whatever the machine's zone is, so UTC is the zone to give back — and
		// deleting `TZ` in bun 1.3.14 leaves the last value that was assigned
		// rather than restoring the system one, so a delete here would hand the
		// next file New York.
		process.env.TZ = zone ?? "UTC";
	});

	test("is the UTC one, not the running machine's [35]", () => {
		// Asserted rather than assumed: a `TZ` assignment that did not take
		// would leave this in UTC, where a date read off the machine's calendar
		// passes exactly as one read off the UTC timeline does.
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
			"America/New_York",
		);
		// Midnight UTC is the previous evening in New York, so a date taken
		// from the local calendar reads 2026-07-31 here.
		expect(utcDate(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
	});
});

test("the zone the block above set is given back", () => {
	// Nothing else in this file would notice — every case above reads UTC — so
	// the file that pays for a restore that did not take is some later one,
	// which is why this is asserted here rather than assumed.
	expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(AT_LOAD);
});
