/**
 * The files the deploy cases read: this repository's own workflows and its
 * README.
 *
 * Nothing here fabricates a workflow any more. The cases assert what the
 * shipped file says, so the only document they need is the shipped one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The workflow whose gate this is. */
export const DEPLOY = "deploy.yml";

/** The four checks that gate a deploy, each as the command that runs it. */
export const CHECKS = {
	linter: "bun run lint",
	"type check": "bun run typecheck",
	"unit suite": "bun test",
	"end-to-end suite": "bunx playwright test",
};

/**
 * As much of a workflow's shape as the cases read. `permissions` is typed as a
 * mapping because that is the form this repository writes; GitHub also accepts
 * the `write-all` scalar, which the cases reject rather than read.
 */
export type Step = {
	uses?: string;
	run?: string;
	env?: Record<string, string>;
	with?: Record<string, unknown>;
};
export type Job = {
	needs?: string | string[];
	uses?: string;
	environment?: string;
	permissions?: Record<string, string>;
	steps?: Step[];
};
export type Deploy = {
	on?: Record<string, { branches?: string[] }>;
	permissions?: Record<string, string>;
	concurrency?: { group?: string };
	env?: Record<string, string>;
	jobs?: Record<string, Job>;
};

/** Every workflow in the repository, by file name. */
export function repository(): Record<string, string> {
	const dir = `${root}/.github/workflows`;
	const files = Object.fromEntries(
		// Both extensions: GitHub runs a `.yaml` workflow exactly as it runs a
		// `.yml` one, and a check stored under the spelling this did not scan
		// would be a second owner nothing here could see.
		[...new Bun.Glob("*.{yml,yaml}").scanSync(dir)].map((name) => [
			name,
			readFileSync(join(dir, name), "utf8"),
		]),
	);
	// Guards every case reading this: an empty read satisfies most assertions
	// below by leaving them nothing to check.
	const found = Object.keys(files).length;
	if (found < 2) throw new Error(`expected several workflows, found ${found}`);
	return files;
}

/** The repository's own deploy workflow and README, as the real cases read them. */
export const deployed = () => ({
	workflow: readFileSync(`${root}/.github/workflows/deploy.yml`, "utf8"),
	readme: readFileSync(`${root}/README.md`, "utf8"),
});
