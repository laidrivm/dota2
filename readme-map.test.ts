import { expect, test } from "bun:test";

/**
 * The mechanical half of the knowledge ownership map: every path it names
 * resolves. Whether the sentence beside the path is still true is a review
 * question, not a test one.
 */
const readme = await Bun.file(`${import.meta.dir}/README.md`).text();

const map =
	readme.match(/^## Knowledge ownership map$([\s\S]*?)^## /m)?.[1] ?? "";

/**
 * The first backticked span of each row is its path; a row may carry a
 * second one (`openspec/config.yaml` → `context:`) naming a key inside it.
 * The header and separator rows carry none and drop out here.
 */
const paths = [...map.matchAll(/^\|([^|]*)\|/gm)]
	.map((row) => row[1]?.match(/`([^`]+)`/)?.[1])
	.filter((path) => path !== undefined);

const git = (...args: string[]) =>
	Bun.spawnSync(["git", ...args], { cwd: import.meta.dir });

/** Tracked, not merely present — a clone has only what git carries. */
const tracked = git("ls-files").stdout.toString().split("\n").filter(Boolean);

/** A pattern without magic characters matches only its literal path. */
const resolves = (path: string) => {
	const glob = new Bun.Glob(path.endsWith("/") ? `${path}**` : path);
	return tracked.some((file) => glob.match(file));
};

test("the map still parses as a table", () => {
	// Without this, a reshaped table yields an empty set and every assertion
	// below passes by vacuity.
	expect(paths.length).toBeGreaterThan(10);
});

test("a path present but untracked does not satisfy a row", async () => {
	// Guards the choice of `git ls-files` over the filesystem: a check that
	// asked whether the file exists would pass here and fail in a clone.
	const probe = `${import.meta.dir}/untracked-probe.md`;
	await Bun.write(probe, "");
	try {
		expect(resolves("untracked-probe.md")).toBe(false);
	} finally {
		await Bun.file(probe).delete();
	}
});

test.each(paths)("the map's `%s` is real and shipped", (path) => {
	// A gitignored row is absent from a clone by design, so asserting it
	// would pass here and fail there.
	if (git("check-ignore", "-q", path).exitCode === 0) return;
	expect(resolves(path), `${path} is named in the map but not tracked`).toBe(
		true,
	);
});
