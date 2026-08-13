import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	FLOOR,
	floorLine,
	gauge,
	loadReport,
	REPORT,
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
		"src/model.ts": {
			mutants: statuses.map((status, n) => ({ id: String(n), status })),
		},
	},
});

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
		const twice = {
			files: {
				"src/model.ts": {
					mutants: [
						{ id: "0", status: "Survived", location: { start: { line: 7 } } },
						{ id: "1", status: "Survived", location: { start: { line: 7 } } },
					],
				},
			},
		};
		expect(survivors(twice)).toBe(2);
	});

	test("a status the check does not recognise fails, naming it", () => {
		expect(() => survivors(report("Killed", "Pending"))).toThrow(/Pending/);
	});

	test("survivors are counted across every file in the report", () => {
		const both = {
			files: {
				"src/model.ts": { mutants: [{ id: "0", status: "Survived" }] },
				"src/other.ts": { mutants: [{ id: "1", status: "Survived" }] },
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

	test("this script's own floor line states a reason", () => {
		expect(gauge(FLOOR, FLOOR, floorLine(source))).toEqual([]);
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
		expect(REPORT).toBe(run.stdout.toString().trim());
	});
});
