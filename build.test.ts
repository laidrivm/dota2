import { beforeAll, describe, expect, test } from "bun:test";

/**
 * The build is a bundler call plus two `cp` steps, and the font arrangement
 * rests on Bun leaving an inline `<style>` alone. All three fail silently:
 * the app still builds, it just cannot load its fonts or its snapshot.
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
