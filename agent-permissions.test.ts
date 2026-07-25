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

describe("foreign package managers are denied", () => {
	for (const cmd of denied) {
		test(`${cmd} has a deny entry`, () => {
			expect(deny).toContain(`Bash(${cmd} *)`);
		});
	}
});

describe("deny entries keep their word boundary", () => {
	// `Bash(npm*)` would also block `npmlog`; `Bash(command:npm *)` is ignored
	// by Claude Code, which warns about it at startup — a boundary that only
	// looks like one.
	test("every entry uses the trailing-space wildcard form", () => {
		for (const entry of deny) {
			expect(entry).toMatch(/^Bash\([a-z-]+ \*\)$/);
		}
	});

	test("no entry uses the ignored field form", () => {
		for (const entry of deny) {
			expect(entry).not.toContain("command:");
		}
	});
});

test("no ask entry names a denied manager", () => {
	// Deny is evaluated before ask, so such an entry can never be reached.
	for (const entry of ask) {
		for (const cmd of denied) {
			expect(entry).not.toMatch(new RegExp(`\\b${cmd}\\b`));
		}
	}
});
