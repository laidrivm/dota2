/**
 * What gates a deploy, read off the workflows rather than off repository
 * settings.
 *
 * Every check here triggers on `pull_request` alone, so a squash merge puts a
 * commit on `main` that none of them has ever run against. The gate closing
 * that is `workflow_call` plus `needs:`, and it is only a gate while both
 * halves hold: the deploy calls the check workflows, and everything that
 * builds, pushes or reaches the host sits behind those calls. What a called
 * workflow has to be for the call to mean anything is
 * `checks/deploy-workflow-callable.test.ts`.
 *
 * The four checks are named below by the command each runs, never by the file
 * it sits in. Two of them share `lint.yml` today, and a file-name list would
 * both freeze that and count three things while claiming four.
 */
import { describe, expect, test } from "bun:test";
import {
	checks,
	DEPLOY,
	deploy,
	gate,
	repository,
} from "./deploy-workflow.fixture.ts";

/** The four checks that gate a deploy, each as the command that runs it. */
export const CHECKS = {
	linter: "bun run lint",
	"type check": "bun run typecheck",
	"unit suite": "bun test",
	"end-to-end suite": "bunx playwright test",
};

type Step = { run?: string };
type Job = { needs?: string | string[]; uses?: string; steps?: Step[] };
export type Workflow = {
	on?: Record<string, unknown>;
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

/** Every command a workflow's own steps run, trimmed as written. */
const runsOf = (doc: Workflow) =>
	Object.values(doc.jobs ?? {}).flatMap((job) =>
		(job.steps ?? []).flatMap((step) => (step.run ? [step.run.trim()] : [])),
	);

/** A job's dependencies, in either spelling GitHub accepts. */
const needsOf = (job: Job | undefined) =>
	typeof job?.needs === "string" ? [job.needs] : (job?.needs ?? []);

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

/** Everything wrong with the gate, and an empty list when nothing is. */
export function problems(files: Record<string, string>): string[] {
	const docs = parse(files);
	const deployed = docs.get(DEPLOY);
	if (!deployed)
		return [`${DEPLOY}: absent — nothing deploys and nothing gates`];

	const { owners, problems: found } = ownersOf(docs);

	// A workflow that runs on nothing deploys nothing, and one on a wider
	// trigger deploys more than a merge. Compared whole rather than probed for
	// a `push` key: a second trigger beside it is the failure.
	if (!Bun.deepEquals(deployed.on, { push: { branches: ["main"] } }))
		found.push(
			`${DEPLOY}: triggers on ${JSON.stringify(deployed.on)}, not a push to main`,
		);

	const jobs = deployed.jobs ?? {};

	/** The deploy jobs calling each check workflow. */
	const callers = new Map<string, string[]>();
	for (const [id, job] of Object.entries(jobs)) {
		const called = job.uses?.replace(/^\.\/\.github\/workflows\//, "");
		if (called && owners.has(called))
			callers.set(called, [...(callers.get(called) ?? []), id]);
	}

	/** The jobs that are the gate, and so are not behind it. */
	const calling = new Set([...callers.values()].flat());

	for (const [name, owned] of owners) {
		const which = owned.join(" and ");
		const ids = callers.get(name) ?? [];
		if (ids.length === 0) {
			found.push(`${DEPLOY}: no job calls ${name}, so the ${which} is skipped`);
			continue;
		}
		// Everything else in the file: a job doing no deploy work is held to the
		// same chain rather than told apart by what its steps look like, because
		// the way a job reaches the host is exactly what a reader would have to
		// enumerate — and an enumeration is what the next change escapes through.
		for (const id of Object.keys(jobs)) {
			if (calling.has(id)) continue;
			const reach = chain(jobs, id);
			if (!ids.some((caller) => reach.has(caller)))
				found.push(`${DEPLOY}: job \`${id}\` does not need the ${which}`);
		}
	}

	for (const command of runsOf(deployed))
		if ((Object.values(CHECKS) as string[]).includes(command))
			found.push(
				`${DEPLOY}: spells out \`${command}\`, which the workflow owning it already defines`,
			);

	return found;
}

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

	test("terminates on a needs: cycle rather than following it forever", () => {
		const jobs = {
			build: { needs: ["push", "lint", "test", "e2e"], steps: [] },
			push: { needs: "build", steps: [] },
		};
		expect(problems(deploy(jobs))).toEqual([]);
	});

	test("fails when a check is called by no job at all", () => {
		const without = deploy();
		without[DEPLOY] = Bun.YAML.stringify({
			on: { push: { branches: ["main"] } },
			jobs: {
				lint: gate.lint,
				test: gate.test,
				push: { needs: ["lint", "test"] },
			},
		});
		expect(problems(without)).toEqual([
			"deploy.yml: no job calls e2e.yml, so the end-to-end suite is skipped",
		]);
	});
});

// spec: deploy-workflow/a-check-the-deploy-cannot-depend-on
describe("a check no single workflow owns", () => {
	/**
	 * A deploy calling only the two workflows the case leaves attributable. It
	 * calls no third, because a job calling a workflow the gate cannot attribute
	 * is not a caller — it is another job behind the gate, reported as one, and
	 * the ownership fault is what these cases are about.
	 */
	const partial = () => {
		const files = deploy();
		files[DEPLOY] = Bun.YAML.stringify({
			on: { push: { branches: ["main"] } },
			jobs: {
				lint: gate.lint,
				test: gate.test,
				push: { needs: ["lint", "test"] },
			},
		});
		return files;
	};

	test("one no workflow runs at all is named", () => {
		const gone = partial();
		delete (gone as Record<string, string>)["e2e.yml"];
		expect(problems(gone)).toEqual([
			"end-to-end suite: 0 workflows run `bunx playwright test`, expected one",
		]);
	});

	test("one two workflows run is named", () => {
		const twice = { ...partial(), "smoke.yml": checks()["e2e.yml"] as string };
		expect(problems(twice)).toEqual([
			"end-to-end suite: 2 workflows run `bunx playwright test`, expected one",
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
		expect(problems(deploy({}, on))).toEqual([
			`deploy.yml: triggers on ${JSON.stringify(on)}, not a push to main`,
		]);
	});
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
	expect(problems(repository())).toEqual([]);
});
