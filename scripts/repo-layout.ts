/**
 * Where a file of each kind belongs: every tracked file at the repository root
 * has to be named here, with why it is at the root rather than under a
 * directory.
 *
 * Scoped by what it exempts rather than by the extensions it covers, which is
 * the opposite of `scripts/file-size.ts` and the direction `CLAUDE.md` asks
 * for. The two differ because a line cap and a placement decision fail
 * differently: a file type nobody has capped is merely unmeasured, where a file
 * type nobody has placed is already in the wrong directory. A scan admitting by
 * extension would pass in silence on the first `.mjs`, `.sql` or `.sh` nobody
 * thought of — which is how thirty-three files reached the root the first time.
 *
 * Adding a root file means adding its name and its reason here. That is the
 * friction, and it is the point: the line is the decision being taken rather
 * than defaulted.
 */
import { lstatSync } from "node:fs";
import { join } from "node:path";

/** Every tracked root file, and why it is at the root. */
export const EXEMPT: Record<string, string> = {
	"CLAUDE.md": "always-on agent rules, read at the start of every session",
	"PLAN.md": "always-on queue, read at the start of every session",
	"README.md": "the front door, where a reader arrives before any directory",
	"index.html": "the bundler entry point `bun build ./index.html` expects here",
	"package.json": "the manifest bun resolves from the root and nowhere else",
	"bun.lock": "the lockfile bun writes beside the manifest",
	"bunfig.toml": "bun's own configuration, read from the root",
	"tsconfig.json": "the compiler reads it from the root of the project",
	"biome.json": "biome resolves its configuration from the root",
	"stryker.config.json": "stryker resolves its configuration from the root",
	"playwright.config.ts": "playwright resolves its configuration from the root",
	".coderabbit.yaml": "the review bot reads it from the repository root",
	".gitignore": "git reads it from the root, and it governs the whole tree",
	".env.example": "copied to `.env`, which tooling reads from the root",
	Dockerfile: "the build context's root is the directory holding it",
	".dockerignore": "read from the build context's root, beside the Dockerfile",
	"docker-compose.yml": "the deployment's project file, resolved from the root",
};

/**
 * Every tracked root file the list does not name, and every entry of the list
 * that names nothing real, in the repository containing `cwd`.
 *
 * The listing is taken at the repository root, never at `cwd`, the shape
 * `scripts/file-size.ts` uses: `git ls-files` run in a subdirectory reports
 * only what is under it and names it relative to it, so a check run from
 * `scripts/` would read that directory as though it were the root.
 */
export function stray(cwd?: string, exempt = EXEMPT): string[] {
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { cwd });
	// git's own stderr: this knows only that the command failed, and a check
	// reporting that much sends its reader back to the command anyway.
	if (top.exitCode !== 0) throw new Error(top.stderr.toString());
	// Only the terminator git adds, not `trim()`: a repository whose path ends
	// in a space is unusual and not this check's to corrupt.
	const root = top.stdout.toString().replace(/\n$/, "");

	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());

	const found: string[] = [];
	const seen = new Set<string>();
	// `-z` terminates rather than separates, so the last field is empty and
	// would otherwise resolve to the root itself and be read as a directory.
	for (const path of ls.stdout.toString().split("\0").filter(Boolean)) {
		if (path.includes("/")) continue;
		// Regular files only: the entry may be tracked but deleted from the work
		// tree, a symlink, or a submodule's gitlink, which reads as a directory.
		// git lists all three, and none of them is a file placed in the wrong
		// directory.
		if (!lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile())
			continue;
		seen.add(path);
		// `hasOwn`, not `in`: every object inherits `toString`, `constructor`
		// and `valueOf`, so `in` would exempt a root file of any of those names
		// on a list that never mentioned it.
		if (Object.hasOwn(exempt, path)) continue;
		found.push(
			`${path}: at the repository root, and the exemption list does not name it`,
		);
	}

	// A sweep that matched nothing satisfies every assertion made over its
	// result, so it is an error rather than a clean root.
	if (seen.size === 0)
		throw new Error(`no tracked file at the root of ${root}`);

	for (const [path, reason] of Object.entries(exempt)) {
		if (!seen.has(path))
			// "tracks no such file" rather than "no longer tracks it": the entry
			// may also name something git lists but this skipped — a symlink, or
			// a path deleted from the work tree — and the two read the same here.
			found.push(`${path}: exempted, and the repository tracks no such file`);
		else if (reason.trim() === "")
			found.push(`${path}: exempted, and the entry carries no reason`);
	}

	return found;
}
