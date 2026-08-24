/**
 * Fails when a tracked file sits at the repository root without the exemption
 * list naming it, and when the list itself names nothing real.
 *
 * The check ships as a test rather than a script, the shape `file-size.test.ts`
 * uses: CI already runs `bun test` and so does the pre-push hook, so it is
 * blocking from its first commit with no workflow edit.
 */
import { afterAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { stray } from "./repo-layout.ts";

const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway directory with no repository in it. */
function bare(): string {
	const dir = mkdtempSync(join(tmpdir(), "repo-layout-"));
	made.push(dir);
	return dir;
}

/** A throwaway repository holding `files`, all tracked. */
function fabricate(files: Record<string, string>): string {
	const dir = bare();
	const git = (...args: string[]) => {
		const run = Bun.spawnSync(["git", ...args], { cwd: dir });
		if (run.exitCode !== 0) throw new Error(run.stderr.toString());
	};
	git("init", "-b", "main");
	for (const [path, text] of Object.entries(files)) {
		const full = join(dir, path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, text);
	}
	git("add", "-A");
	return dir;
}

/** One exempted root file, so no case below trips the could-not-measure guard. */
const KEEP = { "README.md": "the front door" };

// spec: repo-layout/a-source-file-added-to-the-root
describe("a file added to the repository root", () => {
	test("a root the list names entirely reports nothing [1]", () => {
		const dir = fabricate({ "README.md": "", "package.json": "{}" });
		expect(stray(dir, { ...KEEP, "package.json": "the manifest" })).toEqual([]);
	});

	test("an unexempted file is reported, naming it and the list [3]", () => {
		const dir = fabricate({ ...KEEP, "server.ts": "" });
		const found = stray(dir, KEEP);

		expect(found).toHaveLength(1);
		expect(found[0]).toContain("server.ts");
		// The reason as well as the path: "server.ts" alone reads as a file the
		// check dislikes rather than as a decision nobody has recorded.
		expect(found[0]).toMatch(/exemption list/i);
	});

	test("two unexempted files are both reported [4]", () => {
		const dir = fabricate({ ...KEEP, "a.ts": "", "b.sql": "" });
		expect(stray(dir, KEEP).join("\n")).toMatch(/a\.ts[\s\S]*b\.sql/);
	});

	// spec: repo-layout/a-file-type-the-list-has-never-seen
	test("an extension no exemption names is refused, not ignored [3]", () => {
		// The whole reason this scan is scoped by what it exempts: an admission
		// list of extensions passes silently on the first type nobody thought of.
		const dir = fabricate({ ...KEEP, "compose.yaml": "", "run.sh": "" });
		expect(stray(dir, KEEP)).toHaveLength(2);
	});

	test("a root dotfile is subject to the list like any other [7]", () => {
		// A leading dot is no implicit pass: `.env.example` is at the root by a
		// decision, and the list is where that decision is written down.
		const dir = fabricate({ ...KEEP, ".env.example": "" });
		expect(stray(dir, KEEP).join("")).toContain(".env.example");
	});

	test("a file named after an inherited property is not exempted by it", () => {
		// Every object answers to `toString`, `constructor` and `valueOf`, so a
		// membership test written with `in` would pass these three on a list
		// that never mentioned them.
		const dir = fabricate({
			...KEEP,
			toString: "",
			constructor: "",
			valueOf: "",
		});
		expect(stray(dir, KEEP)).toHaveLength(3);
	});
});

// spec: repo-layout/a-file-under-a-directory
describe("a file under a directory", () => {
	test("one directory down is not the root's business [6]", () => {
		const dir = fabricate({ ...KEEP, "src/job/db.ts": "", "checks/a.ts": "" });
		expect(stray(dir, KEEP)).toEqual([]);
	});
});

describe("the exemption list itself", () => {
	// spec: repo-layout/an-exemption-naming-a-file-that-is-gone
	test("an entry naming a path nothing tracks fails [8]", () => {
		const dir = fabricate(KEEP);
		const found = stray(dir, { ...KEEP, "server.ts": "moved to src/server/" });

		expect(found).toHaveLength(1);
		expect(found[0]).toContain("server.ts");
		expect(found[0]).toMatch(/tracks no such file/i);
	});

	// spec: repo-layout/an-exemption-carrying-no-reason
	test("an entry whose reason is empty is refused [9]", () => {
		const dir = fabricate({ ...KEEP, "package.json": "{}" });
		const found = stray(dir, { ...KEEP, "package.json": "  " });

		expect(found).toHaveLength(1);
		expect(found[0]).toContain("package.json");
		expect(found[0]).toMatch(/reason/i);
	});
});

// spec: repo-layout/a-tree-the-check-could-not-read
describe("a tree the check could not read", () => {
	test("a scan that matched no root file at all fails [2]", () => {
		// Not an empty result: every assertion made over a tree nobody read is
		// satisfied by it, so a clean root and an unread one must not agree.
		const dir = fabricate({ "src/a.ts": "" });
		expect(() => stray(dir, KEEP)).toThrow(/no tracked file/i);
	});

	test("git exiting non-zero fails with git's own stderr [13]", () => {
		// The check knows only that the command failed; the command knows why.
		expect(() => stray(bare(), KEEP)).toThrow(/not a git repository/i);
	});
});

describe("the tree the sweep reads", () => {
	// spec: repo-layout/a-root-entry-that-is-not-a-regular-file
	test("a tracked root entry absent from the work tree is skipped [11]", () => {
		const dir = fabricate({ ...KEEP, "gone.ts": "" });
		unlinkSync(join(dir, "gone.ts"));
		expect(stray(dir, KEEP)).toEqual([]);
	});

	test("a tracked root symlink is skipped, not read as a file [12]", () => {
		// `lstatSync` reads the link rather than following it, which is the
		// other thing `.isFile()` rejects besides an absent entry.
		const dir = fabricate({ ...KEEP, "src/real.ts": "" });
		symlinkSync(join(dir, "src/real.ts"), join(dir, "link.ts"));
		// Unchecked, a staging failure would leave the link untracked and this
		// case would pass on there being nothing at the root to report.
		const staged = Bun.spawnSync(["git", "add", "-A"], { cwd: dir });
		expect(staged.exitCode).toBe(0);

		expect(stray(dir, KEEP)).toEqual([]);
	});

	// spec: repo-layout/a-check-run-from-a-subdirectory
	test("run from below the root it still reads the whole repository [10]", () => {
		const dir = fabricate({ ...KEEP, "server.ts": "", "src/a.ts": "" });
		expect(stray(join(dir, "src"), KEEP).join("")).toContain("server.ts");
	});

	// spec: repo-layout/the-repository-as-it-stands
	test("this repository's root is named entirely by the list [14]", () => {
		expect(stray()).toEqual([]);
	});
});
