import { describe, expect, test } from "bun:test";

/**
 * The tracked settings, never `.claude/settings.local.json` — that one is
 * gitignored, so it is present for the author and absent in a clone.
 */
const settings = await Bun.file(
	`${import.meta.dir}/.claude/settings.json`,
).json();

/** Every package manager this project does not use. */
const managers = ["npx", "npm", "pnpm", "yarn"];

/** The `gh` commands that publish text on the user's behalf. */
const ghWrites = ["gh pr comment", "gh issue comment", "gh pr review"];

const deny: string[] = settings.permissions?.deny ?? [];
const ask: string[] = settings.permissions?.ask ?? [];

/** Whether a command matches a deny entry, by the prefix each one names. */
function isDenied(command: string): boolean {
	return deny.some((entry) => {
		const prefix = entry.match(/^Bash\((.+) \*\)$/)?.[1];
		return prefix !== undefined && command.startsWith(`${prefix} `);
	});
}

/** `bun <command> --help`, which prints across both streams. */
function bunHelp(command: string): string {
	const help = Bun.spawnSync(["bun", command, "--help"]);
	return help.stdout.toString() + help.stderr.toString();
}

test("the deny list is the foreign managers and the GitHub write commands", () => {
	expect(deny).toEqual(
		[...managers, ...ghWrites].map((cmd) => `Bash(${cmd} *)`),
	);
});

test("deny entries keep their word boundary", () => {
	// The trailing-space form is the only one that holds: `Bash(npm*)` would
	// also block `npmlog`, and `Bash(command:npm *)` is ignored by Claude
	// Code, which warns about it at startup — a boundary that only looks
	// like one. Both fail this pattern, as does `Bash(npm:*)`. The optional
	// further words are `gh pr comment` and its siblings.
	for (const entry of deny) {
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

describe("the git guard is registered", () => {
	const hook = (settings.hooks?.PreToolUse ?? [])
		.filter((entry: { matcher?: string }) => entry.matcher === "Bash")
		.flatMap((entry: { hooks?: unknown[] }) => entry.hooks ?? [])
		.find((each: { if?: string }) => each.if === "Bash(git *)") as
		| { type?: string; command?: string }
		| undefined;

	test("a PreToolUse entry narrows to git commands", () => {
		// Without the `if` field the guard would run a bun process on every
		// Bash call; without the entry it would never run at all.
		expect(hook?.type).toBe("command");
	});

	test("it runs the tracked script under bun", () => {
		// Pinned whole rather than by three loose matches, which
		// `bun "…/git-guard.ts"; true || exit 2` would satisfy while never
		// blocking anything. The `|| exit 2` matters because a guard that
		// cannot launch — bun absent, the path unresolved — exits 1, which
		// Claude Code treats as non-blocking and runs the command anyway.
		const path = "scripts/git-guard.ts";
		expect(hook?.command).toBe(
			`bun "\${CLAUDE_PROJECT_DIR}/${path}" || exit 2`,
		);
		const tracked = Bun.spawnSync(
			["git", "ls-files", "--error-unmatch", path ?? ""],
			{
				cwd: import.meta.dir,
			},
		);
		expect(tracked.exitCode).toBe(0);
	});
});

describe("every manifest-mutating invocation prompts", () => {
	test("every form that writes package.json is listed", () => {
		expect(ask).toEqual([
			"Bash(bun add *)",
			"Bash(bun a *)",
			"Bash(bun install *)",
			"Bash(bun i *)",
			"Bash(bun remove *)",
			"Bash(bun rm *)",
			"Bash(bun r *)",
			"Bash(bun uninstall *)",
			"Bash(bun update *)",
			"Bash(bun patch *)",
			"Bash(bun patch-commit *)",
			"Bash(bun pm pkg *)",
			"Bash(bun pm version *)",
			"Bash(bun pm trust *)",
		]);
	});

	test("the alias bun documents for each command is gated too", () => {
		// Read from the binary, so an upgrade that renames an alias fails here
		// rather than silently leaving a manifest write ungated. Only the one
		// alias per command that `--help` prints is discoverable this way.
		for (const command of ["add", "install", "remove"]) {
			const alias = bunHelp(command).match(/^Alias: bun (\S+)$/m)?.[1];
			expect(alias).toBeTruthy();
			expect(ask).toContain(`Bash(bun ${alias} *)`);
		}
	});

	test("every top-level form still resolves to a manifest write", () => {
		// The reverse direction: `bun rm`, `bun r` and `bun uninstall` appear
		// in no `Alias:` line, so this is what catches a release dropping one
		// and leaving behind an entry the spec claims is part of the surface.
		// `bun pm …` forms are nested subcommands rather than aliases, so
		// `--help` resolves them to `bun pm` and the list above pins them.
		for (const entry of ask) {
			const form = entry.match(/^Bash\(bun ([a-z-]+) \*\)$/)?.[1];
			if (!form) continue;
			expect(bunHelp(form)).toMatch(
				/^Usage: bun (add|install|remove|update|patch|patch-commit) /m,
			);
		}
	});

	test("ask entries keep their word boundary", () => {
		// `Bash(bun a*)` without the space would also cover `bun add`, so the
		// entry for the alias would silently stand in for the long form. The
		// optional second word is `bun pm pkg` and its siblings.
		for (const entry of ask) {
			expect(entry).toMatch(/^Bash\(bun [a-z-]+( [a-z-]+)? \*\)$/);
		}
	});

	test("no ask entry captures a command that writes nothing", () => {
		// Each form sits one word from a command that mutates no manifest:
		// `bun i` from `bun init`, `bun a` from `bun audit`, `bun r` from
		// `bun run`, `bun pm trust` from `bun pm untrusted` — which CLAUDE.md
		// requires staying ungated, since surfacing its output is how the user
		// gets to decide about `trustedDependencies`.
		for (const entry of ask) {
			const command = entry.match(/^Bash\((.+) \*\)$/)?.[1];
			for (const invocation of [
				"bun run build",
				"bun init",
				"bun audit",
				"bun pm untrusted",
				"bun pm why preact",
			]) {
				expect(invocation.startsWith(`${command} `)).toBe(false);
			}
		}
	});

	test("no ask entry names a denied manager", () => {
		// Deny is evaluated before ask, so such an entry can never be reached.
		for (const entry of ask) {
			for (const cmd of managers) {
				expect(entry).not.toMatch(new RegExp(`\\b${cmd}\\b`));
			}
		}
	});
});
