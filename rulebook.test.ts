import { expect, test } from "bun:test";

/**
 * The rules list is partitioned into Code, Process and Safety, and the
 * maintenance trigger counts each sublist on its own. A rule that sits under
 * none of the three is counted by nothing, which is the failure this pins.
 */
const claude = await Bun.file(`${import.meta.dir}/CLAUDE.md`).text();

const SUBLISTS = ["Code", "Process", "Safety"];

/**
 * The `### Rules` section, up to the next heading of its level or above — or
 * to the end of the file, which is where it sits today.
 */
function rules(text: string): string {
	return (text.split(/^### Rules$/m)[1] ?? "").split(/^#{1,3} /m)[0] ?? "";
}

/**
 * Every top-level bullet of the section, paired with the `####` heading above
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

const section = rules(claude);
const listed = bullets(section);

test("the three sublists exist", () => {
	for (const name of SUBLISTS) expect(section).toContain(`#### ${name}`);
});

test("every rule sits under one of them", () => {
	// Without this the assertion below could pass on an empty section.
	expect(listed.length).toBeGreaterThan(0);
	expect(
		listed.filter(({ heading }) => !SUBLISTS.includes(heading ?? "")),
	).toEqual([]);
});

test("a rule outside the three headings fails", () => {
	const stray = section.replace("#### Code\n", "");
	expect(
		bullets(stray).filter(({ heading }) => !SUBLISTS.includes(heading ?? "")),
	).not.toEqual([]);
});

test("the maintenance trigger counts a sublist, not the list", () => {
	const maintenance = (claude.split(/^### Maintenance$/m)[1] ?? "").split(
		/^#{1,3} /m,
	)[0];
	expect(maintenance).toContain("When one sublist exceeds ~20 rules");
});
