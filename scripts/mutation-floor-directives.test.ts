/**
 * What form a disable directive must take for the check to accept it: the
 * grammar `DISABLE` and `ADMITTED` spell out. Which comments the check reads a
 * directive out of at all is `mutation-floor-comments.test.ts`'s, and the
 * scanner both rest on is `scan.test.ts`'s.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { cleanup, marked } from "./mutation-floor.fixture.ts";
import { exemptions } from "./mutation-floor.ts";

afterAll(cleanup);

// spec: mutation-floor/an-exemption-with-no-reason
describe("an exemption with no reason", () => {
	// spec: mutation-floor/an-equivalent-mutant-is-marked
	test("a named mutator with a reason is accepted", () => {
		expect(
			exemptions(
				marked(
					"// Stryker disable next-line EqualityOperator: bound is <=, = is a typo",
				),
			),
		).toEqual([]);
	});

	test("a comma-separated list of mutators shares one reason", () => {
		// One line can carry two mutants equivalent for the same reason, and
		// rejecting the list would push the author towards `all`.
		expect(
			exemptions(
				marked(
					"// Stryker disable next-line EqualityOperator,ArithmeticOperator: both re-derive the same total",
				),
			),
		).toEqual([]);
	});

	test("a mutator named with nothing after the colon fails", () => {
		expect(
			exemptions(marked("// Stryker disable next-line EqualityOperator:")),
		).not.toEqual([]);
	});

	test("a reason of whitespace alone fails", () => {
		expect(
			exemptions(marked("// Stryker disable next-line EqualityOperator:   ")),
		).not.toEqual([]);
	});

	test("a mutator named with no colon at all fails", () => {
		expect(
			exemptions(marked("// Stryker disable next-line EqualityOperator")),
		).not.toEqual([]);
	});

	test("a list written with spaces after the commas is accepted", () => {
		expect(
			exemptions(
				marked(
					"// Stryker disable next-line EqualityOperator, ArithmeticOperator: one reason",
				),
			),
		).toEqual([]);
	});

	test("two malformed comments yield two problems", () => {
		// Every other case here asserts only that something was reported, so a
		// scan that stopped at the first would satisfy them all.
		expect(
			exemptions(
				marked(
					"// Stryker disable next-line EqualityOperator",
					"// Stryker disable next-line all",
				),
			),
		).toHaveLength(2);
	});

	test("the failure names the line it sits on", () => {
		const [problem] = exemptions(
			`const a = 1;\nconst b = 2;\n// Stryker disable next-line EqualityOperator\nconst c = 3;\n`,
		);
		expect(problem).toContain("3");
	});
});

// spec: mutation-floor/a-blanket-disable-comment
describe("a blanket disable comment", () => {
	test("`all` instead of a mutator fails", () => {
		// On the form, not on the name: with no colon it never reaches the
		// `all` branch, and asserting that branch here would assert a lie.
		expect(exemptions(marked("// Stryker disable next-line all"))).toEqual([
			expect.stringContaining("write `// Stryker disable next-line"),
		]);
	});

	test("`all` with a reason still fails", () => {
		// The reason does not redeem it: `all` would also silence a mutant
		// added to that line later that nobody has judged.
		expect(
			exemptions(
				marked(
					"// Stryker disable next-line all: the whole line is a constant",
				),
			),
		).toEqual([expect.stringContaining("names `all`")]);
	});

	test("a disable without next-line fails, whatever it names", () => {
		// Its scope runs to the end of the file or to a matching restore.
		expect(
			exemptions(
				marked("// Stryker disable EqualityOperator: bound is deliberate"),
			),
		).toEqual([expect.stringContaining("write `// Stryker disable next-line")]);
	});
});

// spec: mutation-floor/a-well-formed-directive-in-a-block-comment
describe("the accepted spelling", () => {
	test("a well-formed block-comment directive still fails", () => {
		// Stryker honours both spellings; the check accepts one, so a reader
		// of src/model.ts never has to know there are two.
		expect(
			exemptions(
				marked(
					"/* Stryker disable next-line ArithmeticOperator: re-derives the same total */",
				),
			),
		).not.toEqual([]);
	});
});
