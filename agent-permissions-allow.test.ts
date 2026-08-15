import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { allow } from "./agent-permissions.fixture.ts";
// Imported rather than pattern-matched: bun parses TOML natively, and a
// regex over the text would read a commented-out key as a live one.
import bunfig from "./bunfig.toml";

/**
 * What is pre-approved, and the configuration keys the gates above rest on:
 * an allow entry a clone cannot use is one nobody notices is dead, and a
 * reserved key that quietly changed value is a gate that stopped gating.
 */

describe("the tracked allow list holds only what a clone can use", () => {
	/**
	 * What a rule is written about: the text inside `Tool(...)`, and the empty
	 * string for a bare tool name like `WebSearch`. Taken before any token is
	 * read, because the entry itself starts with the tool — `Read(//Users/…)`
	 * begins with `R`, and a check over the whole string would miss it.
	 */
	function argument(entry: string): string {
		const open = entry.indexOf("(");
		return open === -1 ? "" : entry.slice(open + 1, -1);
	}

	/**
	 * Whitespace-separated tokens that begin a path at the filesystem root or
	 * at home — `//` is covered by `/`. A leading quote is allowed before the
	 * slash, so `cp x "/tmp/x.bak"` fails here rather than passing on its
	 * quoting. The cost is a quoted regex that opens with a slash — an
	 * `awk '/^## Rules/' file` entry reads as a path and fails too. That
	 * direction is the safe one: a false failure is read on review, while a
	 * machine-local path admitted here reaches every clone.
	 */
	function absoluteTokens(entry: string): string[] {
		return argument(entry)
			.split(/\s+/)
			.filter((token) => /^["']?(\/|~\/)/.test(token));
	}

	test("the list is not empty", () => {
		// Every assertion below iterates the list, so an `allow` emptied by a
		// bad edit would satisfy all of them without testing anything.
		expect(allow.length).toBeGreaterThan(0);
	});

	test("no entry carries an absolute path token", () => {
		// Lexical, and deliberately not a shell parser: extracting the paths
		// inside a Bash command means handling quoting, globs, redirections
		// and expansions to gate a file a human reads on review. Forbidding
		// the shape covers the class instead — a machine-local `//Users/…`
		// and a `/tmp` scratch path fail by the same sentence.
		for (const entry of allow) {
			expect(absoluteTokens(entry)).toEqual([]);
		}
	});

	test("a path specifier resolves inside the repository", () => {
		// The second rule, for the two tools whose argument is a path by
		// definition. It is what catches `Edit(../../secrets/**)`, which
		// carries no absolute token and so passes the rule above.
		for (const entry of allow) {
			const path = entry.match(/^(?:Read|Edit)\((.+)\)$/)?.[1];
			if (path === undefined) continue;
			expect(resolve(import.meta.dir, path)).toStartWith(`${import.meta.dir}/`);
		}
	});
});

describe("the keys the gate is for still hold their reserved value", () => {
	// The prompt is not a proof. A permission mode answers it without the
	// user, and a subprocess writes outside the tool layer; both pass the
	// rules above. None of them passes these, which read the settled content
	// instead of the call that produced it.
	test("the install section is exactly what it was decided to be", () => {
		// The whole section, keys and values together. Keys, because
		// `CLAUDE.md` reserves a registry *or a scoped registry override* for
		// the user, and pinning the set is what holds that without this test
		// knowing how bun spells every route to one — any key arriving here
		// fails and a human decides what it was. Values, because a key set
		// says nothing about `exact` being flipped off or the age gate being
		// wound down to zero, which weaken the same boundary from inside.
		expect(bunfig.install).toEqual({
			exact: true,
			minimumReleaseAge: 259200,
			minimumReleaseAgeExcludes: [],
		});
	});

	test("no .npmrc is tracked at any depth", () => {
		// The premise the deny rule rests on. bun reads `.npmrc` as a registry
		// source, so one arriving in a clone is a root of trust nobody chose —
		// and a bare `Edit(.npmrc)` rule matches at any depth for the same
		// reason this looks repository-wide.
		// Both pathspecs: `**/.npmrc` matches at depth and not at the root,
		// so the bare one is what covers the root — measured, not assumed.
		const tracked = Bun.spawnSync(
			["git", "ls-files", "--", "**/.npmrc", ".npmrc"],
			{
				cwd: import.meta.dir,
			},
		);
		// Empty stdout means nothing tracked only if git ran. A failed spawn
		// prints nothing either, and would pass this test on no evidence.
		expect(tracked.exitCode).toBe(0);
		expect(tracked.stdout.toString().trim()).toBe("");
	});
});
