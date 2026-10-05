/**
 * The boards the work sits on are named in `docs/feature-workflow.md`, where a
 * session chooses its next task — by name, and by nothing that identifies
 * private content, since this repository is public and the boards are not.
 */
import { describe, expect, test } from "bun:test";
import { root } from "./root.ts";

// Read inside each case, never in the describe body: a throw while the block
// is collected removes its cases and reports the smaller count as a pass.
const doc = () => Bun.file(`${root}/docs/feature-workflow.md`).text();

/** The tracked paths of this repository, named from its root. */
const tracked = () => {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout.toString().split("\0").filter(Boolean);
};

// spec: task-board/the-workflow-doc-names-the-boards-by-name-alone
describe("the workflow doc names the boards by name alone", () => {
	// One case per name, so a failure says which one went missing.
	test.each(["D2ASS", "Harness", "mellon", "Board view"])(
		"names %s",
		async (name) => {
			expect(await doc()).toContain(name);
		},
	);

	// The names alone recur in the card bullet, so a doc that lost the list
	// would still carry all three; each must head a line saying its work.
	test.each(["D2ASS", "Harness", "mellon"])(
		"lists %s with the work it takes",
		async (board) => {
			expect(await doc()).toMatch(new RegExp(`^\\s*- \`${board}\` — \\S`, "m"));
		},
	);

	test.each([
		"notion.so",
		"notion.com",
		"collection://",
		"view://",
		"collectionPropertyOption://",
	])("carries no %s reference", async (secret) => {
		expect(await doc()).not.toContain(secret);
	});

	test("carries no UUID, in either case", async () => {
		expect(await doc()).not.toMatch(
			/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
		);
	});
});

// spec: task-board/the-brief-still-open
test("no path survives under the directory the briefs left", () => {
	expect(tracked().filter((path) => path.startsWith("tasks/"))).toEqual([]);
});
