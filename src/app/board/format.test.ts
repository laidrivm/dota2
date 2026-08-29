import { describe, expect, test } from "bun:test";
import type { Role } from "../../types.ts";
import {
	formatAdvantage,
	formatPhase,
	formatScore,
	formatWinProbability,
	heroAbbr,
	INK_THRESHOLD,
	iconSrc,
	inkFor,
	relativeLuminance,
	scoreTone,
	tileInk,
	topRoles,
} from "./format.ts";

describe("heroAbbr", () => {
	test.each([
		["Zeus", "ZEUS"],
		["Keeper of the Light", "KEEP"],
		["Anti-Mage", "ANTI"],
		["Io", "IO"],
		["Nature's Prophet", "NATU"],
		["", ""],
	])("%p → %p", (name, abbr) => {
		expect(heroAbbr(name)).toBe(abbr);
	});
});

// spec: draft-board/the-image-is-drawn draft-board/the-image-does-not-load
describe("iconSrc", () => {
	test.each([
		["/icons/pudge.png"],
		// The underscore is what the ingest writes, where the fixture's `short`
		// beside it reads `bounty-hunter`.
		["/icons/bounty_hunter.png"],
	])("%p is served from this origin and comes back unchanged", (icon) => {
		expect(iconSrc(icon)).toBe(icon);
	});

	test.each([
		[undefined],
		[""],
		["/icons/.png"],
		["/icons/../../etc/passwd.png"],
		["https://cdn.stratz.com/images/dota2/heroes/pudge.png"],
		["/icons/pudge.png?v=2"],
		["/icons/Pudge.PNG"],
		// Refused by the separator, where the traversal above is refused by the
		// dot — the character class rules out both, and each needs its own case.
		["/icons/heroes/pudge.png"],
		// What says the pattern is anchored at its end and not only at its start.
		["/icons/pudge.png\n"],
	])("%p names no image and yields null", (icon) => {
		expect(iconSrc(icon)).toBeNull();
	});

	/** Every rejection above also fails the pattern once stringified, so this is
	 * what holds the `typeof` guard: `icon` arrives from the payload, and JSON
	 * can carry an array whose one element stringifies to a path that matches. */
	test("a value that is not a string never becomes a src", () => {
		expect(iconSrc(["/icons/pudge.png"])).toBeNull();
	});
});

describe("tile ink", () => {
	test.each([
		["#4a3d85", "light"],
		["#2f3b52", "light"],
		// Just above the crossover: black reads better on it than white does.
		["#2e7fd0", "dark"],
		["#dce8f2", "dark"],
		["#f0e3b2", "dark"],
	])("%s takes %s lettering", (color, ink) => {
		expect(tileInk(color)).toBe(ink as "dark");
	});

	test("the threshold itself takes dark lettering", () => {
		expect(inkFor(INK_THRESHOLD)).toBe("dark");
		expect(inkFor(INK_THRESHOLD - 0.0001)).toBe("light");
	});

	/** The palette test below is what catches these for real; this pins what
	 * the parser does with them so the two stay in step. */
	test.each(["", "not a colour", "#fff", "rgb(69, 196, 180)", "#45c4b4;"])(
		"a colour the parser cannot read (%p) falls back to light lettering",
		(value) => {
			expect(tileInk(value)).toBe("light");
		},
	);

	test("black and white anchor the luminance scale", () => {
		expect(relativeLuminance("#000000")).toBe(0);
		expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
	});
});

