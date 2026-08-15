import { afterAll, describe, expect, test } from "bun:test";
import { cleanup, event, fabricate, run } from "./command-guard.fixture.ts";

/**
 * What `command-parse.ts` decides, exercised through the guard rather than by
 * calling it: what the parser gets wrong is only ever visible as a prohibition
 * that stopped refusing, and a test that asserted on a word list would pass on
 * a guard nobody had wired to it.
 */

afterAll(cleanup);

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

	test("a wrapper option's operand does not become the command", () => {
		// `env -u PATH git commit` runs git: `-u` takes the next word. Which
		// options take one cannot be enumerated per wrapper, so every word after
		// a wrapper is read as a possible command rather than only the first.
		expect(
			run(event("env -u PATH git commit -m fix"), fabricate("main")).code,
		).toBe(2);
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
		const dir = fabricate("main", "command guard spaced ");
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

	test("a group inside a substitution does not close the substitution", () => {
		// The inner `)` closes the group, not the `$(`. Restoring the enclosing
		// quote there put the rest of the substitution back inside quotes, and
		// the commit went unchecked.
		expect(
			run(event('echo "$( ( true ); git commit -m fix )"'), fabricate("main"))
				.code,
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
