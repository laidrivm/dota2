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
 * Short flags bundle — git reads `push -uf` as `-u -f` — so the single-dash
 * form matches an `f` anywhere in the group, and `-f` is the only short option
 * of `git push` that carries one. The long form matches by prefix because git
 * accepts any unambiguous abbreviation: `--force-w` and `--force-i` are taken,
 * while `--forc` and `--fo` are rejected as ambiguous, so every spelling git
 * honours begins with `--force`. `--follow-tags` and `--fixup` do not.
 */
const FORCE = /^(-[a-z0-9]*f[a-z0-9]*$|--force)/;

const payload = await Bun.stdin.json().catch(() => null);
const command = payload?.tool_input?.command;
if (typeof command !== "string") {
	block(
		"git-guard: the hook event carried no readable tool_input.command, so this git command could not be checked. Blocked rather than allowed, because an unread command is the case the guard exists for.",
	);
}

/**
 * The branch `HEAD` points at in `cwd` — the `-C` target when the command
 * names one, since that is the repository the commit would land in — or a
 * block when git cannot say.
 */
function currentBranch(cwd?: string): string {
	try {
		const head = Bun.spawnSync(
			["git", "symbolic-ref", "--quiet", "--short", "HEAD"],
			{ cwd },
		);
		if (head.exitCode === 0) return head.stdout.toString().trim();
	} catch {
		// An unreadable `-C` target makes spawnSync throw, which would exit
		// non-zero and non-blocking. Fall through to the block instead.
	}
	block(
		"git-guard: could not read the current branch — a detached HEAD, no work tree, or an unreadable -C target. A commit cannot be checked against main, so it is blocked.",
	);
}

/** Characters that end one command and start the next, outside quotes. */
const SEPARATORS = new Set([";", "\n", "|", "&", "(", ")", "`"]);

/**
 * Splits on the separators that start a new command, ignoring any inside
 * quotes: `git push origin "a;b" --force` is one command, and
 * `git log --grep="x; git commit"` is not two. A command substitution starts a
 * command even inside double quotes, which is where `echo "$(git commit)"`
 * would otherwise hide one — the shell substitutes there, and so does the
 * hook's own `if` field.
 */
function subcommands(line: string): string[] {
	const parts: string[] = [];
	let quote = "";
	let start = 0;
	for (let at = 0; at < line.length; at++) {
		const char = line.charAt(at);
		if (char === "$" && line[at + 1] === "(" && quote !== "'") {
			parts.push(line.slice(start, at));
			quote = "";
			at++;
			start = at + 1;
		} else if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (SEPARATORS.has(char)) {
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
	let target: string | undefined;
	for (let word = words[at]; word?.startsWith("-"); word = words[at]) {
		if (word === "-C") target = words[at + 1];
		at += VALUE_OPTIONS.has(word) ? 2 : 1;
	}
	const subcommand = words[at];
	const args = words.slice(at + 1);

	if (subcommand === "commit" && currentBranch(target) === "main") {
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
