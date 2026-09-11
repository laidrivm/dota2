/**
 * What the run dates itself by: the patch the source lists, the patch the
 * table already holds, and the ways the source can leave a run with neither.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { SQL } from "bun";
import { cleaner, requiresDatabase, url } from "../db.fixture.ts";
import { detectPatch } from "./patches.ts";
import { json, settle, stalls, stub } from "./stratz.fixture.ts";

requiresDatabase();

/** Attempts one request gets, the wait before the first retry, and how long
 * one attempt may stay open. */
const ATTEMPTS = 4;
const FIRST_BACKOFF_MS = 1000;
const ATTEMPT_TIMEOUT_MS = 30_000;

/** The instant a run is taken at, and a release well behind it. */
const RUN_AT = new Date("2026-08-20T03:00:00.000Z");
const RELEASED = "2026-03-24T22:00:00.000Z";

/** A `fetch` answering one patch list, and the calls it was asked to make. */
const listing = (entries: unknown[]) => stub([json(entries)]);

/** The message `work` failed with, or `null` where it did not fail. */
const failure = (work: Promise<unknown>) =>
	work.then(
		() => null,
		(error: Error) => error.message,
	);

/** What a connection nothing may reach says when something reaches it. */
const REACHED = "the database was reached";

/**
 * A connection that fails on any use. The source failures below all have to
 * end the run before a row is written, and the smallest evidence of that is a
 * database no statement could have run against.
 */
const untouched = (() => {
	throw new Error(REACHED);
}) as unknown as SQL;

describe("a patch list that cannot be read", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	/** A request that never reaches the source at all. */
	const unreachable = async () => {
		throw new Error("no route to host");
	};

	// spec: hero-reference/the-source-cannot-be-reached
	test("a source unreachable after its retries fails the run [67]", async () => {
		const { fetch, calls } = stub([unreachable]);

		const failed = await failure(settle(detectPatch(untouched, RUN_AT, fetch)));

		expect(failed).toMatch(/the patch list could not be read/);
		expect(calls).toHaveLength(ATTEMPTS);
	});

	// spec: hero-reference/the-source-cannot-be-reached
	test("an attempt with no complete response is abandoned and retried", async () => {
		// The bound is on a complete response rather than on a status, which is
		// why the stall the fixture scripts never answers at all: a run that
		// waited on one would never reach the single outcome the job promises.
		const { fetch, calls } = stub([
			stalls(),
			json([{ name: "7.41", date: RELEASED }]),
		]);

		const failed = await failure(settle(detectPatch(untouched, RUN_AT, fetch)));

		expect(failed).toBe(REACHED);
		expect((calls[1]?.at ?? 0) - (calls[0]?.at ?? 0)).toBe(
			ATTEMPT_TIMEOUT_MS + FIRST_BACKOFF_MS,
		);
	});

	// spec: hero-reference/the-source-cannot-be-reached
	test("a body that does not parse is retried, not read as no patch", async () => {
		// A vendor's error page served under a `200` is the shape this catches.
		// Read as a body it would be "the source listed no patch", which names
		// the wrong thing and would send a reader to the source's contents.
		const { fetch, calls } = stub([
			async () =>
				new Response("<html>upstream</html>", {
					headers: { "content-type": "application/json" },
				}),
		]);

		const failed = await failure(settle(detectPatch(untouched, RUN_AT, fetch)));

		expect(failed).toMatch(/the patch list could not be read/);
		expect(calls).toHaveLength(ATTEMPTS);
	});

	test("a source that answers on a later attempt is not a failure", async () => {
		// The waiting is what a retry buys, so the gap is asserted rather than
		// the outcome alone — and the outcome asserted is that the run carried
		// on to the database, which a policy that gave up would never reach.
		const { fetch, calls } = stub([
			async () => new Response("boom", { status: 500 }),
			json([{ name: "7.41", date: RELEASED }]),
		]);

		const failed = await failure(settle(detectPatch(untouched, RUN_AT, fetch)));

		expect(failed).toBe(REACHED);
		expect((calls[1]?.at ?? 0) - (calls[0]?.at ?? 0)).toBe(FIRST_BACKOFF_MS);
	});
});

describe("a patch list carrying nothing usable", () => {
	// spec: hero-reference/the-source-answers-with-nothing-usable
	test.each([
		["an empty list", [], /listed no patch/],
		["a body that is not a list", { patches: [] }, /listed no patch/],
		["a newest entry with no name", [{ date: RELEASED }], /carries no name/],
		["a newest entry that is null", [null], /carries no name/],
		[
			"a newest entry with a blank name",
			[{ name: "  ", date: RELEASED }],
			/carries no name/,
		],
		[
			"a newest entry with no release instant",
			// Two entries, the usable one first: a list is read for the patch it
			// ends on, so an earlier entry does not rescue the run.
			[{ name: "7.40", date: RELEASED }, { name: "7.41" }],
			/carries no release instant/,
		],
		[
			"a newest entry whose instant does not parse",
			[{ name: "7.41", date: "soon" }],
			/carries no release instant/,
		],
	])("%s fails the run naming which [68]", async (_, body, named) => {
		const { fetch } = stub([json(body)]);

		const failed = await failure(detectPatch(untouched, RUN_AT, fetch));

		// The failure is the source's rather than the database's, which is what
		// says the run did not fall back to the patch `patches` already holds:
		// reading that table is what `untouched` refuses.
		expect(failed).not.toBe(REACHED);
		expect(failed).toMatch(named);
	});
});

