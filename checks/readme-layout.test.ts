/**
 * This README as it stands: every directory its layout section names is one
 * this repository tracks something under, and every tracked file sits under a
 * directory it names.
 *
 * The rule both halves rest on is `scripts/repo-layout.ts`'s, where it sits
 * beside the root-file half of the same contract and is exercised against
 * trees fabricated for the purpose. This file asserts the one tree that ships.
 */
import { describe, expect, test } from "bun:test";
import { rows, unbacked } from "../scripts/repo-layout.ts";

/** The tracked paths of a repository, named from its root. */
function listing(dir: string): string[] {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: dir });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout.toString().split("\0").filter(Boolean);
}

/**
 * Tracked paths the layout section does not place under a directory, and why.
 *
 * The list is what scopes the sweep below, rather than an enumeration of the
 * directories it covers. Every entry ending in `/` exempts a whole subtree.
 */
const UNPLACED: Record<string, string> = {
	"docs/": "prose, whose owner the knowledge ownership map above assigns",
	"openspec/": "the workflow's own change artefacts and shipped specs",
	"tasks/": "infra task specs, also assigned by the ownership map",
	"spec-inbox/": "raw product specs — contents gitignored, its README tracked",
	".github/": "CI workflows and Dependabot, read by GitHub from this path",
	".claude/": "the agent's permission policy, its commands and skill symlinks",
	"src/app/":
		"the client's own internal layout — components, their styles and\n\t\ttheir tokens — is not this section's subject, the row above being the answer",
	"src/model.ts": "the prediction model — prose beside the table, not a row",
	"src/types.ts": "the bundle's shape, read by the client and the job alike",
	"src/css.d.ts": "the CSS-module declaration the bundler resolves from `src/`",
	"src/model.test.ts": "the model's own tests, which sit beside it",
	"src/model-estimate.test.ts": "the model's own tests, which sit beside it",
	"src/model-scoring.test.ts": "the model's own tests, which sit beside it",
	"src/model.fixture.ts": "the model's own fixture, which sits beside it",
};

describe("the README as it stands", () => {
	// Resolved before listing, like everything else in `checks/`: from this
	// file's own directory the listing would be `checks/` alone, and every row
	// would fail on finding nothing — which is the opposite mistake, but read
	// from the same wrong place.
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
		cwd: import.meta.dir,
	});
	if (top.exitCode !== 0) throw new Error(top.stderr.toString());
	// Only the terminator git adds, not `trim()`: `scripts/repo-layout.ts`
	// records why, and the two are halves of one capability.
	const root = top.stdout.toString().replace(/\n$/, "");

	test("its layout section names only directories the repository has", async () => {
		const readme = await Bun.file(`${root}/README.md`).text();
		expect(unbacked(readme, listing(root))).toEqual([]);
	});

	/** Every tracked path the section places, or `undefined` where the section is gone. */
	const placed = async () => {
		const readme = await Bun.file(`${root}/README.md`).text();
		return (rows(readme) ?? []).flatMap(({ path }) => (path ? [path] : []));
	};

	/** Whether `path` is covered by `key`, which is a prefix if it ends in `/`. */
	const covers = (key: string, path: string) =>
		key.endsWith("/") ? path.startsWith(key) : path === key;

	test("every tracked file sits under a directory the section names", async () => {
		// Scoped by what it exempts rather than by the directories it covers,
		// which is `scripts/repo-layout.ts`'s departure and the same reasoning:
		// an enumeration of what is covered passes in silence on the first
		// directory nobody thought of, and `src/worker/` would never have to be
		// documented at all.
		const named = new Set(await placed());
		const strays = listing(root).filter((path) => {
			// A file at the root is `scripts/repo-layout.ts`'s business.
			if (!path.includes("/")) return false;
			const dir = path.slice(0, path.lastIndexOf("/") + 1);
			// The file's own directory, matched exactly rather than by prefix:
			// `src/app/` covering `src/job/ingest/db.ts` by prefix would let the
			// ingest row be deleted with nothing noticing.
			if (named.has(dir)) return false;
			const keys = Object.keys(UNPLACED);
			return !keys.some((key) => covers(key, path) || covers(key, dir));
		});

		expect(strays).toEqual([]);
	});

	test("every exemption names something, and says why", () => {
		const tracked = listing(root);
		const wrong = Object.entries(UNPLACED).flatMap(([key, reason]) => {
			if (!tracked.some((path) => covers(key, path)))
				return [`${key}: exempted, and the repository tracks nothing under it`];
			return reason.trim() === "" ? [`${key}: exempted with no reason`] : [];
		});

		expect(wrong).toEqual([]);
	});
});
