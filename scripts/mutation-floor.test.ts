import { afterAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	exemptions,
	FLOOR,
	floorLine,
	gauge,
	loadReport,
	survivors,
} from "./mutation-floor.ts";

const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A file holding `text`, in a directory removed when the suite ends. */
function fabricate(text: string): string {
	const dir = mkdtempSync(join(tmpdir(), "mutation-floor-"));
	made.push(dir);
	const file = join(dir, "mutation.json");
	writeFileSync(file, text);
	return file;
}

/** A report whose one file carries `statuses`, one mutant each. */
const report = (...statuses: string[]) => ({
	files: {
		"src/model.ts": { mutants: statuses.map((status) => ({ status })) },
	},
});

// spec: mutation-floor/a-mutant-the-tests-assert-against
describe("the survivor count", () => {
	test("a report with no mutants fails rather than counting zero", () => {
		expect(() => survivors(report())).toThrow(/no mutants/);
	});

	test("mutants that are all killed count zero", () => {
		expect(survivors(report("Killed", "Killed", "Killed"))).toBe(0);
	});

	test("one survivor among many killed counts one", () => {
		expect(survivors(report("Killed", "Survived", "Killed"))).toBe(1);
	});

	test("only the survivors are counted among every other status", () => {
		expect(
			survivors(
				report(
					"Killed",
					"Survived",
					"Timeout",
					"Ignored",
					"CompileError",
					"RuntimeError",
				),
			),
		).toBe(1);
	});

	test("a mutant no test covered counts as surviving", () => {
		expect(survivors(report("Killed", "NoCoverage"))).toBe(1);
	});

	test("two survivors on one line count as two", () => {
		expect(survivors(report("Survived", "Survived"))).toBe(2);
	});

	test("a status the check does not recognise fails, naming it", () => {
		expect(() => survivors(report("Killed", "Pending"))).toThrow(/Pending/);
	});

	test("a mutant carrying no status fails rather than counting as killed", () => {
		expect(() =>
			survivors({ files: { "src/model.ts": { mutants: [{}] } } }),
		).toThrow(/undefined/);
	});

	test("a report naming no file at all fails", () => {
		// What Stryker writes when `mutate` matches nothing — the wrong-scope
		// case, which zero survivors would report as a clean run.
		expect(() => survivors({ files: {} })).toThrow(/no mutants/);
	});

	test("a report of null file entries fails rather than counting zero", () => {
		expect(() => survivors({ files: { "src/model.ts": null } })).toThrow(
			/no mutants/,
		);
	});

	test("a file entry with no mutants key contributes none", () => {
		const partial = {
			files: {
				"src/model.ts": { mutants: [{ status: "Survived" }] },
				"src/other.ts": {},
			},
		};
		expect(survivors(partial)).toBe(1);
	});

	test("survivors are counted across every file in the report", () => {
		const both = {
			files: {
				"src/model.ts": { mutants: [{ status: "Survived" }] },
				"src/other.ts": { mutants: [{ status: "Survived" }] },
			},
		};
		expect(survivors(both)).toBe(2);
	});
});

describe("loading the report", () => {
	test("a missing file fails rather than reading as zero survivors", () => {
		const absent = join(tmpdir(), "mutation-floor-absent", "mutation.json");
		expect(() => loadReport(absent)).toThrow(absent);
	});

	test("a truncated report fails, naming the file", () => {
		const file = fabricate('{"files":{"src/model.ts":{"mutants":[');
		expect(() => loadReport(file)).toThrow(file);
	});

	test("a report that is not an object fails, naming the file", () => {
		const file = fabricate("[]");
		expect(() => loadReport(file)).toThrow(file);
	});

	test("a well-formed report loads and counts", () => {
		const file = fabricate(JSON.stringify(report("Killed", "Survived")));
		expect(survivors(loadReport(file))).toBe(1);
	});
});

/** A floor declaration carrying `reason` after the semicolon. */
const declared = (n: number, reason = " // measured") =>
	`export const FLOOR = ${n};${reason}`;

const source = readFileSync(join(import.meta.dir, "mutation-floor.ts"), "utf8");

