/**
 * The shell-line reader `scripts/command-guard.ts` decides on: it turns one
 * `tool_input.command` into the invocations a shell would actually run, so the
 * guard's prohibitions read command names rather than spellings.
 *
 * It parses nothing beyond what deciding those prohibitions needs — no
 * redirections, no expansions, no operator precedence. Every uncertainty is
 * resolved towards seeing more commands rather than fewer, because a fragment
 * the reader misses is a fragment the guard never checks.
 */

/** Characters that end one command and start the next, outside quotes. */
const SEPARATORS = new Set([";", "\n", "|", "&", "(", ")"]);

/**
 * Splits a command line into commands, each a list of words with its quoting
 * removed. Quote-aware in both directions, and that matters twice over:
 *
 * - A separator inside quotes does not start a command, so
 *   `git push origin "a;b" --force` stays one and `git log --grep="x; git
 *   commit"` does not become two.
 * - A space inside quotes does not end a word, so `GIT_AUTHOR_NAME="Jane Doe"
 *   git commit` still resolves to `git`, and `git -C "some path" commit` still
 *   finds `commit`. Splitting on whitespace alone lost both.
 *
 * Command substitution starts a command even inside double quotes, in both of
 * the POSIX spellings — `$(…)` and backticks — because the shell substitutes
 * there and a guard that honoured only one would be walked around with the
 * other.
 */
export function commands(line: string): string[][] {
	const all: string[][] = [];
	let words: string[] = [];
	let word = "";
	let quote = "";

	const endWord = () => {
		if (word) words.push(word);
		word = "";
	};
	const endCommand = () => {
		endWord();
		if (words.length) all.push(words);
		words = [];
	};

	for (let at = 0; at < line.length; at++) {
		const char = line.charAt(at);
		if (char === "\\" && quote !== "'") {
			word += line.charAt(++at);
		} else if (quote === "'") {
			if (char === "'") quote = "";
			else word += char;
		} else if (char === "$" && line[at + 1] === "(") {
			endCommand();
			quote = ""; // inside the substitution the enclosing quote is not in force
			at++;
		} else if (char === "`") {
			endCommand();
			quote = "";
		} else if (quote === '"') {
			if (char === '"') quote = "";
			else word += char;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (SEPARATORS.has(char)) {
			endCommand();
		} else if (/\s/.test(char)) {
			endWord();
		} else {
			word += char;
		}
	}
	endCommand();
	return all;
}

/**
 * Words that run the command after them, so the guarded name is further along:
 * `command git`, `env GIT_TRACE=1 git`. Each takes no option of its own in any
 * form worth supporting — `sudo -u` and friends are absent for that reason.
 */
const WRAPPERS = new Set(["command", "builtin", "exec", "env"]);

/** Shells whose `-c` argument is another command to look inside. */
export const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);

/**
 * The command a fragment invokes, by its base name, with its arguments —
 * leading assignments and wrapper words stripped. `/usr/bin/git` and
 * `command git` both resolve to `git`, which is the whole point of deciding
 * here rather than in a permission pattern.
 */
export function invocation(words: string[]): [string, string[]] | undefined {
	for (let at = 0; at < words.length; at++) {
		const word = words[at] ?? "";
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue;
		const name = word.split("/").pop() ?? "";
		if (WRAPPERS.has(name)) continue;
		return [name, words.slice(at + 1)];
	}
	return undefined;
}
