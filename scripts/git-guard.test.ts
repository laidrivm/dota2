import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const guard = `${import.meta.dir}/git-guard.ts`;
const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
	const run = Bun.spawnSync(["git", ...args], { cwd });
	if (run.exitCode !== 0) throw new Error(run.stderr.toString());
}

/** A throwaway directory; `git init` only when a branch is asked for. */
function fabricate(branch?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "git-guard-"));
	made.push(dir);
	if (branch) git(dir, "init", "-b", branch);
	return dir;
}

function detached(): string {
	const dir = fabricate("main");
	git(
		dir,
		"-c",
		"user.email=t@e",
		"-c",
		"user.name=T",
		"commit",
		"--allow-empty",
		"-m",
		"x",
	);
	git(dir, "checkout", "--detach");
	return dir;
}

/** Runs the guard against a fabricated event and repository. */
function run(payload: unknown, cwd: string) {
	const call = Bun.spawnSync(["bun", guard], {
		cwd,
		stdin: Buffer.from(
			typeof payload === "string" ? payload : JSON.stringify(payload),
		),
		stderr: "pipe",
	});
	return { code: call.exitCode, reason: call.stderr.toString() };
}

const event = (command: unknown, description = "") => ({
	tool_name: "Bash",
	tool_input: { command, description },
});

describe("an event the guard cannot read", () => {
	test("a payload with no command blocks", () => {
		const { code, reason } = run(
			{ tool_name: "Bash", tool_input: {} },
			fabricate("main"),
		);
		expect(code).toBe(2);
		expect(reason).toContain("tool_input.command");
	});

	test("a payload that is not JSON blocks", () => {
		expect(run("not json at all", fabricate("main")).code).toBe(2);
	});

	test("a command that is not a string blocks", () => {
		expect(run(event(["git", "commit"]), fabricate("main")).code).toBe(2);
	});

	test("a commit outside a work tree blocks", () => {
		// No `git init` here: `symbolic-ref` fails, and a branch the guard
		// cannot read must not resolve to "not main".
		const { code, reason } = run(event("git commit -m x"), fabricate());
		expect(code).toBe(2);
		expect(reason).toContain("current branch");
	});

	test("a commit on a detached HEAD blocks", () => {
		expect(run(event("git commit -m x"), detached()).code).toBe(2);
	});
});

describe("committing while HEAD is on main", () => {
	test("a plain commit blocks", () => {
		const { code, reason } = run(event("git commit -m fix"), fabricate("main"));
		expect(code).toBe(2);
		expect(reason).toContain("Branch first");
	});

	test("a commit reached through a compound command blocks", () => {
		expect(
			run(event('git add -A && git commit -m "fix"'), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit whose compound command starts with something else blocks", () => {
		// The `if` field matches each subcommand, so the guard is reached; it
		// must find the git command past the first one for that to matter.
		expect(
			run(event("bun test && git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit behind a leading assignment blocks", () => {
		expect(
			run(event("GIT_TRACE=1 git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit behind a global option blocks", () => {
		expect(
			run(
				event("git -c core.hooksPath=/dev/null commit -m fix"),
				fabricate("main"),
			).code,
		).toBe(2);
	});

	test("the word commit inside an argument does not block", () => {
		expect(
			run(event('git log --grep="git commit"'), fabricate("main")).code,
		).toBe(0);
	});

	test("a branch merely starting with main does not block", () => {
		expect(run(event("git commit -m fix"), fabricate("mainline")).code).toBe(0);
	});

	test("a commit on a feature branch does not block", () => {
		expect(run(event("git commit -m fix"), fabricate("feat/x")).code).toBe(0);
	});

	test("a non-git command does not block", () => {
		expect(run(event("bun test"), fabricate("main")).code).toBe(0);
	});
});

describe("force-pushing", () => {
	const branch = () => fabricate("feat/x");

	test("the flag last still blocks", () => {
		const { code, reason } = run(
			event("git push origin feat/x --force"),
			branch(),
		);
		expect(code).toBe(2);
		expect(reason).toContain("force-pushing");
	});

	test("a lease-guarded force blocks", () => {
		expect(run(event("git push --force-with-lease"), branch()).code).toBe(2);
	});

	test("a lease with a value blocks", () => {
		expect(
			run(event("git push --force-with-lease=feat/x:abc123"), branch()).code,
		).toBe(2);
	});

	test("the short flag blocks", () => {
		expect(run(event("git push -f origin feat/x"), branch()).code).toBe(2);
	});

	test("an ordinary push does not block", () => {
		expect(run(event("git push -u origin feat/x"), branch()).code).toBe(0);
	});

	test("flags that merely share a prefix do not block", () => {
		expect(
			run(event("git push --follow-tags origin feat/x"), branch()).code,
		).toBe(0);
		expect(run(event("git commit --fixup HEAD"), branch()).code).toBe(0);
	});

	test("force in the description alone does not block", () => {
		// The guard reads `tool_input.command`; grepping the payload would
		// block this one on the description.
		expect(
			run(
				event("git push origin feat/x", "force the branch up to date"),
				branch(),
			).code,
		).toBe(0);
	});
});