describe("the count against the floor", () => {
	test("a count equal to the floor passes", () => {
		expect(gauge(12, 12, declared(12))).toEqual([]);
	});

	// spec: mutation-floor/a-branch-added-without-a-test
	test("a count above the floor fails", () => {
		expect(gauge(13, 12, declared(12))).not.toEqual([]);
	});

	test("a count below the floor fails", () => {
		expect(gauge(11, 12, declared(12))).not.toEqual([]);
	});

	test("a floor of zero with no survivors passes", () => {
		expect(gauge(0, 0, declared(0))).toEqual([]);
	});

	test("the failure above the floor names both numbers", () => {
		const [problem] = gauge(13, 12, declared(12));
		expect(problem).toContain("13");
		expect(problem).toContain("12");
	});

	test("the failure below the floor names the value to write", () => {
		const [problem] = gauge(11, 12, declared(12));
		expect(problem).toContain("write 11");
	});

	// spec: mutation-floor/a-survivor-newly-killed
	test("a survivor newly killed fails until the floor is lowered", () => {
		const before = report(...Array(5).fill("Survived"), "Killed");
		expect(survivors(before)).toBe(5);
		// The new test kills one: the same report with one status flipped.
		const after = report(...Array(4).fill("Survived"), "Killed", "Killed");
		expect(survivors(after)).toBe(4);
		expect(gauge(4, 5, declared(5))).not.toEqual([]);
		expect(gauge(4, 4, declared(4))).toEqual([]);
	});
});

// spec: mutation-floor/the-floor-changed-with-no-reason-given
describe("the floor changed with no reason given", () => {
	test("a declaration with no trailing comment fails", () => {
		expect(gauge(12, 12, declared(12, ""))).not.toEqual([]);
	});

	test("a comment marker with nothing after it fails", () => {
		expect(gauge(12, 12, declared(12, " //"))).not.toEqual([]);
	});

	test("a comment of whitespace alone fails", () => {
		expect(gauge(12, 12, declared(12, " //   "))).not.toEqual([]);
	});

	test("a floor absent from the source altogether fails", () => {
		expect(floorLine("const OTHER = 1; // not the floor\n")).toBe("");
		expect(gauge(12, 12, floorLine("const OTHER = 1;\n"))).not.toEqual([]);
	});

	test("the declaration is read from the start of a line", () => {
		// The malformed declarations above are indented arguments, never the
		// real line — an unanchored match would pick one of them up.
		expect(floorLine(`\texport const FLOOR = 9; // indented\n`)).toBe("");
		expect(floorLine(`export const FLOOR = 9; // real\n`)).toBe(
			"export const FLOOR = 9; // real",
		);
	});

	test("a reason on the next line is not a reason", () => {
		expect(gauge(12, 12, "export const FLOOR = 12;\n// measured")).not.toEqual(
			[],
		);
	});

	test("a comment before the semicolon is not a reason", () => {
		// Position is what pins a reason to the declaration, so a marker
		// anywhere but after the semicolon leaves the floor unexplained.
		expect(gauge(12, 12, "export const FLOOR = 12 // measured")).not.toEqual(
			[],
		);
	});

	// spec: mutation-floor/the-repository-as-it-stands
	test("this script's own floor line states a reason", () => {
		expect(gauge(FLOOR, FLOOR, floorLine(source))).toEqual([]);
	});
});

