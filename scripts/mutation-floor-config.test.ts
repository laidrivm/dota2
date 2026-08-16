/**
 * What `stryker.config.json` points the runner at. Its own file because the
 * two other `mutation-floor` test files disclaim it: one holds the arithmetic
 * and one the check's command line, and neither reads the configuration the
 * mutation run itself is given.
 *
 * The claim under test is not that the file says what it says — it is that
 * the killing command still reaches every test file that kills. Naming one
 * file there, while the model's tests live in three, is what pushed green at
 * 185 survivors against a floor of 67.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import config from "../stryker.config.json";

/** The operand of `bun test …`, which Stryker hands to Bun as a path filter. */
const filter = config.commandRunner.command.replace(/^bun test /, "");

/**
 * Every test file Bun would run for that filter, as a repository path.
 * Resolved from this file rather than the working directory, because Stryker
 * runs the command at the repository root and a test need not.
 */
const root = join(import.meta.dir, "..");
const matching = readdirSync(join(root, "src"))
	.map((name) => `src/${name}`)
	.filter((path) => path.endsWith(".test.ts") && path.startsWith(filter));

describe("the killing command", () => {
	// spec: mutation-floor/the-model-s-tests-move-to-another-file
	test("is a prefix the model's test files share, not one file's name", () => {
		expect(config.commandRunner.command).toStartWith("bun test ");
		// A filter that is itself a test file admits exactly one, and the next
		// case moved out of it stops killing without anything failing.
		expect(filter.endsWith(".ts")).toBe(false);
		expect(matching.length).toBeGreaterThan(1);
		expect(matching).toContain("src/model.test.ts");
	});

	test("mutates the one file the floor is measured over", () => {
		expect(config.mutate).toEqual(["src/model.ts"]);
	});
});
