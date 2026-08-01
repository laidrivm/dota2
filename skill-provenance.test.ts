import { expect, test } from "bun:test";

/**
 * The provenance table pins which shared skills the gates depend on and what
 * each was verified against. It never reads `.claude/skills/`: those entries
 * are symlinks out of the repository and resolve to nothing in a clone, so
 * the check is the table against the two tracked files that make a skill a
 * gate — this file's own pre-PR sequence, and `CLAUDE.md`'s rules.
 */
const toolkit = await Bun.file(
	`${import.meta.dir}/docs/review-toolkit.md`,
).text();
const claudeMd = await Bun.file(`${import.meta.dir}/CLAUDE.md`).text();

/** Up to the next `## ` heading, or the end of the file for the last section. */
const section = (markdown: string, heading: string) =>
	markdown.match(
		new RegExp(`^## ${heading}$([\\s\\S]*?)(?=\\n## |$(?![\\s\\S]))`, "m"),
	)?.[1] ?? "";

/** Every skill invoked as a slash command inside the pre-PR sequence. */
const sequence = section(toolkit, "The pre-PR sequence");
const sequenced = [...sequence.matchAll(/`\/([a-z][a-z0-9-]*)`/g)].map(
	(match) => match[1] as string,
);

/**
 * Scoped by what it exempts: `/ponytail-review` is the one step of the
 * sequence the ponytail plugin supplies, so it has no commit in that
 * repository to be verified against.
 */
const fromPlugin = ["ponytail-review"];

/** A skill a `CLAUDE.md` rule names is a gate too, without being sequenced. */
const ruled = [...claudeMd.matchAll(/`([a-z][a-z0-9-]*)` skill/g)].map(
	(match) => match[1] as string,
);

const active = new Set(
	[...sequenced, ...ruled].filter((skill) => !fromPlugin.includes(skill)),
);

const rows = section(toolkit, "Provenance")
	.split("\n")
	.filter((line) => line.startsWith("|"))
	.slice(2); // the header and the `|---|` separator

const named = rows.map(
	(row) =>
		row
			.split("|")[1]
			?.trim()
			.match(/^`([^`]+)`$/)?.[1],
);
const commits = rows.map((row) => row.split("|")[2]?.trim());

/** A full or abbreviated git object name, and nothing that merely reads like one. */
const isObjectName = (cell: string | undefined) =>
	/^`[0-9a-f]{7,40}`$/.test(cell ?? "");

test.each([
	["`759f15e`", true], // the shortest git abbreviates to
	["`759f15e0047155a5bed2100a7da881c4e0c02e90`", true], // a whole name
	["`759f15`", false],
	["`759f15e0047155a5bed2100a7da881c4e0c02e90f`", false],
	["`759F15E`", false], // git writes object names in lower case
	["`latest`", false],
	["2026-08-01", false],
	["archived", false],
])("%s is an object name: %p", (cell, expected) => {
	// The table holds only 7-character names, so neither bound is exercised
	// by the rows themselves.
	expect(isObjectName(cell)).toBe(expected);
});

test("both sources of the active set yield skills", () => {
	// A renamed heading or a reworded rule empties a source, and every
	// exactness check below would then pass on nothing.
	expect(sequence.length).toBeGreaterThan(0);
	expect(sequenced.length).toBeGreaterThan(0);
	expect(ruled.length).toBeGreaterThan(0);
	expect(active.size).toBeGreaterThan(0);
});

test("every row of the table yields a skill and a verdict", () => {
	// An emptied or reshaped table fails here rather than vacuously passing.
	expect(rows.length).toBeGreaterThan(0);
	expect(named).not.toContain(undefined);
	expect(commits.filter(Boolean)).toHaveLength(rows.length);
});

test("no skill holds two rows", () => {
	// Two rows for one skill name two states for one contract — whether the
	// second is a rival commit or an `archived` cell.
	expect([...new Set(named)]).toHaveLength(named.length);
});

test("each verdict is an object name or `archived`", () => {
	for (const [index, cell] of commits.entries()) {
		expect(
			isObjectName(cell) || cell === "archived",
			`${named[index]} is verified against "${cell}", which is neither an object name nor \`archived\``,
		).toBe(true);
	}
});

test("the rows carrying a commit are exactly the active set", () => {
	// Missing row, stray row, and an archived skill something started
	// depending on all land here.
	const pinned = named.filter((_, index) => isObjectName(commits[index]));
	expect(new Set(pinned)).toEqual(active);
});
