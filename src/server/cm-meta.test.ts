/**
 * `POST` and `GET /api/cm/meta` (cm-meta-import): which uploads are taken, the
 * shape of what is answered, and the store behind them, over a directory of
 * the case's own.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmApi } from "./cm/api.ts";
import { metaFile, rows } from "./cm/d2pt.fixture.ts";
import { readStore, writePosition } from "./cm/meta-store.ts";
import {
	cookieOf,
	PASSWORD,
	problem,
	signIn,
	T0,
} from "./cm-access.fixture.ts";

// The ids the served snapshot would know: more than the 50 an upload needs.
const ids = Array.from({ length: 130 }, (_, i) => i + 1);
const known = new Set(ids);
let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "cm-meta-"));
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function signedIn() {
	const app = cmApi({
		password: PASSWORD,
		now: () => T0,
		dataDir: dir,
		knownHeroes: async () => known,
	});
	const cookie = cookieOf(await signIn(app));
	const post = (body: string) =>
		app.request("/api/cm/meta", { method: "POST", headers: { cookie }, body });
	const get = () => app.request("/api/cm/meta", { headers: { cookie } });
	return { post, get };
}

// spec: cm-meta-import/a-valid-upload-for-one-position
test("a valid pos 3 upload is stored, and the other positions stay as they were", async () => {
	const { post, get } = await signedIn();
	const response = await post(metaFile(rows(ids, 60)));
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		position: 3,
		heroes: 60,
		patch: "7.41f",
		uploadedAt: new Date(T0).toISOString(),
	});
	const { positions } = (await (await get()).json()) as {
		positions: Record<string, unknown>;
	};
	expect(Object.keys(positions).sort()).toEqual(["1", "2", "3", "4", "5"]);
	expect(positions["1"]).toBeNull();
	const third = positions["3"] as { heroes: Record<string, unknown> };
	expect(Object.keys(third.heroes)).toHaveLength(60);
	// Every field of a hero present, an absent value null.
	expect(third.heroes[String(ids[0])]).toEqual({
		rating: 40,
		tier: "A",
		matches: 1000,
		winRate: 0.5,
		phaseWinRates: { first: 0.52, second: 0.5, last: null },
	});
});

test("nothing uploaded yet reads as five empty positions", async () => {
	const { get } = await signedIn();
	expect(await (await get()).json()).toEqual({
		positions: { "1": null, "2": null, "3": null, "4": null, "5": null },
	});
});

// spec: cm-meta-import/an-upload-that-is-not-the-meta-file
describe("an upload that is not the meta file leaves the store as it was", () => {
	const ratedWith = (...ratings: (number | null)[]) =>
		rows(ids, 60).map((row, i) => ({
			...row,
			d2pt_rating: ratings[i] ?? row.d2pt_rating,
		}));
	test.each([
		["text that is not JSON", "{not json"],
		["JSON of another page", JSON.stringify({ type: "data", nodes: [] })],
		["49 known rated heroes", metaFile(rows(ids, 49))],
		[
			"50 known heroes with null ratings",
			metaFile(
				rows(ids, 60)
					.map((row, i) => (i < 10 ? { ...row, d2pt_rating: null } : row))
					.slice(0, 59),
			),
		],
		["a rating of 100.1", metaFile(ratedWith(100.1))],
		[
			"every rating equal",
			metaFile(rows(ids, 60).map((row) => ({ ...row, d2pt_rating: 70 }))),
		],
		[
			"rows at two positions",
			metaFile([
				...rows(ids, 30, "pos 3"),
				...rows(ids.slice(30), 30, "pos 4"),
			]),
		],
		[
			"rows naming no position",
			metaFile(rows(ids, 60).map(({ position, ...row }) => row)),
		],
	])("%s answers 422 not-d2pt-meta", async (_, body) => {
		const { post, get } = await signedIn();
		await post(metaFile(rows(ids, 60)));
		const before = await (await get()).json();
		const response = await post(body);
		expect(response.status).toBe(422);
		expect((await problem(response)).code).toBe("not-d2pt-meta");
		expect(await (await get()).json()).toEqual(before);
	});
});

test("ratings of 0, 100 and null are all taken", async () => {
	const { post } = await signedIn();
	const body = rows(ids, 62).map((row, i) =>
		i === 0
			? { ...row, d2pt_rating: 0 }
			: i === 1
				? { ...row, d2pt_rating: 100 }
				: i === 2
					? { ...row, d2pt_rating: null }
					: row,
	);
	expect((await post(metaFile(body))).status).toBe(200);
});

test("heroes the snapshot does not know are dropped, and cannot make up the 50", async () => {
	const { post } = await signedIn();
	const strangers = rows([9001, 9002, 9003], 3);
	expect((await post(metaFile([...rows(ids, 49), ...strangers]))).status).toBe(
		422,
	);
	const response = await post(metaFile([...rows(ids, 50), ...strangers]));
	expect(await response.json()).toMatchObject({ heroes: 50 });
});

describe("the size cap", () => {
	const MB5 = 5 * 1024 * 1024;
	test("5 MB is read, and refused only for what it is", async () => {
		const { post } = await signedIn();
		const response = await post("x".repeat(MB5));
		expect((await problem(response)).code).toBe("not-d2pt-meta");
	});
	test("5 MB and one byte answers 413 too-large", async () => {
		const { post } = await signedIn();
		const response = await post("x".repeat(MB5 + 1));
		expect(response.status).toBe(413);
		expect((await problem(response)).code).toBe("too-large");
	});
});

test("a write stopped before its rename leaves the previous upload, and no temporary file", async () => {
	const { post } = await signedIn();
	await post(metaFile(rows(ids, 60)));
	const before = await readStore(dir);
	const refused = async () => {
		throw new Error("power cut");
	};
	const upload = { position: 3 as const, patch: "7.42", heroes: {} };
	await writePosition(dir, upload, new Date(T0).toISOString(), refused).then(
		() => expect.unreachable(),
		(error) => expect(error.message).toBe("power cut"),
	);
	expect(await readStore(dir)).toEqual(before);
	expect(await readdir(dir)).toEqual(["meta-pos-3.json"]);
});

test("the meta routes need a session", async () => {
	const app = cmApi({
		password: PASSWORD,
		dataDir: dir,
		knownHeroes: async () => known,
	});
	expect((await app.request("/api/cm/meta")).status).toBe(401);
	expect(
		(await app.request("/api/cm/meta", { method: "POST", body: "{}" })).status,
	).toBe(401);
});
