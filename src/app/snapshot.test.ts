import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import rawFixture from "../fixtures/snapshot.json" with { type: "json" };
import type { SnapshotBundle } from "../types.ts";
import {
	CACHE_KEY,
	formatProvenance,
	isBundle,
	loadSnapshot,
} from "./snapshot.ts";

const fixture = rawFixture as unknown as SnapshotBundle;

/**
 * The repository root, for the one case that reads this module from a second
 * process. Converted rather than taken as `.pathname`, which stays
 * percent-encoded and names no directory a shell can enter.
 */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const realFetch = globalThis.fetch;
let store: Map<string, string>;

/** Bun has no localStorage; every test gets a fresh in-memory one. */
function installStorage() {
	store = new Map<string, string>();
	(globalThis as { localStorage?: unknown }).localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, v);
		},
	};
}

function stubFetch(
	respond: (init?: RequestInit) => Response | Promise<Response>,
) {
	globalThis.fetch = ((_url: string, init?: RequestInit) =>
		respond(init)) as unknown as typeof fetch;
}

beforeEach(installStorage);

afterEach(() => {
	globalThis.fetch = realFetch;
	(globalThis as { localStorage?: unknown }).localStorage = undefined;
});

describe("payload validation", () => {
	test("accepts the shipped fixture", () => {
		expect(isBundle(fixture)).toBe(true);
	});

	test.each([
		["snapshotId", { ...fixture, snapshotId: undefined }],
		["patch.id", { ...fixture, patch: { ...fixture.patch, id: undefined } }],
		["createdAt", { ...fixture, createdAt: undefined }],
		["a non-empty heroes array", { ...fixture, heroes: [] }],
	])("rejects a payload missing %s", (_label, payload) => {
		expect(isBundle(payload)).toBe(false);
	});

	test("rejects values that are not objects at all", () => {
		for (const value of [null, undefined, 7, "{}", []]) {
			expect(isBundle(value)).toBe(false);
		}
	});

	test.each([
		"",
		"20260719",
		"2026-13-19T00:00:00Z",
		"2026-07-45T00:00:00Z",
		"2026-07-19T99:00:00Z",
		"2026-07-19T00:99:00Z",
		"2026-07-19Txx",
	])("rejects createdAt %p, which the header could not format", (createdAt) => {
		expect(isBundle({ ...fixture, createdAt })).toBe(false);
	});

	test("every accepted createdAt can actually be formatted", () => {
		// isBundle is the only thing standing between a payload and
		// Intl.format, which throws on an unparseable date.
		for (const createdAt of ["2026-07-19T03:00:00Z", "2026-02-28T23:59:59Z"]) {
			const bundle = { ...fixture, createdAt };
			expect(isBundle(bundle)).toBe(true);
			expect(() => formatProvenance(bundle)).not.toThrow();
		}
	});

	test.each([
		["a null entry", [null]],
		["an entry without an id", [{ name: "Clinkz" }]],
		["an entry without a name", [{ id: 56 }]],
	])("rejects a heroes array with %s", (_label, heroes) => {
		expect(isBundle({ ...fixture, heroes })).toBe(false);
	});
});

describe("fetch and cache", () => {
	test("a valid response becomes the active bundle and is cached", async () => {
		stubFetch(() => Response.json(fixture));

		const bundle = await loadSnapshot();

		expect(bundle?.snapshotId).toBe(fixture.snapshotId);
		expect(JSON.parse(store.get(CACHE_KEY) as string).snapshotId).toBe(
			fixture.snapshotId,
		);
	});

	test("a rejected fetch falls back to the cache", async () => {
		store.set(CACHE_KEY, JSON.stringify(fixture));
		stubFetch(() => {
			throw new TypeError("network error");
		});

		expect((await loadSnapshot())?.patch.id).toBe(fixture.patch.id);
	});

	test("a non-JSON body falls back to the cache", async () => {
		store.set(CACHE_KEY, JSON.stringify(fixture));
		stubFetch(() => new Response("<html>502</html>"));

		expect((await loadSnapshot())?.patch.id).toBe(fixture.patch.id);
	});

	test("an HTTP error falls back to the cache", async () => {
		store.set(CACHE_KEY, JSON.stringify(fixture));
		stubFetch(() => new Response("nope", { status: 500 }));

		expect((await loadSnapshot())?.patch.id).toBe(fixture.patch.id);
	});

	test("a corrupt cached value counts as no cache", async () => {
		store.set(CACHE_KEY, "{not json");
		stubFetch(() => {
			throw new TypeError("network error");
		});

		expect(await loadSnapshot()).toBeNull();
	});

	test("a cached value of the wrong shape counts as no cache", async () => {
		store.set(CACHE_KEY, JSON.stringify({ snapshotId: 1 }));
		stubFetch(() => {
			throw new TypeError("network error");
		});

		expect(await loadSnapshot()).toBeNull();
	});

	test("a stalled fetch is given a deadline, then falls back", async () => {
		let signal: AbortSignal | null | undefined;
		stubFetch((init) => {
			signal = init?.signal;
			// What AbortSignal.timeout does once the deadline passes.
			return new Promise<Response>((_, reject) =>
				setTimeout(
					() => reject(new DOMException("timed out", "TimeoutError")),
					10,
				),
			);
		});
		store.set(CACHE_KEY, JSON.stringify(fixture));

		const bundle = await loadSnapshot();

		// Without this the test would pass on a fetch that can hang forever.
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(bundle?.patch.id).toBe(fixture.patch.id);
	});

	test("a cold cache with a dead network is the error state", async () => {
		stubFetch(() => {
			throw new TypeError("network error");
		});

		expect(await loadSnapshot()).toBeNull();
	});

	test("a rejected cache write leaves the fetched bundle usable", async () => {
		(globalThis as { localStorage?: unknown }).localStorage = {
			getItem: () => null,
			setItem: () => {
				throw new DOMException("quota exceeded", "QuotaExceededError");
			},
		};
		stubFetch(() => Response.json(fixture));

		expect((await loadSnapshot())?.snapshotId).toBe(fixture.snapshotId);
	});

	test("a new snapshotId becomes active and leaves the session alone", async () => {
		const session = JSON.stringify({ v: 1, side: "dire", myRole: 2 });
		store.set("draft.session", session);
		store.set(CACHE_KEY, JSON.stringify(fixture));
		stubFetch(() => Response.json({ ...fixture, snapshotId: 99 }));

		expect((await loadSnapshot())?.snapshotId).toBe(99);
		expect(store.get("draft.session")).toBe(session);
	});
});

