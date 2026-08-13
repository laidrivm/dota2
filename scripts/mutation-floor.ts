#!/usr/bin/env bun
/**
 * Fails when the number of mutants surviving in `src/model.ts` differs from the
 * floor declared below. Reads Stryker's JSON report; it runs no tool, so a
 * Stryker that crashed is a non-zero exit its own invoker already surfaced, and
 * this check never has to tell that apart from an exceeded floor.
 *
 * The invoker also deletes the previous report before the run — see
 * `.github/workflows/mutation.yml`. A reader cannot tell a stale report from a
 * fresh one; an absent one already fails here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Statuses meaning the tests let the mutant through. */
const SURVIVING = ["Survived", "NoCoverage"];

/**
 * Statuses meaning something other than that. `NoCoverage` sits above rather
 * than here because no test ran against such a mutant at all; it should not
 * arise under the command runner, which performs no coverage analysis, and
 * counting it is what makes its appearance visible instead of silent.
 *
 * The report schema carries an eighth status, `Pending`, which neither list
 * names on purpose: it means the run did not finish, so both counting it and
 * ignoring it would report a number about a run that never happened. Any status
 * this check predates lands the same way — thrown, by name.
 */
const COUNTED_OUT = [
	"Killed",
	"Timeout",
	"Ignored",
	"CompileError",
	"RuntimeError",
];

type Mutant = { status?: unknown };
type Report = { files: Record<string, { mutants?: Mutant[] }> };

/**
 * Stryker's report at `file`. Throws naming `file` when it is absent, truncated
 * or not a report, so none of the three can read as zero survivors.
 */
export function loadReport(file: string): Report {
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch (cause) {
		throw new Error(`no mutation report at ${file}`, { cause });
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		throw new Error(`the mutation report at ${file} is not JSON`, { cause });
	}

	const files = (parsed as Report | null)?.files;
	// Arrays and null are objects too, and either would yield no mutants below
	// and so a count of zero from a file that is not a report.
	if (typeof files !== "object" || files === null || Array.isArray(files))
		throw new Error(`the mutation report at ${file} carries no files`);
	return parsed as Report;
}

/**
 * How many mutants in `report` survived. Throws when the report holds no mutant
 * at all — a mutated file with nothing to mutate means the scope is wrong, and
 * zero survivors is the answer that would hide it.
 */
export function survivors(report: Report): number {
	const mutants = Object.values(report.files).flatMap((f) => f.mutants ?? []);
	if (mutants.length === 0)
		throw new Error("the mutation report holds no mutants");

	let count = 0;
	for (const { status } of mutants) {
		if (typeof status === "string" && SURVIVING.includes(status)) count++;
		else if (typeof status !== "string" || !COUNTED_OUT.includes(status))
			throw new Error(`unrecognised mutant status: ${String(status)}`);
	}
	return count;
}

export const FLOOR = 67; // first measurement: 267 mutants, 200 killed

/**
 * The `FLOOR` declaration in `source`, or `""` when it holds none — a floor
 * nobody can find states no reason either, and both fail the same way.
 *
 * Anchored to the start of a line, which is why the malformed declarations the
 * tests pass in, all of them indented arguments, are not mistaken for it.
 */
export function floorLine(source: string): string {
	return /^export const FLOOR = \d+;.*$/m.exec(source)?.[0] ?? "";
}

/**
 * What a count owes its floor. Both directions fail: a rise admits a mutant
 * nothing kills, and a floor left above reality stops being a measurement.
 *
 * The reason is demanded on every run rather than only on a rise, because
 * telling a rise from a drop needs the previously committed value, and reading
 * git history to decide whether to ask is more machinery than one comment.
 */
export function gauge(
	count: number,
	floor: number,
	declaration: string,
): string[] {
	const problems: string[] = [];
	// Anchored to the semicolon: a reason is the comment trailing the
	// declaration, never a `//` quoted elsewhere on the line.
	if (!/;\s*\/\/.*\S/.test(declaration))
		problems.push(
			`the floor states no reason: ${declaration.trim()} — write why on that line`,
		);
	if (count !== floor) {
		const gap = `${count} surviving mutants against a floor of ${floor}`;
		problems.push(
			count > floor
				? `${gap} — kill one, or raise the floor with the reason on its line`
				: `${gap} — write ${count} as the floor, so the gain is recorded`,
		);
	}
	return problems;
}

/**
 * Resolved from this file rather than from the working directory, so the check
 * reads the same report whichever directory it is run from.
 */
export const REPORT = join(
	import.meta.dir,
	"..",
	"reports",
	"mutation",
	"mutation.json",
);

if (import.meta.main) {
	const problems = gauge(
		survivors(loadReport(REPORT)),
		FLOOR,
		floorLine(readFileSync(import.meta.path, "utf8")),
	);
	for (const problem of problems) console.error(problem);
	if (problems.length) process.exit(1);
}
