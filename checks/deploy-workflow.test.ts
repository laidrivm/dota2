/**
 * What gates a deploy, read off the workflows rather than off repository
 * settings.
 *
 * Every check here triggers on `pull_request` alone, so a squash merge puts a
 * commit on `main` that none of them has ever run against. The gate closing
 * that is `workflow_call` plus `needs:`, and it is only a gate while all three
 * halves hold: the check workflows stay callable, the deploy calls them, and
 * everything that builds, pushes or reaches the host sits behind those calls.
 * Any one of them silently absent leaves a deploy that runs unchecked and a
 * workflow that reads as though it does not.
 *
 * The four checks are named below by the command each runs, never by the file
 * it sits in. Two of them share `lint.yml` today, and a file-name list would
 * both freeze that and count three things while claiming four.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The workflow whose gate this is. */
const DEPLOY = "deploy.yml";

/** The four checks that gate a deploy, each as the command that runs it. */
const CHECKS = {
	linter: "bun run lint",
	"type check": "bun run typecheck",
	"unit suite": "bun test",
	"end-to-end suite": "bunx playwright test",
};

type Step = { run?: string };
type Job = { needs?: string | string[]; uses?: string; steps?: Step[] };
type Workflow = { on?: Record<string, unknown>; jobs?: Record<string, Job> };

/** Every command a workflow's own steps run, trimmed as written. */
const runsOf = (doc: Workflow) =>
	Object.values(doc.jobs ?? {}).flatMap((job) =>
		(job.steps ?? []).flatMap((step) => (step.run ? [step.run.trim()] : [])),
	);

/** A job's dependencies, in either spelling GitHub accepts. */
const needsOf = (job: Job | undefined) =>
	typeof job?.needs === "string" ? [job.needs] : (job?.needs ?? []);

/**
 * Every job `id` depends on, directly or through another.
 *
 * Transitive, because a deploy job that needs a build job that needs the
 * checks is gated exactly as tightly as one naming them itself — and reading
 * only the direct list would fail a workflow that is correct. `reach` doubles
 * as the visited set, so a `needs:` cycle terminates rather than hanging.
 */
