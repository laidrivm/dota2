import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { links } from "harness/bun/check.ts";
import { root } from "./root.ts";

/**
 * The skill links' contract, run through the installed package's link check:
 * over this tree, and over trees fabricated to break it one way each.
 */

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A repository tracking one skill link, `name`, pointing at `target`. */
function tracking(name: string, target: string): string {
	const dir = mkdtempSync(join(tmpdir(), "harness-links-"));
	made.push(dir);
	Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
	mkdirSync(join(dir, ".claude/skills"), { recursive: true });
	symlinkSync(target, join(dir, ".claude/skills", name));
	Bun.spawnSync(["git", "add", ".claude/skills"], { cwd: dir });
	return dir;
}

describe("the skill links", () => {
	// spec: harness-consumption/a-link-into-the-package
	test("every link this tree tracks resolves into the package", () => {
		expect(links(root)).toEqual([]);
	});

	// spec: harness-consumption/a-link-into-another-checkout
	test("a link to a sibling checkout is named with its target", () => {
		const target = "../../../skills/triage";
		const problems = links(tracking("triage", target)).join("\n");
		expect(problems).toContain(`.claude/skills/triage: links to ${target}`);
		expect(problems).toContain("outside node_modules/harness/");
	});

	// spec: harness-consumption/a-link-the-package-no-longer-carries
	test("a link to a skill the package lacks is named", () => {
		const target = "../../node_modules/harness/core/skills/retired";
		const problems = links(tracking("retired", target)).join("\n");
		expect(problems).toContain(".claude/skills/retired");
		expect(problems).toContain("holds no SKILL.md");
	});
});
