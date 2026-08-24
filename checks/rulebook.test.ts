import { expect, test } from "bun:test";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/**
 * The rules list is partitioned into Code, Process and Safety, and the
 * maintenance trigger counts each sublist on its own. A rule that sits under
 * none of the three is counted by nothing, which is the failure this pins.
 */
const claude = await Bun.file(`${root}/CLAUDE.md`).text();

/** The doc `CLAUDE.md` indexes for what a fired trigger asks for. */
const growth = await Bun.file(`${root}/docs/rulebook-growth.md`).text();

const SUBLISTS = ["Code", "Process", "Safety"];

/**
 * A `### ` section, up to the next heading of its level or above — or to the
 * end of the file, which is where `Rules` sits today.
 */
const slice = (name: string, text = claude) =>
	(text.split(new RegExp(`^### ${name}$`, "m"))[1] ?? "").split(
		/^#{1,3} /m,
	)[0] ?? "";

/**
 * Every top-level bullet of a section, paired with the `####` heading above
 * it — `undefined` for one that precedes all three. Continuation lines are
 * indented and belong to the bullet before them.
 */
function bullets(section: string): { heading?: string; text: string }[] {
	const found: { heading?: string; text: string }[] = [];
	let heading: string | undefined;
	for (const line of section.split("\n")) {
		const next = line.match(/^#### (.+)$/);
		if (next) heading = next[1];
		else if (line.startsWith("- "))
			found.push({ heading, text: line.slice(2) });
	}
	return found;
}

/** The rules a per-sublist maintenance trigger would never count. */
const unfiled = (section: string) =>
	bullets(section).filter(({ heading }) => !SUBLISTS.includes(heading ?? ""));

const rules = slice("Rules");

test("the three sublists exist", () => {
	// Anchored: a heading, not the words in a sentence about one.
	for (const name of SUBLISTS)
		expect(rules).toMatch(new RegExp(`^#### ${name}$`, "m"));
});

test("every rule sits under one of them", () => {
	// Without this the assertion below could pass on an empty section.
	expect(bullets(rules).length).toBeGreaterThan(0);
	expect(unfiled(rules)).toEqual([]);
});

test("a rule above the first heading fails", () => {
	expect(unfiled(rules.replace("#### Code\n", ""))).not.toEqual([]);
});

test("a rule under a fourth heading fails", () => {
	expect(unfiled(`${rules}\n#### Tooling\n\n- Filed nowhere.\n`)).not.toEqual(
		[],
	);
});

test("the section stops at the next heading of its level", () => {
	// `### Rules` is the last section today, so nothing else exercises the
	// terminator: a section appended after it must not be read as rules.
	const appended = `${claude}\n### Afterword\n\n- Not a rule at all.\n`;
	expect(bullets(slice("Rules", appended))).toEqual(bullets(rules));
});

/**
 * Prose with its line wrapping taken out. A sentence these files state is one
 * whether or not a reflow moved a word onto the next line, and an assertion
 * that fails on the reflow is an assertion about the wrapping.
 */
const flat = (text: string) => text.replace(/\s+/g, " ");

test("the maintenance trigger counts a sublist, not the list", () => {
	// The trigger fires from `CLAUDE.md` and what it asks for stands in the doc
	// indexed there, so each half is asserted where that half lives.
	expect(flat(slice("Maintenance & growth"))).toContain(
		"one sublist below passes ~20 rules",
	);
	// The opening phrase alone passes on a rule that goes on to count them all.
	expect(flat(growth)).toContain(
		"the other two sublists are not counted against it",
	);
});
