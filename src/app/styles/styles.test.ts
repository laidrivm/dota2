import { describe, expect, test } from "bun:test";
import { lstatSync } from "node:fs";
import { join } from "node:path";
import { relativeLuminance } from "../board/format.ts";

// The listing is taken at the repository root, never at `cwd`, the shape
// `scripts/no-suppressions.ts` uses: `git ls-files` run in a subdirectory
// reports only what is under it and names it relative to it. Tracked files
// rather than a filesystem glob, which would walk `node_modules` and admit
// whatever is untracked in a working tree.
const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
if (top.exitCode !== 0) throw new Error(top.stderr.toString());
const root = top.stdout.toString().trim();

const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());

/**
 * Every stylesheet the app ships, path relative to the repository root.
 *
 * The whole tree rather than `src/app/styles/`: component rules live beside
 * their components now, and a scope written as one directory would have let
 * every one of them leave the assertions below without failing anything.
 */
const cssFiles = ls.stdout
	.toString()
	.split("\0")
	.filter(Boolean)
	.filter((path) => path.endsWith(".css"))
	// Tracked but absent from the work tree, or a gitlink that reads as a
	// directory — neither is a file to open.
	.filter((path) =>
		lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
	)
	.sort();

/** The one place a colour literal belongs. */
const TOKENS = "src/app/styles/tokens/";

const read = (rel: string) =>
	Bun.file(join(root, rel)).text().then(stripComments);

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
	expect(cssFiles).toContain("src/app/styles/base.css");
	expect(cssFiles).toContain("src/app/styles/styles.css");
	expect(cssFiles).toContain("src/app/styles/fonts/fonts.css");
	expect(cssFiles).toContain("src/app/app.module.css");
});

describe("style values come from design tokens", () => {
	const outsideTokens = cssFiles.filter((f) => !f.startsWith(TOKENS));

	// A sweep that found nothing would pass every assertion below vacuously.
	test("the sweep found stylesheets outside tokens/", () => {
		expect(outsideTokens.length).toBeGreaterThan(0);
	});

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
		const css = await read(`${TOKENS}colors.css`);
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
		const html = await Bun.file(join(root, "index.html")).text();
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
