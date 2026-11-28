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
import { root } from "./root.ts";

/** The operands of `bun test …`, which Stryker hands to Bun as path filters. */
const filters = config.commandRunner.command
	.replace(/^bun test /, "")
	.split(" ");

/**
 * Every test file under `src`, as a repository path. Read recursively and
 * resolved from this file rather than the working directory: Stryker runs the
 * command at the repository root and a test need not, and eleven of these sit
 * under `src/app`, where a scan of `src` alone never reaches them.
 */
const tests = readdirSync(join(root, "src"), {
	recursive: true,
})
	.map((name) => `src/${name}`)
	.filter((path) => path.endsWith(".test.ts"));

/**
 * The killing set: the model's own unit tests, and the CM engine's, which
 * reuses the model's accessors and is mutated beside it.
 */
const own = tests.filter((path) => /^src\/(model[.-]|cm\/engine\/)/.test(path));

/**
 * What Bun would run for the filters. A positional filter is a substring of
 * the path, not a prefix: `bun test model-est` runs `src/model-estimate.test.ts`.
 */
const matching = tests.filter((path) =>
	filters.some((filter) => path.includes(filter)),
);

describe("the killing command", () => {
	// spec: mutation-floor/the-model-s-tests-move-to-another-file
	test("reaches the model's test files and no others", () => {
		expect(config.commandRunner.command).toStartWith("bun test ");
		// Both directions, because either one alone passes on a broken config:
		// naming one file kills nothing moved out of it, and widening to `src`
		// pulls eleven unrelated files into the killing set.
		expect(matching.toSorted()).toEqual(own.toSorted());
		// Without siblings the equality above holds for a file name too.
		expect(own.length).toBeGreaterThan(1);
	});

	test("mutates the model, its shared terms and the CM engine, never the engine's tests", () => {
		expect(config.mutate).toEqual([
			"src/model.ts",
			"src/model-terms.ts",
			"src/cm/engine/**/*.ts",
			"!src/cm/engine/**/*.test.ts",
		]);
	});
});