/** `src/model.ts` as the scan sees it: `lines` with the code they annotate. */
const marked = (...lines: string[]) =>
	lines.map((line) => `${line}\nconst x = 1;`).join("\n");

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

	test("a well-formed one still fails, because the spelling is not the form", () => {
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

describe("what is not a disable comment", () => {
	test("one inside a string literal is not one", () => {
		expect(
			exemptions(
				`const s = "// Stryker disable next-line all";\nconst x = 1;\n`,
			),
		).toEqual([]);
	});

	test("one inside a block comment is not one", () => {
		expect(
			exemptions(`/*\n// Stryker disable next-line all\n*/\nconst x = 1;\n`),
		).toEqual([]);
	});

	test("one behind an escaped quote is still inside the string", () => {
		// The escape must not end the literal early: everything after it is
		// string, not code, and flagging it would fail the build on innocence.
		expect(
			exemptions(
				`const s = "he said \\"// Stryker disable next-line all\\"";\n`,
			),
		).toEqual([]);
	});

	test("a quote that opens no string does not silence the file", () => {
		// The `'` in a regex literal closes nowhere. If it were treated as a
		// string opener the scan would run to the end of the file and report
		// nothing at all, which is the one failure it must never have.
		expect(
			exemptions(`const re = /['"]/;\n// Stryker disable next-line all\n`),
		).not.toEqual([]);
	});

	test("an escaped newline still counts as a line", () => {
		const [problem] = exemptions(
			"const s = `a\\\nb`;\n// Stryker disable next-line all\nconst x = 1;\n",
		);
		expect(problem).toContain("src/model.ts:3");
	});

	test("one inside a multi-line template literal is not one", () => {
		expect(
			exemptions("const s = `a\n// Stryker disable next-line all\nb`;\n"),
		).toEqual([]);
	});

	test("a `/*` inside a line comment opens no block", () => {
		// If it did, every comment below would be swallowed and the scan would
		// go quiet for the rest of the file.
		expect(
			exemptions("// see /* the note\n// Stryker disable next-line all\n"),
		).not.toEqual([]);
	});

	test("a directive spanning a block comment's first line is found", () => {
		// Stryker anchors at the comment's text, so this one it honours.
		expect(
			exemptions("/* Stryker disable next-line all\n   because reasons */\n"),
		).not.toEqual([]);
	});

	test("one on a line whose block comment opened earlier is not one", () => {
		expect(
			exemptions(`const opener = "/*";\n// Stryker disable next-line all\n`),
		).not.toEqual([]);
	});
});

describe("the command line entry point", () => {
	const cli = (
		report: string | null,
		files: Record<string, string> = { "src/model.ts": "const x = 1;\n" },
	) => {
		const dir = mkdtempSync(join(tmpdir(), "mutation-floor-cli-"));
		made.push(dir);
		// A copy of the check beside a tree of our own, so it resolves this
		// report and this model rather than the repository's real ones.
		mkdirSync(join(dir, "scripts"), { recursive: true });
		writeFileSync(join(dir, "scripts", "mutation-floor.ts"), source);
		for (const [path, text] of Object.entries(files)) {
			mkdirSync(join(dir, dirname(path)), { recursive: true });
			writeFileSync(join(dir, path), text);
		}
		if (report !== null) {
			mkdirSync(join(dir, "reports", "mutation"), { recursive: true });
			writeFileSync(join(dir, "reports", "mutation", "mutation.json"), report);
		}
		return Bun.spawnSync(["bun", join(dir, "scripts", "mutation-floor.ts")]);
	};

	const holding = () =>
		JSON.stringify(report(...Array(FLOOR).fill("Survived"), "Killed"));

	test("it exits 0 and says nothing when the count equals the floor", () => {
		const run = cli(
			JSON.stringify(report(...Array(FLOOR).fill("Survived"), "Killed")),
		);
		expect(run.stderr.toString()).toBe("");
		expect(run.exitCode).toBe(0);
	});

	test("it exits 1 and names the gap on stderr when the count differs", () => {
		const run = cli(
			JSON.stringify(report(...Array(FLOOR + 1).fill("Survived"), "Killed")),
		);
		expect(run.stderr.toString()).toContain(String(FLOOR + 1));
		expect(run.stdout.toString()).toBe("");
		expect(run.exitCode).toBe(1);
	});

	test("it fails when the report is absent rather than passing", () => {
		const run = cli(null);
		expect(run.exitCode).not.toBe(0);
	});

	test("a malformed exemption in the model fails the check", () => {
		const run = cli(holding(), {
			"src/model.ts": "// Stryker disable next-line all\nconst x = 1;\n",
		});
		expect(run.stderr.toString()).toContain("all");
		expect(run.exitCode).toBe(1);
	});

	test("the same comment in another file does not fail it", () => {
		// The scan is scoped to the one file that is mutated; elsewhere the
		// comment means nothing to Stryker and so means nothing here.
		const run = cli(holding(), {
			"src/model.ts": "const x = 1;\n",
			"src/app/session.ts": "// Stryker disable next-line all\nconst y = 2;\n",
		});
		expect(run.stderr.toString()).toBe("");
		expect(run.exitCode).toBe(0);
	});

	test("it fails when the model is absent rather than passing", () => {
		const run = cli(holding(), {});
		expect(run.exitCode).not.toBe(0);
	});
});

describe("the check resolves its report from the repository root", () => {
	test("run from a subdirectory it names the same file", () => {
		const run = Bun.spawnSync(
			[
				"bun",
				"-e",
				`console.log((await import(${JSON.stringify(join(import.meta.dir, "mutation-floor.ts"))})).REPORT)`,
			],
			{ cwd: import.meta.dir },
		);
		expect(run.stdout.toString().trim()).toBe(
			join(import.meta.dir, "..", "reports", "mutation", "mutation.json"),
		);
	});
});