describe("provenance line", () => {
	test("renders patch id and snapshot date", () => {
		expect(formatProvenance(fixture)).toBe("patch 7.41d · snapshot Jul 19");
	});

	test("drops the leading zero on the first of a month", () => {
		const bundle = { ...fixture, createdAt: "2026-07-01T03:00:00Z" };
		expect(formatProvenance(bundle)).toBe("patch 7.41d · snapshot Jul 1");
	});

	test("uses the date the field carries, not the viewer's day", () => {
		// 23:30 UTC is already the next day east of UTC and the previous day
		// west of it; the line must read the same everywhere. Read here in the
		// zone the run carries, which is UTC — so what separates the two
		// readings is the case below, not this one.
		const bundle = { ...fixture, createdAt: "2026-07-19T23:30:00Z" };
		expect(formatProvenance(bundle)).toBe("patch 7.41d · snapshot Jul 19");
	});

	test("reads the same day in a zone nine hours ahead of UTC", () => {
		// Spawned rather than pinned with a `beforeAll`: the formatter is built
		// when the module loads and keeps the zone it was constructed under, so
		// a `TZ` assigned after that reaches nothing and this case would pass
		// against a formatter that had lost its `timeZone: "UTC"`. Measured
		// against bun 1.3.14 — the same instant reads `Jul 20` without it.
		const ran = Bun.spawnSync(
			[
				"bun",
				"-e",
				'const { formatProvenance } = await import("./src/app/snapshot.ts");' +
					' console.log(formatProvenance({ patch: { id: "7.41d" },' +
					' createdAt: "2026-07-19T23:30:00Z" }));',
			],
			{ cwd: ROOT, env: { ...process.env, TZ: "Asia/Tokyo" } },
		);

		expect([ran.exitCode, ran.stdout.toString().trim()]).toEqual([
			0,
			"patch 7.41d · snapshot Jul 19",
		]);
	});

	test("normalises a non-UTC offset to UTC", () => {
		// The pipeline writes `Z`; if it ever stops, this is what happens
		// rather than a silent per-viewer difference.
		const bundle = { ...fixture, createdAt: "2026-07-19T02:00:00+05:00" };
		expect(formatProvenance(bundle)).toBe("patch 7.41d · snapshot Jul 18");
	});
});

/**
 * The fixture stands in for a bundle wherever one has not been fetched, so
 * what it spells `short` is what the board looks a palette token up under.
 * Its heroes are hand-written rows rather than ingested ones, which is the
 * only place in the tree where the two spellings could drift apart again.
 */
// spec: hero-palette/a-hero-whose-slug-and-display-name-diverge
// spec: hero-palette/a-slug-carrying-a-separator
describe("the slug the fixture carries", () => {
	test("every hero is spelled the way the mirror names its files", () => {
		const wrong = fixture.heroes
			.filter((hero) => !/^[a-z0-9_-]+$/.test(hero.short))
			.map((hero) => `${hero.name} ${hero.short}`);
		expect(wrong).toEqual([]);
	});

	test.each([
		["Zeus", "zuus"],
		["Clockwerk", "rattletrap"],
		["Wraith King", "skeleton_king"],
		["Anti-Mage", "antimage"],
	])("%s carries the source's own name for it, %s", (name, short) => {
		expect(fixture.heroes.find((hero) => hero.name === name)?.short).toBe(
			short,
		);
	});

	test("no two heroes share one", () => {
		// Each `short` above is well-formed on its own, so a row copied and
		// half-edited passes every other case here and puts two heroes on one
		// colour in the board.
		const shorts = fixture.heroes.map((hero) => hero.short);
		expect(shorts).toHaveLength(new Set(shorts).size);
	});

	// spec: hero-palette/the-fixture-s-two-derived-spellings
	test("a hero's icon is its own short, not a second spelling", () => {
		const wrong = fixture.heroes
			.filter((hero) => hero.icon !== `/icons/${hero.short}.png`)
			.map((hero) => `${hero.short} ${hero.icon}`);
		expect(wrong).toEqual([]);
	});
});