function chain(jobs: Record<string, Job>, id: string): Set<string> {
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
 * Everything wrong with the gate, and an empty list when nothing is.
 *
 * `files` is every workflow in the repository by file name, the deploy among
 * them: which workflow owns which check is a reading of the set, not a fact
 * this file can be told.
 */
export function problems(files: Record<string, string>): string[] {
	const found: string[] = [];
	const docs = new Map<string, Workflow>(
		Object.entries(files).map(([name, text]) => [
			name,
			(Bun.YAML.parse(text) ?? {}) as Workflow,
		]),
	);

	const deploy = docs.get(DEPLOY);
	if (!deploy) return [`${DEPLOY}: absent — nothing deploys and nothing gates`];

	// A workflow that runs on nothing deploys nothing, and one on a wider
	// trigger deploys more than a merge. Compared whole rather than probed for
	// a `push` key: a second trigger beside it is the failure.
	if (!Bun.deepEquals(deploy.on, { push: { branches: ["main"] } }))
		found.push(
			`${DEPLOY}: triggers on ${JSON.stringify(deploy.on)}, not a push to main`,
		);

	/** Which workflow owns each check, found by the command it runs. */
	const owners = new Map<string, string>();
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
		else owners.set(check, owning[0] as string);
	}

	for (const [check, name] of owners)
		if (!("workflow_call" in (docs.get(name)?.on ?? {})))
			found.push(
				`${name}: the ${check}'s workflow exposes no workflow_call: trigger, so the deploy cannot depend on it`,
			);

	const jobs = deploy.jobs ?? {};

	/** The deploy jobs calling each check workflow. */
	const callers = new Map<string, string[]>();
	for (const [id, job] of Object.entries(jobs)) {
		const called = job.uses?.replace(/^\.\/\.github\/workflows\//, "");
		if (called && [...owners.values()].includes(called))
			callers.set(called, [...(callers.get(called) ?? []), id]);
	}

	/** The jobs that are the gate, and so are not behind it. */
	const calling = new Set([...callers.values()].flat());

	for (const [check, name] of owners) {
		const ids = callers.get(name) ?? [];
		if (ids.length === 0) {
			found.push(`${DEPLOY}: no job calls ${name}, so the ${check} is skipped`);
			continue;
		}
		// Everything else in the file: a job doing no deploy work is held to the
		// same chain rather than told apart by what its steps look like, because
		// the way a job reaches the host is exactly what a reader would have to
		// enumerate — and an enumeration is what the next step escapes through.
		for (const id of Object.keys(jobs)) {
			if (calling.has(id)) continue;
			const reach = chain(jobs, id);
			if (!ids.some((caller) => reach.has(caller)))
				found.push(`${DEPLOY}: job \`${id}\` does not need the ${check}`);
		}
	}

	for (const command of runsOf(deploy))
		if ((Object.values(CHECKS) as string[]).includes(command))
			found.push(
				`${DEPLOY}: spells out \`${command}\`, which the workflow owning it already defines`,
			);

	return found;
}

const workflow = (on: object, jobs: object) => Bun.YAML.stringify({ on, jobs });

/** What a check workflow triggers on once it is callable. */
const CALLABLE = { pull_request: null, workflow_call: null };

/** A set of check workflows this check has nothing to say about. */
const checks = {
	"lint.yml": workflow(CALLABLE, {
		biome: { steps: [{ run: "bun run lint" }] },
		typecheck: { steps: [{ run: "bun run typecheck" }] },
	}),
	"test.yml": workflow(CALLABLE, {
		coverage: { steps: [{ run: "bun test" }] },
	}),
	"e2e.yml": workflow(CALLABLE, {
		smoke: { steps: [{ run: "bunx playwright test" }] },
	}),
};

/** The jobs that are the gate itself. */
const gate = {
	lint: { uses: "./.github/workflows/lint.yml" },
	test: { uses: "./.github/workflows/test.yml" },
	e2e: { uses: "./.github/workflows/e2e.yml" },
};

/** A deploy this check has nothing to say about, with `jobs` replaced. */
const deploy = (jobs: object = {}) => ({
	...checks,
	[DEPLOY]: workflow(
		{ push: { branches: ["main"] } },
		{
			...gate,
			push: { needs: ["lint", "test", "e2e"], steps: [{ run: "docker push" }] },
			...jobs,
		},
	),
});

// spec: deploy-workflow/the-gate-is-readable-in-the-workflow
test("a deploy naming all four checks as dependencies passes", () => {
	expect(problems(deploy())).toEqual([]);
});

// spec: deploy-workflow/a-commit-whose-checks-fail
describe("a chain that does not reach every check", () => {
	test("fails on the one it misses", () => {
		const jobs = { push: { needs: ["lint", "test"], steps: [] } };
		expect(problems(deploy(jobs))).toEqual([
			"deploy.yml: job `push` does not need the end-to-end suite",
		]);
	});

	test("passes when the checks are reached through another job", () => {
		const jobs = {
			build: { needs: ["lint", "test", "e2e"], steps: [] },
			push: { needs: "build", steps: [] },
		};
		expect(problems(deploy(jobs))).toEqual([]);
	});

	test("fails when a check is called by no job at all", () => {
		const without = deploy();
		without[DEPLOY] = workflow(
			{ push: { branches: ["main"] } },
			{ lint: gate.lint, test: gate.test, push: { needs: ["lint", "test"] } },
		);
		expect(problems(without)).toEqual([
			"deploy.yml: no job calls e2e.yml, so the end-to-end suite is skipped",
		]);
	});
});

// spec: deploy-workflow/a-commit-whose-checks-fail
describe("the trigger the deploy runs on", () => {
	test.each([
		["pull_request", { pull_request: null }],
		[
			"a second trigger beside the merge",
			{ push: { branches: ["main"] }, workflow_dispatch: null },
		],
	])("%s fails", (_what, on) => {
		const wrong = deploy();
		wrong[DEPLOY] = workflow(on, {
			...gate,
			push: { needs: ["lint", "test", "e2e"] },
		});
		expect(problems(wrong)).toEqual([
			`deploy.yml: triggers on ${JSON.stringify(on)}, not a push to main`,
		]);
	});
});

// spec: deploy-workflow/a-check-the-deploy-cannot-depend-on
test("a check workflow exposing no workflow_call trigger fails", () => {
	const uncallable = deploy();
	uncallable["e2e.yml"] = workflow(
		{ pull_request: null },
		{ smoke: { steps: [{ run: "bunx playwright test" }] } },
	);
	expect(problems(uncallable)).toEqual([
		"e2e.yml: the end-to-end suite's workflow exposes no workflow_call: trigger, so the deploy cannot depend on it",
	]);
});

// spec: deploy-workflow/the-commands-are-defined-once
test("a deploy running a check's own command fails", () => {
	const jobs = {
		push: { needs: ["lint", "test", "e2e"], steps: [{ run: "bun run lint" }] },
	};
	expect(problems(deploy(jobs))).toEqual([
		"deploy.yml: spells out `bun run lint`, which the workflow owning it already defines",
	]);
});

// spec: deploy-workflow/the-gate-is-readable-in-the-workflow
test("this repository passes", () => {
	const dir = `${root}/.github/workflows`;
	const files = Object.fromEntries(
		[...new Bun.Glob("*.yml").scanSync(dir)].map((name) => [
			name,
			readFileSync(join(dir, name), "utf8"),
		]),
	);
	// Guards the guard: an empty read satisfies nothing above and fails here.
	expect(Object.keys(files).length).toBeGreaterThan(1);
	expect(problems(files)).toEqual([]);
});
