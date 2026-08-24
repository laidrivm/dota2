import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	iconDir as defaultIcons,
	fontDir,
	staticRoutes,
} from "./static-routes.ts";

/**
 * The repository root, from git rather than from this file's own location —
 * that location is what the anchors below are under test for, so deriving the
 * expectation the same way the code does would let one wrong answer confirm
 * the other.
 */
const TOP = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
	.stdout.toString()
	.trim();

let origin: string;
let server: ReturnType<typeof Bun.serve>;

/**
 * The mirror the icon routes are served from. A directory of this suite's own,
 * because the cases below add files to it while the server is running — which
 * is the whole reason that route resolves its listing per request.
 */
const iconDir = mkdtempSync(join(tmpdir(), "d2ass-routes-"));

/** Every directory this file made, removed when it finishes. */
const made: string[] = [iconDir];

/** Bytes standing in for an image; the route sets the type, not the file. */
const IMAGE = new Uint8Array(64).fill(7);

beforeAll(async () => {
	await Bun.write(join(iconDir, "clinkz.png"), IMAGE);
	server = Bun.serve({
		port: 0,
		routes: staticRoutes(pathToFileURL(`${iconDir}/`)),
	});
	origin = server.url.origin;
});

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
	return server.stop(true);
});

describe("snapshot route", () => {
	test("serves the fixture as JSON", async () => {
		const response = await fetch(`${origin}/snapshot.json`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith(
			"application/json",
		);
		expect((await response.json()).patch.id).toBe("7.41d");
	});

	test("is revalidated, since the pipeline republishes this URL", async () => {
		const response = await fetch(`${origin}/snapshot.json`);
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});
});

describe("font routes", () => {
	const woff2 = "/fonts/IBMPlexSans-Regular-Latin1.woff2";

	test("serve a face with its own content type", async () => {
		const response = await fetch(`${origin}${woff2}`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("font/woff2");
	});

	test("cache faces forever, because their names pin their bytes", async () => {
		const response = await fetch(`${origin}${woff2}`);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	test("revalidate fonts.css, which can gain a face", async () => {
		const response = await fetch(`${origin}/fonts/fonts.css`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith("text/css");
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});

	test("are read from the repository's own font directory", () => {
		expect(fileURLToPath(fontDir)).toBe(`${TOP}/src/app/styles/fonts/`);
	});

	test("serve the whole file on a second request", async () => {
		const first = await fetch(`${origin}${woff2}`);
		const firstSize = (await first.arrayBuffer()).byteLength;
		const second = await fetch(`${origin}${woff2}`);

		expect(firstSize).toBeGreaterThan(0);
		expect((await second.arrayBuffer()).byteLength).toBe(firstSize);
	});

	test.each([
		"/fonts/nonexistent.woff2",
		"/fonts/../../package.json",
		"/fonts/..%2f..%2fpackage.json",
	])("do not serve %s", async (path) => {
		const response = await fetch(`${origin}${path}`);
		expect(response.status).toBe(404);
	});
});

describe("icon routes", () => {
	test("read the mirror at the repository root by default", () => {
		// The one anchor no request can report on: every case below passes a
		// directory of its own, and the default turns a missing directory into
		// an empty listing on purpose — so a wrong anchor 404s each hero exactly
		// as a clone that never ran the ingest does.
		expect(fileURLToPath(defaultIcons)).toBe(`${TOP}/icons/`);
	});

	// spec: hero-reference/a-mirrored-image
	test("serve a mirrored image with its own content type [48]", async () => {
		const response = await fetch(`${origin}/icons/clinkz.png`);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(IMAGE);
	});

	// spec: hero-reference/a-mirrored-image
	test("cache them forever, because their names pin their bytes [48]", async () => {
		const response = await fetch(`${origin}/icons/clinkz.png`);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable",
		);
	});

	// spec: hero-reference/a-name-the-mirror-does-not-hold
	test("answer a name the mirror does not hold with an empty 404 [49]", async () => {
		const response = await fetch(`${origin}/icons/no-such-hero.png`);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	// spec: hero-reference/a-read-taken-while-a-file-is-being-written
	test("answer nothing for a download still in flight [69]", async () => {
		// The state a download is in mid-write: its bytes are on disk under the
		// name the mirror gives an incomplete file, and the name the route
		// serves does not exist yet. What a reader may never get is those bytes.
		await Bun.write(join(iconDir, ".lina.png.part"), IMAGE.slice(0, 32));

		const response = await fetch(`${origin}/icons/lina.png`);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	// spec: hero-reference/a-path-that-climbs-out
	test.each([
		// `package.json` rather than this module: one climb out of `icons/` is
		// the repository root now, and naming a file the climb cannot reach
		// would pass by missing it rather than by refusing it.
		"/icons/../package.json",
		"/icons/%2e%2e%2fpackage.json",
	])("serve nothing for %s [50]", async (path) => {
		// The listing is the whitelist, so a name outside it is answered the
		// same way whether it climbed, was encoded, or is simply not a hero.
		const response = await fetch(`${origin}${path}`);

		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain("devDependencies");
	});

	// spec: hero-reference/a-path-that-climbs-out
	test("serve nothing for a half-written file asked for by name [50]", async () => {
		// Written here rather than left to the case above: taking it from a
		// neighbour would make this pass by the file's absence whenever the two
		// run in the other order, which is the one thing it must not do.
		await Bun.write(join(iconDir, ".lina.png.part"), IMAGE.slice(0, 32));

		const response = await fetch(`${origin}/icons/.lina.png.part`);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	// spec: hero-reference/a-name-the-mirror-does-not-hold
	test("answer 404 where the mirror directory is not there at all [49]", async () => {
		// Every clone before its first ingest run, `bun run dev` included: a
		// scan of an absent directory raises, and a raise here is a 500.
		const bare = Bun.serve({
			port: 0,
			routes: staticRoutes(pathToFileURL(`${iconDir}/never-written/`)),
		});
		try {
			const response = await fetch(`${bare.url.origin}/icons/clinkz.png`);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("");
		} finally {
			bare.stop(true);
		}
	});

	// spec: hero-reference/a-mirrored-image
	test("serve from a directory whose path needs encoding [48]", async () => {
		// `URL.pathname` keeps its percent-encoding, so a checkout under a
		// directory with a space in its name scans `%20`, finds nothing, and
		// answers 404 for every hero — the font scan, which has no catch, takes
		// the server down instead. Both go through the same conversion now.
		const spaced = mkdtempSync(join(tmpdir(), "d2ass routes "));
		made.push(spaced);
		await Bun.write(join(spaced, "clinkz.png"), IMAGE);
		const server = Bun.serve({
			port: 0,
			routes: staticRoutes(pathToFileURL(`${spaced}/`)),
		});
		try {
			expect(
				(await fetch(`${server.url.origin}/icons/clinkz.png`)).status,
			).toBe(200);
		} finally {
			server.stop(true);
		}
	});

	// spec: hero-reference/a-file-written-after-the-server-started
	test("serve a file written after the server started [55]", async () => {
		// The ingest writes this directory while the server runs, which is why
		// the route resolves the listing per request rather than at startup.
		expect((await fetch(`${origin}/icons/enigma.png`)).status).toBe(404);

		await Bun.write(join(iconDir, "enigma.png"), IMAGE);

		expect((await fetch(`${origin}/icons/enigma.png`)).status).toBe(200);
	});
});
