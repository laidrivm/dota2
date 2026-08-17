/**
 * Which comments the check reads a directive out of at all — its reach, as
 * against the form a directive must take, which is
 * `mutation-floor-directives.test.ts`'s. Stryker matches its directive against
 * every comment Babel hands it, so a comment this check does not see is a
 * mutant silenced with nobody told.
 *
 * The scanner itself has its own cases in `scan.test.ts`; these assert that
 * `exemptions()` reaches through it, which is what a case written against the
 * scanner alone cannot say.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { cleanup } from "./mutation-floor.fixture.ts";
import { exemptions } from "./mutation-floor.ts";

afterAll(cleanup);

/** `src/model.ts` as the scan sees it: `lines` with the code they annotate. */
const marked = (...lines: string[]) =>
	lines.map((line) => `${line}\nconst x = 1;`).join("\n");

describe("a directive Stryker honours outside a line comment", () => {
	test("a single-line block comment is scanned too", () => {
		// Stryker matches every comment Babel gives it, so this silences the
		// line's mutants exactly as a `//` directive would.
		expect(
			exemptions(marked("/* Stryker disable next-line all */")),
		).not.toEqual([]);
	});

	test("one trailing a line of code is scanned too", () => {
		expect(
			exemptions(
				"const a = 1; /* Stryker disable next-line all */\nconst x = 1;\n",
			),
		).not.toEqual([]);
	});

	test("a trailing line comment is scanned too", () => {
		expect(
			exemptions(
				"const a = 1; // Stryker disable next-line all\nconst x = 1;\n",
			),
		).not.toEqual([]);
	});

	test("one hiding behind an innocuous comment on the same line is found", () => {
		expect(
			exemptions(
				"const a = 1; /* a note */ // Stryker disable next-line all\nconst x = 1;\n",
			),
		).not.toEqual([]);
	});

	test("one inside a template interpolation is found", () => {
		// The interpolation is code, and Babel hands Stryker the comment in it.
		// The private scanner this replaced skipped the whole template and so
		// silenced the line with nobody told.
		expect(
			exemptions(
				`const s = \`x\${/* Stryker disable next-line all */ 1}\`;\nconst x = 1;\n`,
			),
		).not.toEqual([]);
	});

	test("a directive spanning a block comment's first line is found", () => {
		// Stryker anchors at the comment's text, which runs past the line the
		// comment opens on, so this one it honours.
		expect(
			exemptions("/* Stryker disable next-line all\n   because reasons */\n"),
		).not.toEqual([]);
	});
});

// spec: mutation-floor/a-directive-below-a-regex-literal
describe("a directive below a regex literal", () => {
	test("a backtick inside one opens no template literal", () => {
		expect(
			exemptions("const re = /[`]/;\n// Stryker disable next-line all\n"),
		).not.toEqual([]);
	});

	test("the same source without the literal is the control", () => {
		// Without it the directive is already found, so the case above pins the
		// literal rather than the directive.
		expect(
			exemptions("const re = 1;\n// Stryker disable next-line all\n"),
		).not.toEqual([]);
	});
});
