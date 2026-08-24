/**
 * The half of the layout contract a reader uses: the README says where each
 * kind of file goes, and every directory it names is one the repository
 * actually tracks something under.
 *
 * The other half is `scripts/repo-layout.ts`, which refuses a file placed
 * outside those directories. The capability is one; its two halves land in the
 * two homes this change defined, which is the arrangement being demonstrated
 * rather than an exception to it.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The heading the section is found under, and the only place it is written. */
const HEADING = "## Where each kind of file lives";

/**
 * Every directory the layout section names, paired with whether its row marks
 * it reserved. The first backticked span of a row is the directory, the idiom
 * `readme-map.test.ts` already reads the ownership map with; the header and
 * separator rows carry none and drop out here.
 */
function rows(
	markdown: string,
): { path: string | undefined; reserved: boolean }[] | undefined {
	// `undefined` where the heading is absent, distinct from a section that is
	// present and holds no row: the two fail for different reasons and the
	// heading is matched in one place rather than tested again by the caller.
	const section = markdown.match(
		new RegExp(`^${HEADING}$([\\s\\S]*?)(?=\\n#{1,2} |$(?![\\s\\S]))`, "m"),
	)?.[1];
	if (section === undefined) return undefined;
	return section
		.split("\n")
		.filter((line) => line.startsWith("|"))
		.slice(2)
		.map((line) => ({
			// `undefined` rather than dropped: a row that stops naming a
			// directory is the table half-reshaped, and dropping it would leave
			// the check reading the rows that still parse and reporting nothing.
			path: line.split("|")[1]?.match(/`([^`]+)`/)?.[1],
			reserved: /reserved/i.test(line),
		}));
}

/**
 * What the section gets wrong, read against a listing of tracked paths.
 *
 * Tracked rather than present on disk: git carries no empty directory, so a
 * directory that exists only in a working tree is absent from every clone —
 * the same reason the ownership map is checked this way.
 */
function problems(markdown: string, tracked: string[]): string[] {
	const named = rows(markdown);
	if (named === undefined)
		return [`the README carries no "${HEADING}" section`];

	// A reshaped table satisfies every assertion made over its rows by having
	// none, which is the same vacuous pass as an absent heading by another
	// route.
	if (named.length === 0)
		return [`the "${HEADING}" section names no directory`];

	return named.flatMap(({ path, reserved }) => {
		if (path === undefined)
			return [`the "${HEADING}" section has a row naming no directory`];
		if (reserved) return [];
		const prefix = path.endsWith("/") ? path : `${path}/`;
		return tracked.some((file) => file.startsWith(prefix))
			? []
			: [`${path}: named in the layout section, tracking nothing`];
	});
}

const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway repository holding `files`, and its tracked listing. */
function fabricate(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "readme-layout-"));
	made.push(dir);
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

/** The tracked paths of a repository, named from its root. */
function listing(dir: string): string[] {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: dir });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout.toString().split("\0").filter(Boolean);
}

/** A layout section holding one row per argument. */
const section = (...cells: string[]) =>
	`# A readme\n\n${HEADING}\n\n| Directory | Holds |\n|---|---|\n${cells
		.map((cell) => `| ${cell} |\n`)
		.join("")}`;

// spec: repo-layout/the-section-is-absent
describe("a README with no layout section", () => {
	test("fails rather than passing over an absent heading [15]", () => {
		// The vacuous pass a section-scoped scan gives when its heading is
		// renamed: no section, no rows, nothing to contradict.
		expect(problems("# A readme\n\n## Something else\n", [])).toHaveLength(1);
	});
});

// spec: repo-layout/the-section-names-no-directory
describe("a layout section naming no directory", () => {
	test("fails rather than passing on having no rows [16]", () => {
		const empty = `# A readme\n\n${HEADING}\n\nprose, no table\n`;
		expect(problems(empty, ["src/app/a.ts"])).toHaveLength(1);
	});
});

// spec: repo-layout/a-directory-the-section-names
describe("a directory the section names", () => {
	test("passes where the repository tracks a file under it [17]", () => {
		const dir = fabricate({ "src/app/a.ts": "" });
		expect(problems(section("`src/app/` | the client"), listing(dir))).toEqual(
			[],
		);
	});

	test("fails where it tracks nothing, naming the directory [19]", () => {
		const dir = fabricate({ "src/app/a.ts": "" });
		const found = problems(section("`src/job/` | the job"), listing(dir));

		expect(found).toHaveLength(1);
		expect(found[0]).toContain("src/job/");
	});

	test("a directory on disk but tracked by nothing does not satisfy it [20]", () => {
		// git carries no empty directory, so this is the mechanism rather than a
		// contrivance: the row is satisfied in the author's working tree and in
		// no clone.
		const dir = fabricate({ "src/app/a.ts": "" });
		mkdirSync(join(dir, "src/job"), { recursive: true });

		expect(
			problems(section("`src/job/` | the job"), listing(dir)),
		).toHaveLength(1);
	});

	test("a row that stops naming a directory fails rather than dropping out", () => {
		// The table half-reshaped: one row keeps its path and one loses it. A
		// scan that dropped the second would report nothing and read as though
		// the section were still whole.
		const dir = fabricate({ "src/app/a.ts": "" });
		const half = section("`src/app/` | the client", "src/job/ | the job");

		expect(problems(half, listing(dir))).toHaveLength(1);
	});

	test("a prefix match is on the directory, not on the name [19]", () => {
		// `src/job/` must not be satisfied by `src/jobs-notes.md`, which shares
		// its first seven characters and lives somewhere else entirely.
		const dir = fabricate({ "src/jobs-notes.md": "" });
		expect(
			problems(section("`src/job/` | the job"), listing(dir)),
		).toHaveLength(1);
	});
});

// spec: repo-layout/a-directory-reserved-for-later-work
describe("a directory reserved for later work", () => {
	test("is not required to exist [18]", () => {
		const dir = fabricate({ "src/app/a.ts": "" });
		const reserved = section(
			"`src/job/build/` | reserved for `snapshot-build`",
		);

		expect(problems(reserved, listing(dir))).toEqual([]);
	});
});

describe("the README as it stands", () => {
	// Resolved before listing, like everything else in `checks/`: from this
	// file's own directory the listing would be `checks/` alone, and every row
	// would fail on finding nothing — which is the opposite mistake, but read
	// from the same wrong place.
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
		cwd: import.meta.dir,
	});
	if (top.exitCode !== 0) throw new Error(top.stderr.toString());
	const root = top.stdout.toString().trim();

	test("its layout section names only directories the repository has", async () => {
		const readme = await Bun.file(`${root}/README.md`).text();
		expect(problems(readme, listing(root))).toEqual([]);
	});

	test("the section names every directory that holds source", async () => {
		// Without this the section satisfies the check by naming one directory
		// and staying silent about the rest, which is the answer a reader came
		// for.
		const readme = await Bun.file(`${root}/README.md`).text();
		const named = new Set((rows(readme) ?? []).map((row) => row.path));

		for (const dir of [
			"src/app/",
			"src/fixtures/",
			"src/job/",
			"src/job/ingest/",
			"src/server/",
			"checks/",
			"scripts/",
			"e2e/",
		])
			expect(named).toContain(dir);
	});
});
