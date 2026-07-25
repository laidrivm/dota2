import { describe, expect, test } from "bun:test";

/**
 * The tracked settings, never `.claude/settings.local.json` — that one is
 * gitignored, so it is present for the author and absent in a clone.
 */
const settings = await Bun.file(
	`${import.meta.dir}/.claude/settings.json`,
).json();

/** Every package manager this project does not use. */
const denied = ["npx", "npm", "pnpm", "yarn"];

const deny: string[] = settings.permissions?.deny ?? [];
const ask: string[] = settings.permissions?.ask ?? [];

test("every foreign package manager is denied", () => {
	expect(deny).toEqual(denied.map((cmd) => `Bash(${cmd} *)`));
});

test("deny entries keep their word boundary", () => {
	// The trailing-space form is the only one that holds: `Bash(npm*)` would
	// also block `npmlog`, and `Bash(command:npm *)` is ignored by Claude
	// Code, which warns about it at startup — a boundary that only looks
	// like one. Both fail this pattern, as does `Bash(npm:*)`.
	for (const entry of deny) {
		expect(entry).toMatch(/^Bash\([a-z-]+ \*\)$/);
	}
});

describe("only bun's install commands prompt", () => {
	test("both commands that mutate the manifest are listed", () => {
		expect(ask).toEqual(["Bash(bun add *)", "Bash(bun install *)"]);
	});

	test("no ask entry names a denied manager", () => {
		// Deny is evaluated before ask, so such an entry can never be reached.
		for (const entry of ask) {
			for (const cmd of denied) {
				expect(entry).not.toMatch(new RegExp(`\\b${cmd}\\b`));
			}
		}
	});
});
