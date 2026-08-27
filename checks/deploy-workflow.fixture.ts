/**
 * The workflow set the gate cases read: the repository's own, and a synthetic
 * one for every case that has to be arranged.
 *
 * `Bun.YAML.stringify` is what builds the synthetic files. It emits flow style
 * — the whole document on one line — which is fine for anything read through a
 * parse and wrong for anything read line by line, so the checks that scan text
 * write their fixtures out by hand instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The workflow whose gate this is. */
export const DEPLOY = "deploy.yml";

/** Every workflow in the repository, by file name. */
export function repository(): Record<string, string> {
	const dir = `${root}/.github/workflows`;
	const files = Object.fromEntries(
		[...new Bun.Glob("*.yml").scanSync(dir)].map((name) => [
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

/**
 * The jobs each check workflow runs, by file name.
 *
 * The linter and the type check share `lint.yml`, as they do in the
 * repository: giving each a file of its own would leave the case that one
 * workflow owns two checks unexercised.
 */
export const JOBS: Record<string, object> = {
	"lint.yml": {
		biome: { steps: [{ run: "bun run lint" }] },
		typecheck: { steps: [{ run: "bun run typecheck" }] },
	},
	"test.yml": { coverage: { steps: [{ run: "bun test" }] } },
	"e2e.yml": { smoke: { steps: [{ run: "bunx playwright test" }] } },
};

/**
 * One check workflow, callable and holding a group of its own unless a case
 * says otherwise. `group: null` is a workflow declaring none.
 */
export const check = (
	name: string,
	{ on, group }: { on?: object; group?: string | null } = {},
) =>
	Bun.YAML.stringify({
		on: on ?? { pull_request: null, workflow_call: null },
		...(group === null
			? {}
			: {
					concurrency: {
						group: group ?? `${name.replace(".yml", "")}-\${{ github.ref }}`,
						"cancel-in-progress": true,
					},
				}),
		jobs: JOBS[name] ?? {},
	});

/** A set of check workflows the gate has nothing to say about. */
export const checks = () =>
	Object.fromEntries(Object.keys(JOBS).map((name) => [name, check(name)]));

/** The deploy jobs that are the gate itself. */
export const gate = {
	lint: { uses: "./.github/workflows/lint.yml" },
	test: { uses: "./.github/workflows/test.yml" },
	e2e: { uses: "./.github/workflows/e2e.yml" },
};

/** A deploy the gate has nothing to say about, with `jobs` or `on` replaced. */
export const deploy = (
	jobs: object = {},
	on: object = { push: { branches: ["main"] } },
) => ({
	...checks(),
	[DEPLOY]: Bun.YAML.stringify({
		on,
		jobs: {
			...gate,
			push: { needs: ["lint", "test", "e2e"], steps: [{ run: "docker push" }] },
			...jobs,
		},
	}),
});
