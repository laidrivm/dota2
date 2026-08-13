import { beforeAll, describe, expect, test } from "bun:test";
import { distFile } from "./dist-routes.ts";

/**
 * The build is a bundler call plus two `cp` steps, and the font arrangement
 * rests on Bun leaving an inline `<style>` alone. All three fail silently:
 * the app still builds, it just cannot load its fonts or its snapshot.
 *
 * Serving that output is checked here too, because this is where a built
 * `dist/` already exists.
 */

const dist = `${import.meta.dir}/dist`;

beforeAll(async () => {
	const build = Bun.spawnSync(["bun", "run", "build"], {
		cwd: import.meta.dir,
	});
	if (build.exitCode !== 0) {
		throw new Error(`build failed: ${build.stderr.toString()}`);
	}
});

describe("build output", () => {
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
	])("refuses %s", (path) => {
		expect(distFile(path)).toBeNull();
	});
});
