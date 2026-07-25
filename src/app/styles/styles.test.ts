import { describe, expect, test } from "bun:test";
import { relativeLuminance } from "../board/format.ts";

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

describe("text tokens clear WCAG AA on the surfaces they land on", () => {
	/**
	 * The e2e axe scan is the real check, but it costs a browser. This is the
	 * same floor in 100 ms, so a token pushed back from the design project
	 * fails at `bun test` rather than in CI's browser job.
	 *
	 * `--text-6` is excluded on purpose: it renders `·` separators, disabled
	 * pick-entry labels, and the result arrow — punctuation and disabled
	 * controls, both of which WCAG 1.4.3 exempts.
	 */
	const surfaces = ["bg-0", "bg-1", "bg-2"];
	const inks = ["text-1", "text-2", "text-3", "text-4", "text-5"];

	const luminanceOf = async (token: string) => {
		const css = await read("tokens/colors.css");
		const value = css.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1] ?? "";
		const luminance = relativeLuminance(value);
		if (luminance === null) throw new Error(`--${token} is not a colour`);
		return luminance;
	};

	test.each(inks.flatMap((ink) => surfaces.map((bg) => [ink, bg])))(
		"%s on %s reaches 4.5:1",
		async (ink, bg) => {
			const [a, b] = await Promise.all([
				luminanceOf(ink as string),
				luminanceOf(bg as string),
			]);
			expect(
				(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			).toBeGreaterThanOrEqual(4.5);
		},
	);
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
