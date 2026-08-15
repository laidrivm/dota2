import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const guard = `${import.meta.dir}/command-guard.ts`;
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
	const dir = mkdtempSync(join(tmpdir(), "command-guard-"));
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

	test("a commit after a semicolon blocks", () => {
		expect(
			run(event("git status; git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit on its own line blocks", () => {
		expect(
			run(event("bun test\ngit commit -m fix"), fabricate("main")).code,
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

	test("a separator inside quotes does not start a new command", () => {
		// Splitting here would leave the fragment `git commit -m x"`, and a
		// read command would be blocked as a commit.
		expect(
			run(event('git log --grep="x; git commit -m x"'), fabricate("main")).code,
		).toBe(0);
	});

	test("a commit inside a command substitution blocks", () => {
		expect(
			run(event("echo $(git commit -m fix)"), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit inside backticks blocks", () => {
		expect(run(event("echo `git commit -m fix`"), fabricate("main")).code).toBe(
			2,
		);
	});

	test("a commit inside a substitution within double quotes blocks", () => {
		// The shell substitutes inside double quotes, so quote tracking alone
		// would hide this one.
		expect(
			run(event('echo "$(git commit -m fix)"'), fabricate("main")).code,
		).toBe(2);
	});

	test("a commit aimed at another repository reads that repository", () => {
		// `-C` names where the commit lands; the guard's own cwd is irrelevant.
		const elsewhere = fabricate("main");
		expect(
			run(event(`git -C ${elsewhere} commit -m fix`), fabricate("feat/x")).code,
		).toBe(2);
	});

	test("a commit aimed at a feature branch elsewhere does not block", () => {
		const elsewhere = fabricate("feat/x");
		expect(
			run(event(`git -C ${elsewhere} commit -m fix`), fabricate("main")).code,
		).toBe(0);
	});

	test("a commit aimed at an unreadable target blocks", () => {
		expect(
			run(event("git -C /nonexistent/xyz commit -m fix"), fabricate("feat/x"))
				.code,
		).toBe(2);
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

describe("a spelling that walks around a permission pattern", () => {
	test("an absolute path is still git", () => {
		// The reason the hook carries no `if` field: a permission pattern
		// matches the command word literally, and this one is not `git`.
		expect(
			run(event("/usr/bin/git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a command builtin in front is stripped", () => {
		expect(
			run(event("command git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("env with an assignment in front is stripped", () => {
		expect(
			run(event("env GIT_TRACE=1 git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a shell -c argument is looked inside", () => {
		expect(
			run(event(`bash -c "git commit -m fix"`), fabricate("main")).code,
		).toBe(2);
	});

	test("a shell -c bundled with other flags is looked inside", () => {
		expect(
			run(event(`bash -lc "git commit -m fix"`), fabricate("main")).code,
		).toBe(2);
	});

	test("a shell -c after other flags is looked inside", () => {
		expect(
			run(event(`sh -eu -c "git commit -m fix"`), fabricate("main")).code,
		).toBe(2);
	});

	test("a wrapper's own option does not become the command", () => {
		// `env -i` clears the environment and still runs what follows. Stopping
		// at the first word that is neither an assignment nor a wrapper resolved
		// the invocation to `-i`, and the commit went unchecked.
		expect(run(event("env -i git commit -m fix"), fabricate("main")).code).toBe(
			2,
		);
	});

	test("a redirection in front of the command is not the command", () => {
		expect(
			run(event(">/tmp/nope git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a redirection with a spaced target is not the command", () => {
		// Two words rather than one, so skipping the operator alone would take
		// the target for the command name.
		expect(
			run(event("> /tmp/nope git commit -m fix"), fabricate("main")).code,
		).toBe(2);
	});

	test("a command merely ending in git does not block", () => {
		expect(run(event("mygit commit -m fix"), fabricate("main")).code).toBe(0);
	});
});

describe("quoting that hides the command from a naive tokeniser", () => {
	test("an assignment with a spaced value still resolves to git", () => {
		// `GIT_AUTHOR_NAME="Jane Doe"` splits into two words on whitespace, and
		// the second is neither an assignment nor a wrapper, so the invocation
		// used to resolve to `Doe"` and the commit went unchecked.
		expect(
			run(
				event(`GIT_AUTHOR_NAME="Jane Doe" git commit -m fix`),
				fabricate("main"),
			).code,
		).toBe(2);
	});

	test("a -C target containing a space is read whole", () => {
		const dir = mkdtempSync(join(tmpdir(), "command guard spaced "));
		made.push(dir);
		git(dir, "init", "-b", "main");
		expect(
			run(event(`git -C "${dir}" commit -m fix`), fabricate("feat/x")).code,
		).toBe(2);
	});

	test("a backtick substitution inside double quotes blocks", () => {
		// Backticks expand inside double quotes exactly as `$(…)` does, so a
		// guard honouring only one spelling is walked around with the other.
		expect(
			run(event('echo "`git commit -m fix`"'), fabricate("main")).code,
		).toBe(2);
	});

	test("a gh write inside a backtick substitution blocks", () => {
		expect(
			run(event('echo "`gh pr comment 37 --body x`"'), fabricate("feat/x"))
				.code,
		).toBe(2);
	});

	test("a global option taking a separate value does not shift the subcommand", () => {
		expect(
			run(
				event("git --config-env user.name=X commit -m fix"),
				fabricate("main"),
			).code,
		).toBe(2);
	});

	test("a command after a substitution inside quotes blocks", () => {
		// The substitution suspends the enclosing double quote; the closing one
		// used to be read as an opening quote instead, and everything after it —
		// the separator included — was swallowed into one quoted word.
		expect(
			run(event('echo "$(true)"; git commit -m fix'), fabricate("main")).code,
		).toBe(2);
	});

	test("a command after a backtick substitution inside quotes blocks", () => {
		expect(
			run(event('echo "`true`"; git commit -m fix'), fabricate("main")).code,
		).toBe(2);
	});

	test("a forbidden command as inert text does not block", () => {
		// The guard reads invocations, not any string that names one; a quoted
		// argument is data.
		expect(
			run(event(`printf 'git push --force'`), fabricate("feat/x")).code,
		).toBe(0);
	});
});

describe("gh commands that publish on the user's behalf", () => {
	const anywhere = () => fabricate("feat/x");

	test("a pull request comment blocks", () => {
		const { code, reason } = run(
			event('gh pr comment 37 --body "fixed"'),
			anywhere(),
		);
		expect(code).toBe(2);
		expect(reason).toContain("publishes text");
	});

	test("an issue comment blocks", () => {
		expect(run(event("gh issue comment 12 --body x"), anywhere()).code).toBe(2);
	});

	test("a review blocks", () => {
		expect(run(event("gh pr review 37 --approve"), anywhere()).code).toBe(2);
	});

	test("an absolute path to gh blocks", () => {
		// This is what the deny entry cannot see and the guard can.
		expect(
			run(event("/opt/homebrew/bin/gh pr comment 37 --body x"), anywhere())
				.code,
		).toBe(2);
	});

	test("a write behind a global flag blocks", () => {
		expect(
			run(event("gh --repo a/b pr comment 37 --body x"), anywhere()).code,
		).toBe(2);
	});

	test("opening a pull request does not block", () => {
		expect(run(event("gh pr create --title x --body y"), anywhere()).code).toBe(
			0,
		);
	});

	test("reading a pull request does not block", () => {
		expect(run(event("gh pr view 37 --json state"), anywhere()).code).toBe(0);
	});

	test("listing issues does not block", () => {
		expect(run(event("gh issue list"), anywhere()).code).toBe(0);
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

	test("an includes-guarded force blocks", () => {
		expect(run(event("git push --force-if-includes"), branch()).code).toBe(2);
	});

	test("the short flag blocks", () => {
		expect(run(event("git push -f origin feat/x"), branch()).code).toBe(2);
	});

	test("the short flag bundled with another blocks", () => {
		// git reads `-uf` as `-u -f`, so a whole-argument match on `-f` alone
		// would let the bundled spelling through.
		expect(run(event("git push -uf origin feat/x"), branch()).code).toBe(2);
	});

	test("a short flag group without f does not block", () => {
		expect(run(event("git push -qn origin feat/x"), branch()).code).toBe(0);
	});

	test("a quoted separator does not split the flag away", () => {
		// A naive split would leave `git push origin "a` — no force flag in
		// it — and let the rewrite through.
		expect(run(event('git push origin "a;b" --force'), branch()).code).toBe(2);
	});

	test("an abbreviated lease flag blocks", () => {
		// git takes any unambiguous abbreviation, so `--force-w` reaches the
		// same code path as the full spelling.
		expect(run(event("git push --force-w origin feat/x"), branch()).code).toBe(
			2,
		);
	});

	test("an abbreviated includes flag blocks", () => {
		expect(run(event("git push --force-i origin feat/x"), branch()).code).toBe(
			2,
		);
	});

	test("a force-push inside a command substitution blocks", () => {
		expect(
			run(event('echo "$(git push --force origin feat/x)"'), branch()).code,
		).toBe(2);
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

describe("a push whose destination is main", () => {
	const branch = () => fabricate("feat/x");

	test("named by refspec", () => {
		const { code, reason } = run(event("git push origin HEAD:main"), branch());
		expect(code).toBe(2);
		expect(reason).toContain("main");
	});

	test("named bare, as the only operand", () => {
		expect(run(event("git push origin main"), branch()).code).toBe(2);
	});

	test("named by its full ref", () => {
		// Carries a `+` too, so it blocks as a force before the destination is
		// read — both paths refuse it, which is why the form is worth pinning.
		expect(
			run(event("git push origin +HEAD:refs/heads/main"), branch()).code,
		).toBe(2);
	});

	test("named as a deletion", () => {
		expect(run(event("git push origin :main"), branch()).code).toBe(2);
	});

	test("named by the second of two refspecs", () => {
		// The first operand is allowed; a scan stopping at the first acceptable
		// destination would let this through.
		expect(run(event("git push origin feat/x main"), branch()).code).toBe(2);
	});
});

describe("a push whose destination cannot be bounded", () => {
	const branch = () => fabricate("feat/x");

	test("the matching refspec", () => {
		const { code, reason } = run(event("git push origin :"), branch());
		expect(code).toBe(2);
		// It names no destination, so the reason must not invent one.
		expect(reason).toContain("no bounded destination");
	});

	test("the forcing matching refspec", () => {
		expect(run(event("git push origin +:"), branch()).code).toBe(2);
	});

	test("a wildcard refspec", () => {
		expect(
			run(event("git push origin 'refs/heads/*:refs/heads/*'"), branch()).code,
		).toBe(2);
	});

	test("a leading + on an ordinary refspec is a force", () => {
		const { code, reason } = run(
			event("git push origin +feat/x:feat/x"),
			branch(),
		);
		expect(code).toBe(2);
		expect(reason).toContain("force");
	});

	for (const flag of ["--all", "--branches", "--mirror", "--prune"]) {
		test(`${flag} acts on refs it never names`, () => {
			const { code, reason } = run(event(`git push ${flag} origin`), branch());
			expect(code).toBe(2);
			expect(reason).toContain("no bounded destination");
		});
	}

	test("an abbreviation git would resolve", () => {
		expect(run(event("git push --mir origin"), branch()).code).toBe(2);
	});
});

describe("a push while HEAD is on main", () => {
	const branch = () => fabricate("main");

	test("with no refspec at all", () => {
		const { code, reason } = run(event("git push"), branch());
		expect(code).toBe(2);
		expect(reason).toContain("never pushes from there");
	});

	test("aimed at a feature branch", () => {
		expect(run(event("git push origin feat/x"), branch()).code).toBe(2);
	});

	test("behind an option whose value is a separate word", () => {
		// The form an operand split misreads: `ci.skip` is read as the
		// repository and `origin` as the only refspec, and the push passes.
		expect(run(event("git push -o ci.skip origin"), branch()).code).toBe(2);
	});
});

describe("pushes the destination check must not block", () => {
	const branch = () => fabricate("feat/x");

	test("a branch whose name merely starts with main", () => {
		expect(run(event("git push origin HEAD:mainline"), branch()).code).toBe(0);
	});

	test("main as the source, not the destination", () => {
		expect(run(event("git push origin main:feat/x"), branch()).code).toBe(0);
	});

	test("HEAD with no destination", () => {
		expect(run(event("git push origin HEAD"), branch()).code).toBe(0);
	});

	test("no refspec on a feature branch", () => {
		expect(run(event("git push"), branch()).code).toBe(0);
	});

	test("main as an option's value", () => {
		// Skipped as `-o`'s value; read as an operand it would refuse the push.
		expect(run(event("git push -o main origin feat/x"), branch()).code).toBe(0);
	});

	test("the end-of-options marker", () => {
		// `--` is a prefix of all four blocked options and none of them, so the
		// prefix match has to exempt it or refuse a valid push.
		expect(run(event("git push -- origin feat/x"), branch()).code).toBe(0);
	});

	test("but the marker does not smuggle a destination past the check", () => {
		expect(run(event("git push -- origin main"), branch()).code).toBe(2);
	});
});

describe("the destination check and the paths around it", () => {
	test("--all blocks on the flag before the branch is read", () => {
		// A detached HEAD blocks for its own reason; this must not be that one.
		const { code, reason } = run(event("git push --all origin"), detached());
		expect(code).toBe(2);
		expect(reason).toContain("no bounded destination");
		expect(reason).not.toContain("could not read the current branch");
	});

	test("a detached HEAD still blocks a push that names a branch", () => {
		const { code, reason } = run(event("git push origin feat/x"), detached());
		expect(code).toBe(2);
		expect(reason).toContain("could not read the current branch");
	});

	test("inside a command substitution", () => {
		expect(
			run(event('echo "$(git push origin HEAD:main)"'), fabricate("feat/x"))
				.code,
		).toBe(2);
	});
});
