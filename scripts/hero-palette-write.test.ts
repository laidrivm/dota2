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

	test("the fallback is carried through whatever the mirror holds", () => {
		const tokens = tokenFile();
		const before = readFileSync(tokens, "utf8");
		expect(run(mirror({}), tokens).status).toBe(0);
		const after = readFileSync(tokens, "utf8");
		expect(after).toContain(FALLBACK_LINE);
		// The one hero the mirror did not hold is gone, and nothing else moved.
		expect(after).not.toContain("--hero-axe:");
		expect(before.split("\n").length - after.split("\n").length).toBe(1);
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

	test("a mirror of one hero reports no pair rather than an infinity", () => {
		// `Math.min` of no pair is infinite, and printing that reads as a
		// measurement somebody could quote.
		const tokens = tokenFile();
		expect(run(mirror({}), tokens).out.trim()).toBe(
			"1 colour, no pair to measure",
		);
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
		expect(() => render(source, [])).toThrow(reason);
	});
});
