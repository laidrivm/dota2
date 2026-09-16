/**
 * What `PLAN.md` may hold now that the queue does not live in it: the sources
 * still feeding the work and the constraints still in force, and a pointer to
 * the boards that is a name rather than a URL.
 *
 * Its own file rather than a case in `rulebook.test.ts`, which is about the
 * partition of `CLAUDE.md`'s rules list. Both halves of the always-on set are
 * measured against the same trigger and neither is the other's subject.
 */
import { describe, expect, test } from "bun:test";
import { root } from "./root.ts";

const plan = await Bun.file(`${root}/PLAN.md`).text();

/** The tracked paths of this repository, named from its root. */
const tracked = () => {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout.toString().split("\0").filter(Boolean);
};

describe("PLAN.md after the queue left it", () => {
	test("carries no queue section, under that heading or any other", () => {
		expect(plan).not.toContain("## Queue");
		// The `### Done` and `### Open` subheadings went with it; a queue
		// re-grown under either would satisfy the line above.
		expect(plan).not.toMatch(/^#{2,3} (Queue|Open|Done)\b/m);
	});

	test("names the three boards, so a session knows which to look at second", () => {
		for (const board of ["D2ASS", "Harness", "mellon"])
			expect(plan).toContain(board);
	});

	// The four cases below this block assert what the file may not hold, and an
	// emptied `PLAN.md` satisfies every one of them. What follows is the half
	// the requirement keeps: the sources still feeding the work, and the
	// constraints no single site owns.
	test("keeps the sections the requirement says it holds", () => {
		for (const heading of [
			"## Where the work is",
			"## Requirement sources",
			"## Standing constraints",
		])
			expect(plan).toContain(heading);
	});

	test("keeps the standing constraints themselves, not only their heading", () => {
		const kept = plan.slice(plan.indexOf("## Standing constraints"));
		// Three the proposal names as the shape of a constraint — a project-wide
		// choice with no status, which is what distinguishes one from a task.
		for (const constraint of ["Preact", "camelCase", "Docker on a VPS"])
			expect(kept).toContain(constraint);
	});

	// The routing rule sends a session to a board; the view is how it reads one
	// without spending the metered query path, so the name has to be here too.
	test("names the saved view, not only the boards it sits on", () => {
		expect(plan).toContain("Board view");
	});

	// The repository is public and the boards are not, so an identifier for
	// private content is what may not be here — the name is not one.
	test("names them by name, carrying no board URL, view URL or option id", () => {
		for (const secret of [
			"notion.so",
			"notion.com",
			"collection://",
			"view://",
			"collectionPropertyOption://",
		])
			expect(plan).not.toContain(secret);
		expect(plan).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
	});

	// spec: context-budget/a-source-that-is-itself-a-task
	// spec: task-board/the-brief-still-open
	test("names the brief that is a task as a card, the path being gone", () => {
		const cited = plan
			.split("\n")
			.filter((line) => line.includes("tasks/task-5.md"));
		// One mention, and a mention at all: a source list that had simply
		// dropped the brief would pass a test asserting only the absence of a
		// path, and the card is the only copy of that task left.
		expect(cited.length).toBe(1);
		expect(cited[0]).toContain("card");
		// What makes the distinction worth testing: the file is gone, so a line
		// naming the same string as a path would send the next session to
		// nothing. The card is titled with the filename because that filename is
		// the key the four surviving archived citations carry.
		expect(tracked()).not.toContain("tasks/task-5.md");
	});

	test("cites no path under the directory the briefs left", () => {
		expect(tracked().filter((path) => path.startsWith("tasks/"))).toEqual([]);
	});
});
