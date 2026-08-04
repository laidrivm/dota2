import { describe, expect, test } from "bun:test";
// Imported rather than pattern-matched: bun parses TOML natively, and a
// regex over the text would read a commented-out key as a live one.
import bunfig from "./bunfig.toml";

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

/**
 * The command rules. Both lists also carry file rules, whose specifier is a
 * path and not a command line, so every assertion that reads an entry word by
 * word takes this subset rather than the list.
 */
const bashDeny = deny.filter((entry) => entry.startsWith("Bash("));
const bashAsk = ask.filter((entry) => entry.startsWith("Bash("));

/** Whether a command matches a deny entry, by the prefix each one names. */
function isDenied(command: string): boolean {
	return bashDeny.some((entry) => {
		const prefix = entry.match(/^Bash\((.+) \*\)$/)?.[1];
		return prefix !== undefined && command.startsWith(`${prefix} `);
	});
}

/**
 * `bun <command> --help`, which prints across both streams. The escapes are
 * stripped because bun colours this output depending on the environment it is
 * spawned into, and the assertions below anchor on `Usage:` and `Alias:` at
 * the start of a line — which a colour code silently moves.
 */
// Built from a char code rather than written into a regex literal, where the
// escape is a literal control character — which Biome forbids, and which this
// project forbids silencing.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function bunHelp(command: string): string {
	const help = Bun.spawnSync(["bun", command, "--help"]);
	return (help.stdout.toString() + help.stderr.toString()).replace(ANSI, "");
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

describe("every manifest-mutating invocation prompts", () => {
	test("every form that writes package.json is listed", () => {
		expect(bashAsk).toEqual([
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
		for (const entry of bashAsk) {
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
		for (const entry of bashAsk) {
			expect(entry).toMatch(/^Bash\(bun [a-z-]+( [a-z-]+)? \*\)$/);
		}
	});

	test("no ask entry captures a command that writes nothing", () => {
		// Each form sits one word from a command that mutates no manifest:
		// `bun i` from `bun init`, `bun a` from `bun audit`, `bun r` from
		// `bun run`, `bun pm trust` from `bun pm untrusted` — which CLAUDE.md
		// requires staying ungated, since surfacing its output is how the user
		// gets to decide about `trustedDependencies`.
		for (const entry of bashAsk) {
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

describe("the supply-chain configuration files are gated", () => {
	test(".npmrc is denied outright", () => {
		// The repository deliberately has none, and bun reads it as a registry
		// source, so the file existing at all is the event to stop. Written
		// bare rather than as `/.npmrc`: a bare filename matches at any depth,
		// and an anchored one would leave a subdirectory copy ungated.
		expect(deny).toContain("Edit(.npmrc)");
	});

	test("bunfig.toml is asked and not denied", () => {
		// Asked, because `[test] pathIgnorePatterns` and the release-age gate
		// are legitimate content this project already edits; denying the file
		// would block them. Deny is evaluated first, so an entry there would
		// make the ask entry unreachable — which is why both halves are
		// asserted.
		expect(ask).toContain("Edit(bunfig.toml)");
		expect(deny).not.toContain("Edit(bunfig.toml)");
	});

	test("no file rule is written in the form that never matches", () => {
		// The file permission checks match `Edit(path)` only; a `Write(path)`
		// rule is accepted, warns at startup, and gates nothing. `Edit` already
		// covers every file-editing tool, so the natural-reading form is the
		// wrong one. All three lists, not just the two that carry a file rule
		// today: `allow` takes the same specifier and would exempt one.
		const allow: string[] = settings.permissions?.allow ?? [];
		for (const entry of [...deny, ...ask, ...allow]) {
			expect(entry).not.toMatch(/^Write\(/);
		}
	});
});

describe("the keys the gate is for still hold their reserved value", () => {
	// The prompt is not a proof: a shell redirection writes either file with
	// no `Edit` call, a permission mode answers the prompt without the user,
	// and a subprocess writes outside the tool layer. Each passes the rules
	// above and none passes these, which read the settled content instead of
	// the call that produced it.
	test("the release-age gate exempts nothing", () => {
		// `bunfig.toml`'s own comment: keep empty, add entries only with an
		// explicit user decision.
		expect(bunfig.install.minimumReleaseAgeExcludes).toEqual([]);
	});

	test("no registry is configured in bunfig.toml", () => {
		// A registry is a supply-chain root of trust; `CLAUDE.md` reserves
		// adding one for the user, outside any coding task.
		expect(bunfig.install.registry).toBeUndefined();
	});

	test("no .npmrc is tracked at any depth", () => {
		// The premise the deny rule rests on. bun reads `.npmrc` as a registry
		// source, so one arriving in a clone is a root of trust nobody chose —
		// and a bare `Edit(.npmrc)` rule matches at any depth for the same
		// reason this looks repository-wide.
		const tracked = Bun.spawnSync(
			["git", "ls-files", "--", "**/.npmrc", ".npmrc"],
			{
				cwd: import.meta.dir,
			},
		);
		expect(tracked.stdout.toString().trim()).toBe("");
	});
});
