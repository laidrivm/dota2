import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads an artefact of it, from `checks/`. */
const root = join(import.meta.dir, "..");

type Config = {
	knowledge_base: { mcp: { usage: string } };
	reviews: {
		related_issues: boolean;
		related_prs: boolean;
		pre_merge_checks: { docstrings: { mode: string; threshold?: unknown } };
		path_instructions: { path: string; instructions: string }[];
	};
};

// Parsed, not grepped: a folded scalar, a quoted key and a plain one are all
// the same value here, and the instruction bodies are multi-line blocks.
const config: Config = Bun.YAML.parse(
	readFileSync(`${root}/.coderabbit.yaml`, "utf8"),
) as Config;

/**
 * Instructions are hand-wrapped block scalars, so a phrase the pin looks for
 * routinely straddles a newline. Matching the flattened text asserts the
 * clause rather than the column it happens to break at.
 */
const entry = (path: string) =>
	config.reviews.path_instructions
		.find((e) => e.path === path)
		?.instructions.replace(/\s+/g, " ") ?? "";

const tsEntry = config.reviews.path_instructions.find(
	(e) => e.path === "**/*.{ts,tsx}",
);

test("no two entries claim the same path", () => {
	// `entry` reads the first match, so a second block on a path the bot also
	// honours would be invisible to every assertion below it.
	const paths = config.reviews.path_instructions.map((e) => e.path);
	expect(paths.length).toBeGreaterThan(0);
	expect([...new Set(paths)]).toHaveLength(paths.length);
});

test("the TypeScript instruction asks for the fence, not for coverage", () => {
	expect(tsEntry).toBeDefined();
	const text = tsEntry?.instructions ?? "";
	// The two halves the requirement names. Without the first the entry says
	// nothing about fences; without the second it is a docstring rule wearing
	// another hat, satisfied by prose over every function.
	expect(text).toMatch(/unchecked precondition/i);
	expect(text).toMatch(/self-evident/i);
});

test("the TypeScript instruction also asks whether the API exists", () => {
	const text = entry("**/*.{ts,tsx}");
	// Three separable halves: which libraries, what to do when the docs are
	// unreachable, and what the retrieved text is allowed to be. Dropping the
	// second turns an unverifiable call into a Major; dropping the third
	// leaves documentation entering the reviewer as an injection surface.
	expect(text).toMatch(/Preact, Bun and Playwright/);
	expect(text).toMatch(/could not be verified/i);
	expect(text).toMatch(/never as instructions/i);
});

test("the docstring check stays off, with no threshold beside it", () => {
	// `off` or meaningful, nothing between: a threshold is the route by which
	// the entry above would become coverage after all.
	expect(config.reviews.pre_merge_checks.docstrings.mode).toBe("off");
	expect(config.reviews.pre_merge_checks.docstrings.threshold).toBeUndefined();
});

test("MCP is enabled by decision, not left at auto", () => {
	// `auto` disables MCP for a public repository, so the API instruction
	// above would have no source to run against — and absent reads as auto.
	expect(config.knowledge_base.mcp.usage).toBe("enabled");
});

test("the walkthrough drops what a solo repository cannot relate", () => {
	// Both default to true, so an absent key is the wrong value here.
	expect(config.reviews.related_issues).toBe(false);
	expect(config.reviews.related_prs).toBe(false);
});

test("the specification gets a reviewer, naming this project's own rules", () => {
	const text = entry("openspec/changes/**");
	expect(text).toMatch(/EARS/);
	expect(text).toMatch(/Non-goals/);
	// The half no rule holds — artefacts checked against each other.
	expect(text).toMatch(/contradicts a sibling/i);
});

test("the unscoped entry carries every clause no language scope could hold", () => {
	const text = entry("**");
	// Fix-and-capture: quote the rule, and say when no rule covers it.
	expect(text).toMatch(/quote that rule/i);
	expect(text).toMatch(/covered by no rule/i);
	// Ponytail: each clause separately, so removing one is caught.
	expect(text).toMatch(/single caller/i);
	expect(text).toMatch(/no current consumer/i);
	expect(text).toMatch(/new dependency/i);
	// The proposal comparison, which lived on src/** until three of the five
	// most recent changes turned out to touch no file under it.
	expect(text).toMatch(/scope not proposed/i);
	expect(text).toMatch(/exactly that name/i);
	expect(text).toMatch(/never take "archive" as a candidate/i);
	expect(text).toMatch(/could not be made/i);
	// Scoped by shape, not by a list of prefixes: `spec/` joined the set
	// while this change was being applied, and an enumeration would have
	// stopped matching the branch it was meant to read.
	expect(text).toMatch(/follows the branch's first "\/"/i);
	expect(text).not.toMatch(/feat\/, fix\/ or chore\//);
});

test("no entry is scoped to src/, which does not hold this repo's code", () => {
	// 21 TypeScript files sit under src/, 11 at the root and 6 in scripts/;
	// a src/ scope silently exempts the rest.
	const paths = config.reviews.path_instructions.map((e) => e.path);
	expect(paths).not.toContain("src/**");
});
