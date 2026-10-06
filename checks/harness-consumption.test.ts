import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./root.ts";

/**
 * How this repository consumes the pinned harness, checked against the tree
 * and against fabricated clones of it. The harness's own suite tests each
 * check; these cases assert this repository is wired to them.
 */

const settings = await Bun.file(join(root, ".claude/settings.json")).json();
const hook: string = settings.hooks.PreToolUse[0].hooks[0].command;

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/**
 * A clone on `main`, with the installed harness linked in when asked. Built
 * under the system temp directory, which holds no `.env` for bun to read.
 */
function clone(installed: boolean): string {
	const dir = mkdtempSync(join(tmpdir(), "harness-consumption-"));
	made.push(dir);
	Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
	if (installed) {
		mkdirSync(join(dir, "node_modules"));
		symlinkSync(
			join(root, "node_modules/harness"),
			join(dir, "node_modules/harness"),
		);
	}
	return dir;
}

/**
 * The settings hook command run as Claude Code runs it: under a shell, with
 * the event on stdin and `CLAUDE_PROJECT_DIR` naming the clone. The
 * environment is only what the hook reads, so nothing the suite inherited
 * decides a case.
 */
function hookOn(dir: string, command: string) {
	const run = Bun.spawnSync(["sh", "-c", hook], {
		cwd: dir,
		env: {
			PATH: process.env.PATH ?? "",
			HOME: process.env.HOME ?? "",
			CLAUDE_PROJECT_DIR: dir,
		},
		stdin: Buffer.from(
			JSON.stringify({ cwd: dir, tool_name: "Bash", tool_input: { command } }),
		),
		stderr: "pipe",
	});
	return { code: run.exitCode, reason: run.stderr.toString() };
}

describe("before the harness is installed", () => {
	// spec: harness-consumption/a-fresh-clone
	test.each(["bun install", "bun i", "bun install --frozen-lockfile"])(
		"%s runs",
		(command) => {
			expect(hookOn(clone(false), command).code).toBe(0);
		},
	);

	// spec: harness-consumption/any-other-command-before-the-install
	test.each([
		"git status",
		"bun install left-pad",
		"bun install --registry https://registry.example.test",
		"bun install --cwd elsewhere",
		"bun install && git status",
	])("%s is blocked with the install named", (command) => {
		const { code, reason } = hookOn(clone(false), command);
		expect(code).toBe(2);
		expect(reason).toContain("bun install");
	});
});

describe("after the harness is installed", () => {
	// spec: harness-consumption/after-the-install
	test("a commit on main is refused by the package's guard", () => {
		const { code, reason } = hookOn(clone(true), "git commit -m x");
		expect(code).toBe(2);
		expect(reason).toContain("command-guard: HEAD is on main");
	});

	// spec: harness-consumption/after-the-install
	test("a command the guard allows runs, install or not", () => {
		expect(hookOn(clone(true), "git status").code).toBe(0);
	});
});
