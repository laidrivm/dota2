import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const root = import.meta.dir;

type Config = {
	reviews: {
		pre_merge_checks: { docstrings: { mode: string; threshold?: unknown } };
		path_instructions: { path: string; instructions: string }[];
	};
};

// Parsed, not grepped: a folded scalar, a quoted key and a plain one are all
// the same value here, and the instruction bodies are multi-line blocks.
const config: Config = Bun.YAML.parse(
	readFileSync(`${root}/.coderabbit.yaml`, "utf8"),
) as Config;

const tsEntry = config.reviews.path_instructions.find(
	(e) => e.path === "**/*.{ts,tsx}",
);

test("the TypeScript instruction asks for the fence, not for coverage", () => {
	expect(tsEntry).toBeDefined();
	const text = tsEntry?.instructions ?? "";
	// The two halves the requirement names. Without the first the entry says
	// nothing about fences; without the second it is a docstring rule wearing
	// another hat, satisfied by prose over every function.
	expect(text).toMatch(/unchecked precondition/i);
	expect(text).toMatch(/self-evident/i);
});

test("the docstring check stays off, with no threshold beside it", () => {
	// `off` or meaningful, nothing between: a threshold is the route by which
	// the entry above would become coverage after all.
	expect(config.reviews.pre_merge_checks.docstrings.mode).toBe("off");
	expect(config.reviews.pre_merge_checks.docstrings.threshold).toBeUndefined();
});
