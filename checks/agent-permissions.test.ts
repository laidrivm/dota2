import { describe, expect, test } from "bun:test";
import { bashDeny, managers, settings } from "./agent-permissions.fixture.ts";

/**
 * What the policy refuses outright, and the guard that catches what a
 * permission pattern cannot express. What prompts instead is
 * `agent-permissions-prompts.test.ts`'s, and what is pre-approved is
 * `agent-permissions-allow.test.ts`'s.
 */

/** The `gh` commands that publish text on the user's behalf. */
const ghWrites = ["gh pr comment", "gh issue comment", "gh pr review"];

/** Whether a command matches a deny entry, by the prefix each one names. */
function isDenied(command: string): boolean {
	return bashDeny.some((entry) => {
		const prefix = entry.match(/^Bash\((.+) \*\)$/)?.[1];
		return prefix !== undefined && command.startsWith(`${prefix} `);
	});
}

test("the deny list is the foreign managers and the GitHub write commands", () => {
	expect(bashDeny).toEqual(
		[...managers, ...ghWrites].map((cmd) => `Bash(${cmd} *)`),
	);
});

test("deny entries keep their word boundary", () => {
	// The trailing-space form is the only one that holds: `Bash(npm*)` would
	// also block `npmlog`, and `Bash(command:npm *)` is ignored by Claude
	// Code, which warns about it at startup — a boundary that only looks
	// like one. Both fail this pattern, as does `Bash(npm:*)`. The optional
	// further words are `gh pr comment` and its siblings.
	for (const entry of bashDeny) {
		expect(entry).toMatch(/^Bash\([a-z-]+( [a-z-]+)* \*\)$/);
	}
});

test("only the GitHub write commands are denied", () => {
	// Opening the pull request is the last step of the feature workflow and is
	// taken once the user says go, so `gh pr create` must stay reachable; the
	// read commands were never in scope.
	expect(isDenied("gh pr comment 37 --body fixed")).toBe(true);
	expect(isDenied("gh pr review 37 --approve")).toBe(true);
	expect(isDenied("gh pr create --title x --body y")).toBe(false);
	expect(isDenied("gh pr view 37 --json state")).toBe(false);
});

describe("the command guard is registered", () => {
	const hooks = (settings.hooks?.PreToolUse ?? [])
		.filter((entry: { matcher?: string }) => entry.matcher === "Bash")
		.flatMap((entry: { hooks?: unknown[] }) => entry.hooks ?? []) as {
		type?: string;
		if?: string;
		command?: string;
	}[];
	const hook = hooks[0];

	test("one entry covers every Bash call", () => {
		// No `if` field, deliberately: it takes a permission pattern, which
		// matches the command word literally, so `/usr/bin/git` and
		// `command gh` would walk around a hook narrowed that way. The script
		// decides instead, and it must therefore see everything.
		expect(hooks).toHaveLength(1);
		expect(hook?.type).toBe("command");
		expect(hook?.if).toBeUndefined();
	});

	test("it runs the tracked script under bun", () => {
		// Pinned whole rather than by loose matches, which
		// `bun "…/command-guard.ts"; true || exit 2` would satisfy while never
		// blocking anything. The `|| exit 2` matters because a guard that
		// cannot launch — bun absent, the path unresolved — exits 1, which
		// Claude Code treats as non-blocking and runs the command anyway.
		const path = "scripts/command-guard.ts";
		expect(hook?.command).toBe(
			`bun "\${CLAUDE_PROJECT_DIR}/${path}" || exit 2`,
		);
		const tracked = Bun.spawnSync(
			["git", "ls-files", "--error-unmatch", path],
			{
				cwd: import.meta.dir,
			},
		);
		expect(tracked.exitCode).toBe(0);
	});
});
