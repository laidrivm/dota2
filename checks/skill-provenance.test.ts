import { expect, test } from "bun:test";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/**
 * The provenance table pins which shared skills the gates depend on and what
 * each was verified against. It never reads `.claude/skills/`: those entries
 * are symlinks out of the repository and resolve to nothing in a clone, so
 * the check is the table against the two tracked files that make a skill a
 * gate — this file's own pre-PR sequence, and `CLAUDE.md`'s rules.
 */
const toolkit = await Bun.file(`${root}/docs/review-toolkit.md`).text();
const claudeMd = await Bun.file(`${root}/CLAUDE.md`).text();

/**
 * Up to the next heading of its level *or above*, or the end of the file —
 * the boundary `rulebook.test.ts`'s `slice` already takes, and the two now
 * sit in one directory. Stopping only at the same level would let a `###`
 * section run on into the `##` one after it, and here that would read the
 * next section's slash commands as this one's.
 */
const section = (markdown: string, heading: string, level = "##") =>
	markdown.match(
		new RegExp(
			`^${level} ${heading}$([\\s\\S]*?)(?=\\n#{1,${level.length}} |$(?![\\s\\S]))`,
			"m",
		),
	)?.[1] ?? "";

/** Every skill invoked as a slash command inside the pre-PR sequence. */
const sequence = section(toolkit, "The pre-PR sequence");
const sequenced = [...sequence.matchAll(/`\/([a-z][a-z0-9-]*)`/g)].map(
	(match) => match[1] as string,
);

/**
 * A skill a `CLAUDE.md` rule names is a gate too, without being sequenced.
 * Only the rules count — prose elsewhere in that file names skills without
 * depending on them.
 */
const rules = section(claudeMd, "Rules", "###");
const ruled = [...rules.matchAll(/`([a-z][a-z0-9-]*)` skill/g)].map(
	(match) => match[1] as string,
);

/**
 * No exemption: every skill the sequence and the rules name is verified
 * against a commit. `/ponytail-review` was exempt until it left the sequence
 * on 2026-08-26, the ponytail plugin having no commit in the skills
 * repository to record — and the exemption goes with it rather than waiting,
 * because a plugin step returning under it would pass with no provenance row
 * at all, which is the state this file exists to refuse. Returning one fails
 * here instead, and whoever adds it decides what to record.
 */
const active = new Set([...sequenced, ...ruled]);

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
	expect(rules.length).toBeGreaterThan(0);
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
