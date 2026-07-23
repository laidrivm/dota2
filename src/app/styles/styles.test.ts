import { describe, expect, test } from "bun:test";

/** Every stylesheet the app ships, path relative to this directory. */
const cssFiles = [...new Bun.Glob("**/*.css").scanSync(import.meta.dir)].sort();

const read = (rel: string) =>
	Bun.file(`${import.meta.dir}/${rel}`)
		.text()
		.then(stripComments);

/** Comments may legitimately mention a colour or a URL; rules may not. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every `url(...)` and `@import "..."` target in a stylesheet. */
function targets(css: string): string[] {
	const found = [
		...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g),
		...css.matchAll(/@import\s+["']([^"']+)["']/g),
	];
	return found.map((m) => m[1] as string);
}

test("the app ships the stylesheets under test", () => {
	expect(cssFiles).toContain("base.css");
	expect(cssFiles).toContain("styles.css");
	expect(cssFiles).toContain("fonts/fonts.css");
});

describe("style values come from design tokens", () => {
	const outsideTokens = cssFiles.filter((f) => !f.startsWith("tokens/"));

	test.each(outsideTokens)("%s declares no colour literal", async (rel) => {
		const css = await read(rel);
		expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
		expect(css).not.toMatch(/\brgba?\(/i);
	});
});

describe("no third-party runtime requests", () => {
	// index.html carries an inline <style> that pulls in the font faces.
	const inlineHtmlStyles = async () => {
		const html = await Bun.file(
			`${import.meta.dir}/../../../index.html`,
		).text();
		return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
			.map((m) => m[1] as string)
			.join("\n");
	};

	test.each(cssFiles)("%s references only its own origin", async (rel) => {
		for (const target of targets(await read(rel))) {
			expect(target).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
			expect(target).not.toStartWith("//");
		}
	});

	test("index.html inline styles reference only their own origin", async () => {
		const found = targets(stripComments(await inlineHtmlStyles()));
		expect(found.length).toBeGreaterThan(0);
		for (const target of found) {
			expect(target).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
			expect(target).not.toStartWith("//");
		}
	});
});
