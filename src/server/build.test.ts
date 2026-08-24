import { beforeAll, describe, expect, test } from "bun:test";
import { symlinkSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { distDir, distFile } from "./dist-routes.ts";

/**
 * The build is a bundler call plus two `cp` steps, and the font arrangement
 * rests on Bun leaving an inline `<style>` alone. All three fail silently:
 * the app still builds, it just cannot load its fonts or its snapshot.
 *
 * Serving that output is checked here too, because this is where a built
 * `dist/` already exists.
 */

/**
 * The repository root, two levels above this module: `bun run build` writes
 * `dist/` there and has to be spawned there, and neither is `src/server/`.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));

const dist = `${root}dist`;

beforeAll(async () => {
	const build = Bun.spawnSync(["bun", "run", "build"], {
		cwd: root,
	});
	if (build.exitCode !== 0) {
		throw new Error(`build failed: ${build.stderr.toString()}`);
	}
});

describe("build output", () => {
	test("is looked for at the repository root, not beside this module", () => {
		// The anchor is what the move changed, and every case below reads the
		// same wrong one if it is wrong: they would report an empty `dist/`,
		// which is what a build that had not run looks like too. The root comes
		// from git rather than from this file's location, that location being
		// the thing under test.
		const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
			.stdout.toString()
			.trim();

		expect(fileURLToPath(distDir)).toBe(`${top}/dist/`);
	});

	test("carries the snapshot the client fetches", async () => {
		const snapshot = Bun.file(`${dist}/snapshot.json`);

		expect(await snapshot.exists()).toBe(true);
		expect((await snapshot.json()).patch.id).toBe("7.41d");
	});

	test.each([
		"fonts.css",
		"IBMPlexSans-Regular-Latin1.woff2",
		"IBMPlexSans-SemiBold-Latin1.woff2",
		"IBMPlexMono-Regular-Latin1.woff2",
		"IBMPlexMono-SemiBold-Latin1.woff2",
	])("carries fonts/%s", async (name) => {
		expect(await Bun.file(`${dist}/fonts/${name}`).exists()).toBe(true);
	});

	test("keeps the inline font @import out of the bundler's hands", async () => {
		const html = await Bun.file(`${dist}/index.html`).text();
		expect(html).toContain('@import url("/fonts/fonts.css")');
	});

	// Styles reach the page through the entry point now, so nothing in the
	// source `index.html` names them: a stylesheet that stopped being bundled
	// is a missing import rather than a 404, and this is what would notice.
	test("emits one stylesheet and links it from the document", async () => {
		const sheets = [...new Bun.Glob("*.css").scanSync(dist)];
		const html = await Bun.file(`${dist}/index.html`).text();

		expect(sheets).toHaveLength(1);
		// The element, not the string: an `href` anywhere in the document would
		// satisfy a substring match without the browser loading anything.
		expect(html).toMatch(
			new RegExp(`<link[^>]+rel="stylesheet"[^>]+href="\\./${sheets[0]}"`),
		);
	});

	test("leaves no font inlined as a data URI", async () => {
		const [css] = [...new Bun.Glob("*.css").scanSync(dist)];
		const text = await Bun.file(`${dist}/${css}`).text();

		expect(text).not.toContain("data:font");
	});
});

describe("serving the build output", () => {
	test("hands back the document at the root", async () => {
		expect(await distFile("/")?.text()).toContain('<div id="app">');
	});

	// A module script served as text/html is refused by the browser, and a
	// non-empty body is what it would have either way.
	test.each([
		["js", "javascript"],
		["css", "text/css"],
	])("hands back the hashed %s asset as %s", async (ext, type) => {
		const [name] = [...new Bun.Glob(`*.${ext}`).scanSync(dist)];
		const response = distFile(`/${name}`);

		expect(response?.headers.get("content-type")).toContain(type);
		expect((await response?.text())?.length).toBeGreaterThan(0);
	});

	// `Bun.file` follows a symlink, so the listing has to resolve one.
	test("refuses an entry that resolves outside dist/", async () => {
		const planted = `${dist}/escape.js`;
		symlinkSync(`${root}package.json`, planted);

		try {
			expect(distFile("/escape.js")).toBeNull();
		} finally {
			unlinkSync(planted);
		}
	});

	// The listing is cached, so what it costs is a stale answer after a rebuild.
	test("follows an asset appearing and disappearing", async () => {
		const probe = `${dist}/probe-listing.js`;

		expect(distFile("/probe-listing.js")).toBeNull();
		await Bun.write(probe, "//\n");
		expect(distFile("/probe-listing.js")).not.toBeNull();
		await Bun.file(probe).delete();
		expect(distFile("/probe-listing.js")).toBeNull();
	});

	// The listing is the whole guard: a name it does not carry is not a file.
	// `/snapshot.json` is the sharp case — the build copies one into `dist`, and
	// serving it from there would drop the `no-cache` its own route carries.
	test.each([
		"/nothing-here.js",
		"/../package.json",
		"/..%2f..%2fpackage.json",
		"/snapshot.json",
		"/fonts/fonts.css",
		// Nested and not a route's: the listing stops where its cache key does.
		"/fonts/LICENSE.txt",
	])("refuses %s", (path) => {
		expect(distFile(path)).toBeNull();
	});
});
