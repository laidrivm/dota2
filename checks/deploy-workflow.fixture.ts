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

/** The four checks that gate a deploy, each as the command that runs it. */
export const CHECKS = {
	linter: "bun run lint",
	"type check": "bun run typecheck",
	"unit suite": "bun test",
	"end-to-end suite": "bunx playwright test",
};

export type Step = { run?: string };
export type Job = { needs?: string | string[]; uses?: string; steps?: Step[] };
export type Workflow = {
	on?: string | string[] | Record<string, unknown>;
	concurrency?: { group?: string };
	jobs?: Record<string, Job>;
};

/** Every workflow by file name, parsed. */
export const parse = (files: Record<string, string>) =>
	new Map<string, Workflow>(
		Object.entries(files).map(([name, text]) => [
			name,
			(Bun.YAML.parse(text) ?? {}) as Workflow,
		]),
	);

/**
 * The events a workflow triggers on, whatever form it wrote them in.
 *
 * GitHub accepts `on: pull_request`, `on: [pull_request, workflow_call]` and
 * the mapping this repository uses. A membership test against the raw value
 * throws on the first — `in` refuses a string right operand — and reads array
 * *indexes* on the second, reporting every trigger as absent on a file that
 * declares them all.
 */
export const triggersOf = (doc: Workflow) => {
	const on = doc.on;
	if (typeof on === "string") return new Set([on]);
	if (Array.isArray(on)) return new Set(on.map(String));
	return new Set(Object.keys(on ?? {}));
};

/** Every command a workflow's own steps run, trimmed as written. */
export const runsOf = (doc: Workflow) =>
	Object.values(doc.jobs ?? {}).flatMap((job) =>
		(job.steps ?? []).flatMap((step) => (step.run ? [step.run.trim()] : [])),
	);

/** A job's dependencies, in either spelling GitHub accepts. */
export const needsOf = (job: Job | undefined) =>
	typeof job?.needs === "string" ? [job.needs] : (job?.needs ?? []);

/**
 * Every job `id` depends on, directly or through another.
 *
 * Transitive, because a job that needs a job that needs the checks is gated
 * exactly as tightly as one naming them itself — and reading only the direct
 * list would fail a workflow that is correct. `reach` doubles as the visited
 * set, so a `needs:` cycle terminates rather than hanging.
 */
export function chain(
	// Only the dependencies are read, so any job shape a caller has works.
	jobs: Record<string, { needs?: string | string[] }>,
	id: string,
): Set<string> {
	const reach = new Set<string>();
	const queue = [...needsOf(jobs[id])];
	while (queue.length > 0) {
		const next = queue.shift() as string;
		if (reach.has(next)) continue;
		reach.add(next);
		queue.push(...needsOf(jobs[next]));
	}
	return reach;
}

/**
 * Which checks each workflow owns, found by the commands it runs, and what is
 * wrong with the finding.
 *
 * Keyed by workflow rather than by check, because one workflow owning two is
 * the arrangement here: keyed the other way, `lint.yml` would be reported
 * twice for one fault and would collide with itself in every comparison
 * between workflows.
 */
export function ownersOf(docs: Map<string, Workflow>) {
	const owners = new Map<string, string[]>();
	const found: string[] = [];
	for (const [check, command] of Object.entries(CHECKS)) {
		const owning = [...docs]
			.filter(([name, doc]) => name !== DEPLOY && runsOf(doc).includes(command))
			.map(([name]) => name);
		// Neither none nor two: a command no workflow runs is a check the
		// dependency cannot be written against at all, and one two workflows run
		// makes "the workflow owning it" a guess.
		if (owning.length !== 1)
			found.push(
				`${check}: ${owning.length} workflows run \`${command}\`, expected one`,
			);
		else {
			const name = owning[0] as string;
			owners.set(name, [...(owners.get(name) ?? []), check]);
		}
	}
	return { owners, problems: found };
}

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
	{
		on,
		group,
	}: { on?: string | string[] | object; group?: string | null } = {},
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

/** The repository's own deploy workflow and README, as the real cases read them. */
export const deployed = () => ({
	workflow: readFileSync(`${root}/.github/workflows/deploy.yml`, "utf8"),
	readme: readFileSync(`${root}/README.md`, "utf8"),
});
