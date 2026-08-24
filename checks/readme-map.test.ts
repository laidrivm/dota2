import { expect, test } from "bun:test";

/**
 * The repository root, from git rather than from this file's own location.
 * Its neighbours in `checks/` take `join(import.meta.dir, "..")`, which is
 * enough to read a file; this one also *lists* the tree, and `git ls-files`
 * names what it finds relative to the directory it ran in — so the listing
 * and the paths the map states have to be measured from the same place, and
 * git is the only thing that knows where that is.
 */
const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
	// Asked from this file's own directory rather than from wherever bun was
	// invoked: the two agree today and only one of them stays true if the
	// suite is ever run from somewhere else.
	cwd: import.meta.dir,
});
if (top.exitCode !== 0) throw new Error(top.stderr.toString());
const dir = top.stdout.toString().trim();

/**
 * The mechanical half of the knowledge ownership map: every path it names
 * resolves. Whether the sentence beside the path is still true is a review
 * question, not a test one.
 */
const readme = await Bun.file(`${dir}/README.md`).text();

const map =
	readme.match(/^## Knowledge ownership map$([\s\S]*?)^## /m)?.[1] ?? "";

/**
 * The first backticked span of each row is its path; a row may carry a
 * second one (`openspec/config.yaml` → `context:`) naming a key inside it.
 * The header and separator rows carry none and drop out here.
 */
const rows = map
	.split("\n")
	.filter((line) => line.startsWith("|"))
	.slice(2); // the header and the `|---|` separator

const paths = rows
	.map((row) => row.split("|")[1]?.match(/`([^`]+)`/)?.[1])
	.filter((path) => path !== undefined);

const git = (...args: string[]) =>
	Bun.spawnSync(["git", ...args], { cwd: dir });

/** Tracked, not merely present — a clone has only what git carries. */
const tracked = git("ls-files").stdout.toString().split("\n").filter(Boolean);

/** A pattern without magic characters matches only its literal path. */
const resolves = (path: string) => {
	const glob = new Bun.Glob(path.endsWith("/") ? `${path}**` : path);
	return tracked.some((file) => glob.match(file));
};

test("the listing is the repository's, not this file's own directory", () => {
	// `git ls-files` run in a subdirectory lists only what is under it and
	// names it relative to it, so a listing taken where the check happens to
	// sit sees a fraction of the tree and resolves the rest to nothing. Two
	// assertions, because either alone passes on half the mistake: the first
	// says the listing reaches above `checks/`, the second that its paths are
	// named from the root rather than from here.
	expect(tracked).toContain("README.md");
	expect(tracked).toContain("checks/readme-map.test.ts");
});

test("every row of the map yields a path", () => {
	// A reshaped table yields fewer paths than rows — or none at all, which
	// would make every assertion below pass by vacuity.
	expect(rows.length).toBeGreaterThan(0);
	expect(paths).toHaveLength(rows.length);
});

test("a path present but untracked does not satisfy a row", async () => {
	// Guards the choice of `git ls-files` over the filesystem: a check that
	// asked whether the file exists would pass here and fail in a clone.
	// The name is unique so a run can never delete a file someone else left
	// at the repo root.
	const probe = `untracked-probe-${crypto.randomUUID()}.md`;
	await Bun.write(`${dir}/${probe}`, "");
	try {
		expect(resolves(probe)).toBe(false);
	} finally {
		await Bun.file(`${dir}/${probe}`).delete();
	}
});

// spec: repo-layout/the-ownership-map-s-paths-from-outside-the-root
test.each(paths)("the map's `%s` is real and shipped", (path) => {
	// A gitignored row is absent from a clone by design, so asserting it
	// would pass here and fail there.
	if (git("check-ignore", "-q", path).exitCode === 0) return;
	expect(resolves(path), `${path} is named in the map but not tracked`).toBe(
		true,
	);
});
