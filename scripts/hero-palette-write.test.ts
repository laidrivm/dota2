/**
 * What the generator does to a token file: the run a person performs, and the
 * splice that leaves every byte outside the hero block alone.
 *
 * Apart from `hero-palette.test.ts`, which asks what colour a mirror yields.
 * The two halves together are over the file cap, and the seam is the write:
 * nothing here decides a colour, and nothing there touches a file it did not
 * read.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	cleanup,
	FALLBACK_LINE,
	mirror,
	png,
	run,
	solid,
	tokenFile,
} from "./hero-palette.fixture.ts";
import { render } from "./hero-palette.ts";

afterAll(cleanup);

// spec: hero-palette/a-portrait-the-decoder-cannot-read
// spec: hero-palette/a-mirror-holding-every-hero-the-palette-knows
// spec: hero-palette/a-hero-the-mirror-has-no-portrait-for
describe("the generator as a person runs it", () => {
	test("a readable mirror is written into the token file", () => {
		const dir = mirror({ "axe.png": solid(197, 59, 48) });
		const tokens = tokenFile();
		const call = run(dir, tokens);
		expect(call.status).toBe(0);
		expect(call.out).toMatch(/2 colours, [0-9.]+ ΔE76/);
		expect(readFileSync(tokens, "utf8")).toContain("\t--hero-axe: ");
	});

	test("an empty mirror is refused rather than emptying the palette", () => {
		// It reaches the write with a palette of one, which would leave a
		// tracked file holding the fallback and no hero at all — and exit 0
		// while doing it, so nothing would say the palette had been dropped.
		const tokens = tokenFile();
		const before = readFileSync(tokens, "utf8");
		const call = run(mirror({}), tokens);
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("no hero colour at all");
		expect(readFileSync(tokens, "utf8")).toBe(before);
	});

	test("the fallback is carried through the heroes that remain", () => {
		const tokens = tokenFile();
		const after = (() => {
			expect(
				run(mirror({ "abaddon.png": solid(69, 196, 180) }), tokens).status,
			).toBe(0);
			return readFileSync(tokens, "utf8");
		})();
		expect(after).toContain(FALLBACK_LINE);
		// The hero the mirror did not hold is gone; the one it did is there.
		expect(after).not.toContain("--hero-axe:");
		expect(after).toContain("--hero-abaddon:");
	});

	test("one unreadable portrait leaves the committed palette alone", () => {
		// The other two decode. A run that wrote what it had before reaching
		// the third would leave two thirds of a palette in a tracked file.
		const dir = mirror({
			"abaddon.png": solid(69, 196, 180),
			"axe.png": solid(197, 59, 48),
			"pudge.png": png({ width: 1, height: 1, depth: 16 }, [[0, 0, 0, 0]]),
		});
		const tokens = tokenFile();
		const before = readFileSync(tokens, "utf8");
		const call = run(dir, tokens);
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("pudge.png");
		expect(readFileSync(tokens, "utf8")).toBe(before);
	});

	test("a token file declaring no ink pair is refused", () => {
		// What pointing the generator at the wrong file looks like.
		const dir = mirror({ "axe.png": solid(197, 59, 48) });
		const wrong = join(dirname(tokenFile()), "not-tokens.css");
		writeFileSync(wrong, ":root {\n\t--hero-fallback: #3a4250;\n}\n");
		const call = run(dir, wrong);
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("no --tile-ink-light");
	});

	test("no token file to write is refused before anything is read", () => {
		const call = run(mirror({}));
		expect(call.status).not.toBe(0);
		expect(call.err).toContain("usage:");
	});
});

describe("the block the write replaces", () => {
	const css = (...hero: string[]) =>
		[":root {", "\t--tile-ink-dark: #000000;", ...hero, "}", ""].join("\n");
	const fallback = "\t--hero-fallback: #3a4250;";

	test.each([
		[
			"declarations something sits between",
			css(fallback, "\t--accent: #e8b656;", "\t--hero-axe: #c53b30;"),
			"not contiguous",
		],
		[
			"no fallback to carry through",
			css("\t--hero-axe: #c53b30;"),
			"no --hero-fallback",
		],
		["no hero colour at all", css(), "no hero colour"],
	])("%s stops the write", (_, source, reason) => {
		// A hero to write, so the refusal under test is the file's shape and
		// not the empty-palette guard that runs before it.
		expect(() => render(source, [{ slug: "axe", colour: "#c53b30" }])).toThrow(
			reason,
		);
	});

	test("a hero declaration inside a comment is not one of them", () => {
		// Without blanking the comments first, the second line here reads as a
		// declaration, falls inside the block, and is spliced away — leaving
		// the file with a comment nothing closes.
		const source = [
			":root {",
			"\t/* dropped when the roster changed:",
			"\t--hero-old: #123456; */",
			"\t--hero-fallback: #3a4250;",
			"\t--hero-axe: #c53b30;",
			"}",
			"",
		].join("\n");
		const out = render(source, [{ slug: "abaddon", colour: "#45c4b4" }]);
		expect(out).toContain("\t/* dropped when the roster changed:");
		expect(out).toContain("\t--hero-old: #123456; */");
		expect(out).toContain("\t--hero-abaddon: #45c4b4;");
		expect(out).not.toContain("--hero-axe:");
	});

	test("a palette with no hero in it stops the write", () => {
		expect(() => render(css(fallback, "\t--hero-axe: #c53b30;"), [])).toThrow(
			"no hero colour at all",
		);
	});
});
