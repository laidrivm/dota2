// Tests for the documentation changes that accompany Task 6 (git hooks):
// README.md's new "Git hooks" section, PLAN.md's queue update, and the
// "Status: DONE" note prepended to tasks/task-6.md. These guard against
// docs drifting from the actual package.json configuration they describe.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const readme = readFileSync(join(rootDir, "README.md"), "utf8");
const plan = readFileSync(join(rootDir, "PLAN.md"), "utf8");
const task6 = readFileSync(join(rootDir, "tasks", "task-6.md"), "utf8");

function readPackageJson() {
	return JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
}

describe("README.md - Git hooks section", () => {
	test("has a 'Git hooks' section", () => {
		expect(readme).toContain("## Git hooks");
	});

	test("states hooks install automatically via the prepare script", () => {
		expect(readme).toContain("Installed automatically by `bun install`");
		expect(readme).toContain("`prepare` script runs");
		expect(readme).toContain("`simple-git-hooks`");
	});

	test("documents the pre-commit hook and that it does not autofix", () => {
		expect(readme).toContain("**pre-commit** — `biome check --staged`");
		expect(readme).toContain("does **not** autofix");
		expect(readme).toContain("bun run lint:fix");
	});

	test("documents the pre-push hook and the zero-tests guard", () => {
		expect(readme).toContain(
			"**pre-push** — `tsc --noEmit` then `bun test`",
		);
		expect(readme).toContain("--pass-with-no-tests");
	});

	test("documents --no-verify as an emergency exit, not a workflow", () => {
		expect(readme).toContain(
			"`--no-verify` bypasses a hook — an emergency exit, not a workflow.",
		);
	});

	test("does not claim the pre-commit hook autofixes staged files", () => {
		// Regression guard for the deliberate --write deviation: the docs must
		// never re-introduce the claim that pre-commit fixes files in place.
		expect(readme).not.toContain("biome check --staged --write");
	});
});

describe("PLAN.md - Task 6 queue entry", () => {
	const lines = plan.split("\n");
	const task6LineIndex = lines.findIndex((line) => line.includes("**Task 6**"));
	const task6Line = lines[task6LineIndex];

	test("lists a Task 6 line in the queue", () => {
		expect(task6LineIndex).toBeGreaterThanOrEqual(0);
	});

	test("marks Task 6 as complete", () => {
		expect(task6Line).toMatch(/^-\s*\[x\]\s*\*\*Task 6\*\*/);
	});

	test("no longer flags Task 6 itself as the next step", () => {
		expect(task6Line).not.toContain("next step");
	});

	test("mentions the pre-commit/pre-push behaviour and the /warm follow-up", () => {
		const task6Block = lines.slice(task6LineIndex, task6LineIndex + 3).join(" ");
		expect(task6Block).toContain("pre-commit");
		expect(task6Block).toContain("pre-push");
		expect(task6Block).toContain("/warm");
	});

	test("moves the '← next step' marker to the Phase 1 entry", () => {
		const phase1Index = plan.indexOf("**Phase 1**");
		expect(phase1Index).toBeGreaterThan(0);
		const phase1Block = plan.slice(phase1Index, phase1Index + 300);
		expect(phase1Block).toContain("next step");
	});
});

describe("tasks/task-6.md - completion callout", () => {
	test("opens with a DONE status callout right after the title", () => {
		expect(task6).toMatch(/^# Task 6[^\n]*\n\n> \*\*Status: DONE\.\*\*/);
	});

	test("documents the pre-commit deviation (no --write)", () => {
		expect(task6).toContain("without `--write`");
	});

	test("documents the pre-push deviation (native --pass-with-no-tests flag)", () => {
		expect(task6).toContain("--pass-with-no-tests");
		expect(task6).toContain("no wrapper");
	});

	test("points at package.json as the single source of live config", () => {
		expect(task6).toContain("`package.json` → `simple-git-hooks`");
	});

	test("still contains the original acceptance criteria checklist", () => {
		expect(task6).toContain("## Acceptance criteria");
	});
});

describe("cross-file consistency between docs and package.json", () => {
	const pkg = readPackageJson();
	const preCommit: string = pkg["simple-git-hooks"]["pre-commit"];
	const prePush: string = pkg["simple-git-hooks"]["pre-push"];

	test("README's pre-commit description matches the real config (no --write)", () => {
		expect(preCommit).not.toContain("--write");
		expect(readme).not.toContain("--staged --write");
	});

	test("README's pre-push description matches the real --pass-with-no-tests flag", () => {
		expect(prePush).toContain("--pass-with-no-tests");
		expect(readme).toContain("--pass-with-no-tests");
	});

	test("task-6.md references the exact devDependency name declared in package.json", () => {
		const depName = "simple-git-hooks";
		expect(pkg.devDependencies?.[depName]).toBeDefined();
		expect(task6).toContain(depName);
	});
});