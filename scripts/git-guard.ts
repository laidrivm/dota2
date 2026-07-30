#!/usr/bin/env bun
/**
 * `PreToolUse` guard for git, registered in `.claude/settings.json`. It blocks
 * the two prohibitions no prefix-matched permission entry can express: a
 * commit while `HEAD` is on `main`, and a force-push wherever the flag sits.
 *
 * Exit 0 allows and exit 2 blocks, with the reason on stderr — those are the
 * only two codes Claude Code reads as a decision. Every other non-zero code is
 * non-blocking, so an event this script cannot decide takes the blocking one
 * as well.
 */

function block(reason: string): never {
	process.stderr.write(`${reason}\n`);
	process.exit(2);
}

/**
 * Global options that swallow the token after them, so the subcommand of
 * `git -C some/dir commit` resolves to `commit` and not to the path.
 * `--exec-path` is absent on purpose: bare, it prints the path and runs
 * nothing, so treating the next token as its value would be wrong.
 */
const VALUE_OPTIONS = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--namespace",
]);

/**
 * Whole arguments only: `--follow-tags` and `--fixup` share a prefix with
 * neither, and a `--force` inside a quoted string is not an argument of its
 * own. Short flags bundle — git reads `push -uf` as `-u -f` — so the
 * single-dash form matches an `f` anywhere in the group, and `-f` is the only
 * short option of `git push` that carries one.
 */
const FORCE =
	/^(-[a-z0-9]*f[a-z0-9]*|--force(-with-lease|-if-includes)?(=.*)?)$/;

const payload = await Bun.stdin.json().catch(() => null);
const command = payload?.tool_input?.command;
if (typeof command !== "string") {
	block(
		"git-guard: the hook event carried no readable tool_input.command, so this git command could not be checked. Blocked rather than allowed, because an unread command is the case the guard exists for.",
	);
}

/** The branch `HEAD` points at, or a block when git cannot say. */
function currentBranch(): string {
	const head = Bun.spawnSync([
		"git",
		"symbolic-ref",
		"--quiet",
		"--short",
		"HEAD",
	]);
	if (head.exitCode !== 0) {
		block(
			"git-guard: could not read the current branch — a detached HEAD or no work tree here. A commit cannot be checked against main, so it is blocked.",
		);
	}
	return head.stdout.toString().trim();
}

/**
 * Splits on the separators that start a new command, ignoring any inside
 * quotes: `git push origin "a;b" --force` is one command, and
 * `git log --grep="x; git commit"` is not two.
 */
function subcommands(line: string): string[] {
	const parts: string[] = [];
	let quote = "";
	let start = 0;
	for (let at = 0; at < line.length; at++) {
		const char = line[at];
		if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === ";" || char === "\n" || char === "|" || char === "&") {
			parts.push(line.slice(start, at));
			while (line[at + 1] === "&" || line[at + 1] === "|") at++;
			start = at + 1;
		}
	}
	parts.push(line.slice(start));
	return parts;
}

// The `if` field already matched each subcommand of a compound command
// independently; this split finds the git one again inside the whole string.
for (const part of subcommands(command)) {
	const words = part.trim().split(/\s+/).filter(Boolean);
	while (words[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) {
		words.shift(); // a leading VAR=value assignment
	}
	if (words.shift() !== "git") continue;

	let at = 0;
	for (let word = words[at]; word?.startsWith("-"); word = words[at]) {
		at += VALUE_OPTIONS.has(word) ? 2 : 1;
	}
	const subcommand = words[at];
	const args = words.slice(at + 1);

	if (subcommand === "commit" && currentBranch() === "main") {
		block(
			"git-guard: HEAD is on main and this project never commits there. Branch first, then commit on the branch.",
		);
	}
	if (subcommand === "push" && args.some((arg) => FORCE.test(arg))) {
		block(
			"git-guard: force-pushing is the user's, not the agent's — the boundary is the rewrite, not how carefully it is leased. Ask the user to run it.",
		);
	}
}
