#!/usr/bin/env bun
/**
 * `PreToolUse` guard for every Bash call, registered in
 * `.claude/settings.json`. It blocks the prohibitions no permission entry can
 * express: a commit while `HEAD` is on `main`, a force-push wherever the flag
 * sits, and the `gh` commands that publish text on the user's behalf.
 *
 * It runs without an `if` field on purpose. A permission pattern — which is
 * what `if` takes — matches the command word literally, so `/usr/bin/git` and
 * `command gh` never reach a hook narrowed that way. Deciding here instead
 * costs one bun start per Bash call, measured at 16-22 ms, and buys a boundary
 * that a spelling does not walk around.
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
		"command-guard: the hook event carried no readable tool_input.command, so this command could not be checked. Blocked rather than allowed, because an unread command is the case the guard exists for.",
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
		"command-guard: could not read the current branch — a detached HEAD, no work tree, or an unreadable -C target. A commit cannot be checked against main, so it is blocked.",
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

/**
 * Words that run the command after them, so the guarded name is further along:
 * `command git`, `env GIT_TRACE=1 git`. Each takes no option of its own in any
 * form worth supporting — `sudo -u` and friends are absent for that reason.
 */
const WRAPPERS = new Set(["command", "builtin", "exec", "env"]);

/** Shells whose `-c` argument is another command to look inside. */
const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);

/** The `gh` subcommand pairs that publish text on the user's behalf. */
const GH_WRITES = [
	["pr", "comment"],
	["issue", "comment"],
	["pr", "review"],
];

/**
 * The command a fragment invokes, by its base name, with its arguments —
 * leading assignments and wrapper words stripped. `/usr/bin/git` and
 * `command git` both resolve to `git`, which is the whole point of deciding
 * here rather than in a permission pattern.
 */
function invocation(words: string[]): [string, string[]] | undefined {
	for (let at = 0; at < words.length; at++) {
		const word = words[at] ?? "";
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue;
		const name = word.split("/").pop() ?? "";
		if (WRAPPERS.has(name)) continue;
		return [name, words.slice(at + 1)];
	}
	return undefined;
}

function check(command: string): void {
	for (const part of subcommands(command)) {
		const found = invocation(part.trim().split(/\s+/).filter(Boolean));
		if (!found) continue;
		const [name, rest] = found;

		if (SHELLS.has(name) && rest[0] === "-c") {
			// `bash -c "git push --force"` — the quotes survive our splitting,
			// so strip one layer and look at what is inside.
			check(
				rest
					.slice(1)
					.join(" ")
					.replace(/^(["'])(.*)\1$/s, "$2"),
			);
			continue;
		}

		if (name === "gh") {
			// Adjacent anywhere, not the first two words: a global flag's value
			// sits in front of them in `gh --repo a/b pr comment`.
			const plain = rest.filter((word) => !word.startsWith("-"));
			const write = GH_WRITES.find(([a, b]) =>
				plain.some((word, at) => word === a && plain[at + 1] === b),
			);
			if (write) {
				block(
					`command-guard: \`gh ${write.join(" ")}\` publishes text under the user's name. Report what you would have written and let them send it.`,
				);
			}
			continue;
		}

		if (name !== "git") continue;

		let at = 0;
		let target: string | undefined;
		for (let word = rest[at]; word?.startsWith("-"); word = rest[at]) {
			if (word === "-C") target = rest[at + 1];
			at += VALUE_OPTIONS.has(word) ? 2 : 1;
		}
		const subcommand = rest[at];
		const args = rest.slice(at + 1);

		if (subcommand === "commit" && currentBranch(target) === "main") {
			block(
				"command-guard: HEAD is on main and this project never commits there. Branch first, then commit on the branch.",
			);
		}
		if (subcommand === "push" && args.some((arg) => FORCE.test(arg))) {
			block(
				"command-guard: force-pushing is the user's, not the agent's — the boundary is the rewrite, not how carefully it is leased. Ask the user to run it.",
			);
		}
	}
}

check(command);
