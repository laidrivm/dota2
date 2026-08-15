import { describe, expect, test } from "bun:test";
import {
	allow,
	ask,
	bashAsk,
	deny,
	managers,
} from "./agent-permissions.fixture.ts";

/**
 * What the policy stops to ask about rather than refusing: every invocation
 * that can rewrite a manifest or a lockfile, and the supply-chain
 * configuration behind them.
 */

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
		// alias per command that `--help` prints is discoverable this way, and
		// several gated commands print none — those are skipped rather than
		// enumerated out, so a command that gains an alias is covered the day
		// it does.
		//
		// The commands come from the gated list itself rather than a list
		// written here: an entry added above would otherwise have its alias
		// unchecked, which is the hole this test exists to close.
		const commands = [
			...new Set(
				bashAsk
					.map((entry) => /^Bash\(bun (\S+)/.exec(entry)?.[1])
					.filter((command) => command !== undefined),
			),
		];
		let found = 0;
		for (const command of commands) {
			const alias = bunHelp(command).match(/^Alias: bun (\S+)$/m)?.[1];
			if (alias === undefined) continue;
			found++;
			expect(ask).toContain(`Bash(bun ${alias} *)`);
		}
		// A bun that stopped printing aliases would skip every command and
		// pass every assertion above vacuously.
		expect(found).toBeGreaterThan(0);
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
		// wrong one. `NotebookEdit` and `Glob` are accepted and unmatched for
		// the same reason, so all three are named here. All three lists too,
		// not just the two that carry a file rule today: `allow` takes the
		// same specifier and would exempt one.
		for (const entry of [...deny, ...ask, ...allow]) {
			expect(entry).not.toMatch(/^(Write|NotebookEdit|Glob)\(/);
		}
	});

	test("nothing gated is granted back by the allow list", () => {
		// This does not depend on which tier outranks which: an entry
		// duplicating a gated one either re-opens the gate or is dead weight
		// that reads like a grant. Neither belongs. Exact restatements only —
		// a narrower entry under a broader gate, `Bash(npm view *)` under the
		// `Bash(npm *)` deny, is not caught here and was dropped by review.
		for (const entry of [...deny, ...ask]) {
			expect(allow).not.toContain(entry);
		}
	});
});