describe("the shipped palette", () => {
	/** Comments legitimately mention token names and ratios; rules may not, so
	 *  they are stripped before anything below matches against the file. */
	const read = () =>
		Bun.file(new URL("../styles/tokens/colors.css", import.meta.url))
			.text()
			.then((css) => css.replace(/\/\*[\s\S]*?\*\//g, ""));

	/**
	 * The tile reads these tokens at runtime, so a malformed or renamed entry
	 * would show up as unreadable lettering in the browser and nowhere else.
	 */
	test("every colour the tile reads parses to a luminance", async () => {
		const entries = [
			...(await read()).matchAll(
				/--(hero-[a-z0-9_-]+|tile-ink-[a-z]+):\s*([^;]+);/g,
			),
		];

		// The same declarations read again by a pattern no spelling can slip
		// past, so a token the palette gains and the strict one does not
		// cover fails here rather than leaving it quietly.
		const declared = [...(await read()).matchAll(/--(hero-[^:\s]+):/g)].map(
			([, name]) => name,
		);
		const heroes = entries
			.map(([, name]) => name)
			.filter((name) => name?.startsWith("hero-"));
		// Equality rather than containment, so a token declared twice fails
		// too: the cascade keeps the last of the pair, and the loser reads as
		// a colour somebody chose.
		expect(heroes).toEqual(declared);
		expect(declared).toHaveLength(new Set(declared).size);
		// Counted on the loose sweep, where the floor this replaced sat on
		// the strict one and a rename could satisfy it by shrinking under it.
		// Not a floor on how large the palette should be: it is what stops a
		// file with no hero token at all passing, which both assertions above
		// do vacuously.
		expect(declared.length).toBeGreaterThan(50);

		const unparseable = entries
			.filter(([, , value]) => relativeLuminance(value ?? "") === null)
			.map(([, name]) => name);
		expect(unparseable).toEqual([]);
	});

	/**
	 * Previously skipped: with the softened ink pair the worst case was pinned
	 * at the threshold, so a floor test guarded nothing. The pure inks moved
	 * the worst case to 4.64:1, which leaves room for a real floor — and this
	 * is what fails when a new hero colour, or a softer ink, drops below it.
	 */
	test("every hero colour clears 4.5:1 with the ink the threshold picks", async () => {
		const css = await read();
		const inkLuminance = (name: string) =>
			relativeLuminance(
				css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1] ?? "",
			);
		const dark = inkLuminance("tile-ink-dark");
		const light = inkLuminance("tile-ink-light");
		if (dark === null || light === null) throw new Error("ink tokens missing");

		const contrast = (a: number, b: number) =>
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

		const failures = [
			...css.matchAll(/--(hero-[a-z0-9_-]+):\s*([^;]+);/g),
		].flatMap(([, name, value]) => {
			const luminance = relativeLuminance(value ?? "");
			if (luminance === null) return [];
			const ratio = contrast(
				luminance,
				inkFor(luminance) === "dark" ? dark : light,
			);
			return ratio < 4.5 ? [`${name} ${ratio.toFixed(2)}:1`] : [];
		});

		expect(failures).toEqual([]);
	});

	test("the fallback colour exists, so a hero off the palette still renders", async () => {
		expect(await read()).toContain("--hero-fallback:");
	});
});

describe("score and estimate formatting", () => {
	test.each([
		[2.14, "+2.1%"],
		[-0.44, "-0.4%"],
		[0, "+0.0%"],
		[-0.04, "+0.0%"],
	])("a score of %p renders %s", (pp, text) => {
		expect(formatScore(pp)).toBe(text);
	});

	test.each([
		[2.1, "pos"],
		[0, "muted"],
		[-1.2, "muted"],
	])("a score of %p is toned %s", (pp, tone) => {
		expect(scoreTone(pp)).toBe(tone as "pos");
	});

	test("advantage keeps its sign and one decimal", () => {
		expect(formatAdvantage(-3.24)).toBe("-3.2 pp");
		expect(formatAdvantage(3.24)).toBe("+3.2 pp");
	});

	test.each([
		[0.585, "~59% win"],
		[0.5, "~50% win"],
		[0.999, "~100% win"],
		[0.004, "~0% win"],
	])("a win probability of %p renders %s", (probability, text) => {
		expect(formatWinProbability(probability)).toBe(text);
	});

	test.each([
		["p1", "1st"],
		["p2", "2nd"],
		["last", "last"],
	] as const)("phase %s renders %s", (phase, text) => {
		expect(formatPhase(phase)).toBe(text);
	});
});

describe("topRoles", () => {
	const probs = (values: [Role, number][]): Record<`${Role}`, number> => {
		const all = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
		for (const [role, value] of values) all[`${role}`] = value;
		return all;
	};

	test("renders the two likeliest positions", () => {
		expect(
			topRoles(
				probs([
					[1, 0.62],
					[2, 0.31],
					[3, 0.04],
					[4, 0.02],
					[5, 0.01],
				]),
			),
		).toBe("p1 62% · p2 31%");
	});

	test("a second term that rounds to zero is dropped", () => {
		expect(
			topRoles(
				probs([
					[5, 0.996],
					[4, 0.004],
				]),
			),
		).toBe("p5 100%");
	});

	test("an enemy with no inferred role at all renders nothing", () => {
		expect(topRoles(probs([]))).toBe("");
	});

	test("equal probabilities are ordered by role", () => {
		expect(
			topRoles(
				probs([
					[4, 0.4],
					[2, 0.4],
					[1, 0.2],
				]),
			),
		).toBe("p2 40% · p4 40%");
	});
});