describe.skipIf(url === undefined)("the patch a run is dated by", () => {
	/**
	 * A connection over a `patches` table holding nothing.
	 *
	 * The names below are sentinel ones, inside the `z9.` range the shared
	 * cleaner reclaims, because nothing detection does reads a version as a
	 * number: the name is held verbatim, and the only thing parsed out of it is
	 * whether it ends in a letter. Real ones bought nothing for that and cost
	 * the whole table — no `WHERE` can name this file's rows, and a delete that
	 * wide fails under the foreign keys of whatever snapshot and staging rows
	 * the file before it left standing.
	 */
	const empty = cleaner();

	/** Every patch held, oldest release first. */
	const held = async (sql: SQL) =>
		(await sql`SELECT patch_id FROM patches ORDER BY detected_at`).map(
			(row: { patch_id: string }) => row.patch_id,
		);

	/** Detect against a list whose last member is the newest patch. */
	const detect = (sql: SQL, entries: unknown[], at = RUN_AT) =>
		detectPatch(sql, at, listing(entries).fetch);

	// spec: hero-reference/a-patch-the-table-lacks
	test("a first run inserts the patch the source lists [39]", async () => {
		const sql = await empty();

		const current = await detect(sql, [{ name: "z9.51", date: RELEASED }]);

		expect(current.patchId).toBe("z9.51");
		expect(await held(sql)).toEqual(["z9.51"]);
	});

	// spec: hero-reference/a-patch-the-table-lacks
	test("the patch detected is the one the list ends on [39]", async () => {
		// The source's own order is what names the newest patch, rather than an
		// ordering by date taken here — an entry carrying no date has no place
		// in one, and it is the entry this run depends on.
		const sql = await empty();

		const current = await detect(sql, [
			{ name: "z9.50", date: "2025-12-16T00:00:00.000Z" },
			{ name: "z9.51", date: RELEASED },
		]);

		expect(current.patchId).toBe("z9.51");
		expect(await held(sql)).toEqual(["z9.51"]);
	});

	// spec: hero-reference/a-patch-the-table-lacks
	test("it is held at the release instant, not the run instant [40]", async () => {
		const sql = await empty();

		const current = await detect(sql, [{ name: "z9.51", date: RELEASED }]);

		expect(current.detectedAt.toISOString()).toBe(RELEASED);
	});

	// spec: hero-reference/a-name-with-a-trailing-letter
	test.each([
		["z9.51", true, "z9.51"],
		["z9.51b", false, "z9.51"],
	])("%s is held under its base version [42]", async (name, major, base) => {
		const sql = await empty();

		const current = await detect(sql, [{ name, date: RELEASED }]);

		expect([current.isMajor, current.baseVersion]).toEqual([major, base]);
	});

	// spec: hero-reference/a-patch-already-recorded
	test("a second run leaves the instant the first one wrote [43]", async () => {
		const sql = await empty();
		await detect(sql, [{ name: "z9.51", date: RELEASED }]);

		const current = await detect(sql, [
			{ name: "z9.51", date: "2026-08-19T00:00:00.000Z" },
		]);

		expect(current.detectedAt.toISOString()).toBe(RELEASED);
	});

	// spec: hero-reference/the-current-patch
	test("a release listed ahead of the run is held, not current [41]", async () => {
		const sql = await empty();
		await detect(sql, [{ name: "z9.51", date: RELEASED }]);

		const current = await detect(sql, [
			{ name: "z9.52", date: "2026-09-01T00:00:00.000Z" },
		]);

		expect(current.patchId).toBe("z9.51");
		expect(await held(sql)).toEqual(["z9.51", "z9.52"]);
	});

	// spec: hero-reference/the-current-patch
	test("a patch released at the run instant itself is current [41]", async () => {
		// The rule is "not after the run instant", so the instant itself is
		// inside it — the one boundary a `<` rather than a `<=` would move.
		const sql = await empty();

		const current = await detect(sql, [
			{ name: "z9.51", date: RUN_AT.toISOString() },
		]);

		expect(current.patchId).toBe("z9.51");
	});

	// spec: hero-reference/the-current-patch
	test("a run before every held release fails rather than dating itself", async () => {
		const sql = await empty();

		const failed = await failure(
			detect(sql, [{ name: "z9.51", date: RELEASED }], new Date("2026-01-01")),
		);

		expect(failed).toMatch(/z9\.51/);
	});
});
