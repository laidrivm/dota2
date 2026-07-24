import { describe, expect, test } from "bun:test";
import type { Role } from "../../types.ts";
import {
	formatAdvantage,
	formatPhase,
	formatScore,
	formatWinProbability,
	heroAbbr,
	INK_THRESHOLD,
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
	const read = () =>
		Bun.file(new URL("../styles/tokens/colors.css", import.meta.url)).text();

	/**
	 * The tile reads these tokens at runtime, so a malformed or renamed entry
	 * would show up as unreadable lettering in the browser and nowhere else.
	 */
	test("every colour the tile reads parses to a luminance", async () => {
		const entries = [
			...(await read()).matchAll(
				/--(hero-[a-z0-9-]+|tile-ink-[a-z]+):\s*([^;]+);/g,
			),
		];

		expect(entries.length).toBeGreaterThan(50);

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
			...css.matchAll(/--(hero-[a-z0-9-]+):\s*([^;]+);/g),
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
