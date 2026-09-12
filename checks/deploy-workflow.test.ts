/**
 * What gates a deploy, what it pushes, how it reaches the host, and which of
 * its values are secrets — all read off the workflow this repository actually
 * ships.
 *
 * Read directly rather than through a decision rule of this file's own. The
 * seven files this replaces each carried an analyser — a needs-graph walk, a
 * tag parser, a shell-assignment reader, a secret-reference matcher — and then
 * the fabricated workflows proving that analyser was not vacuous. An assertion
 * naming the value it expects has no such rule to exercise, so the
 * fabrications had nothing left to guard.
 *
 * The trade is stated rather than hidden: these cases answer "is this workflow
 * right" and no longer "would this check notice if it were wrong". What only a
 * run can show is still shown by one — `container-image-entry`, `-mounts`,
 * `-context` and `deployment-shared-files`.
 */
import { describe, expect, test } from "bun:test";
import { CHECKS, deployed, repository } from "./deploy-workflow.fixture.ts";

const { workflow, readme } = deployed();

type Step = {
	uses?: string;
	run?: string;
	env?: Record<string, string>;
	with?: Record<string, unknown>;
};
type Job = {
	needs?: string | string[];
	uses?: string;
	environment?: string;
	permissions?: Record<string, string>;
	steps?: Step[];
};
type Deploy = {
	on?: Record<string, { branches?: string[] }>;
	permissions?: Record<string, string>;
	concurrency?: { group?: string };
	env?: Record<string, string>;
	jobs?: Record<string, Job>;
};

const deploy = Bun.YAML.parse(workflow) as Deploy;
const jobs = deploy.jobs ?? {};
const steps = (id: string) => jobs[id]?.steps ?? [];

/** Every job's dependencies, in either spelling GitHub accepts. */
const needs = (id: string) => {
	const declared = jobs[id]?.needs;
	return typeof declared === "string" ? [declared] : (declared ?? []);
};

// --- the gate --------------------------------------------------------------

/**
 * Named exhaustively rather than by what each job does. A job added to this
 * workflow is ungated until somebody says otherwise, and the failure that
 * catches is a build step landing in a job nothing depends on — which reads
 * perfectly well beside the four that are gated.
 */
// spec: deploy-workflow/a-commit-whose-checks-fail
test("the workflow runs these jobs and no others", () => {
	expect(Object.keys(jobs).sort()).toEqual([
		"e2e",
		"host",
		"image",
		"lint",
		"test",
	]);
});

// spec: deploy-workflow/a-commit-whose-checks-fail
test("nothing builds, pushes or reaches the host before the checks", () => {
	expect(needs("image").sort()).toEqual(["e2e", "lint", "test"]);
	// Through the build rather than naming the three again: the host job is
	// gated exactly as tightly either way, and one spelling cannot drift.
	expect(needs("host")).toEqual(["image"]);
});

// spec: deploy-workflow/the-gate-is-readable-in-the-workflow
test("the checks are named here as called workflows, not left to settings", () => {
	expect(
		Object.fromEntries(
			Object.entries(jobs)
				.filter(([, job]) => job.uses)
				.map(([id, job]) => [id, job.uses]),
		),
	).toEqual({
		lint: "./.github/workflows/lint.yml",
		test: "./.github/workflows/test.yml",
		e2e: "./.github/workflows/e2e.yml",
	});
});

// spec: deploy-workflow/the-commands-are-defined-once
test("no step here re-runs a command a check workflow owns", () => {
	const run = Object.values(jobs).flatMap((job) =>
		(job.steps ?? []).flatMap((step) => (step.run ? [step.run.trim()] : [])),
	);
	for (const command of Object.values(CHECKS))
		expect(run).not.toContain(command);
});

/**
 * The three called workflows, read from the repository rather than restated:
 * without `workflow_call` the dependency above cannot be written at all, and
 * without `pull_request` the check has moved from before the merge to after
 * it while the gate file reads exactly the same.
 *
 * The groups must differ because `github.workflow` in a called workflow is
 * the *caller's* name: one spelling shared by all three collapses them into a
 * single group, and `cancel-in-progress` then leaves two gates cancelled.
 */
// spec: deploy-workflow/a-check-the-deploy-cannot-depend-on
describe("every workflow the deploy calls", () => {
	const called = Object.values(jobs)
		.flatMap((job) => (job.uses ? [job.uses.split("/").pop() as string] : []))
		.map((name) => {
			const text = repository()[name];
			if (!text)
				throw new Error(`the deploy calls ${name}, which is not there`);
			return [name, Bun.YAML.parse(text) as Deploy] as const;
		});

	test("there are three of them", () => {
		expect(called).toHaveLength(3);
	});

	test.each(called)(
		"%s is callable and still runs on pull requests",
		(_name, doc) => {
			const on = Object.keys(doc.on ?? {});
			expect(on).toContain("workflow_call");
			expect(on).toContain("pull_request");
		},
	);

	test("their concurrency groups are three distinct strings", () => {
		const groups = called.map(([, doc]) =>
			doc.concurrency?.group?.toLowerCase(),
		);
		for (const group of groups) expect(group).toBeTruthy();
		expect(new Set(groups).size).toBe(3);
	});
});

// --- what is pushed, and what the host runs --------------------------------

// Escaped in template literals rather than written plain: `${{` inside a
// quoted string is a placeholder the linter warns about, and the warning is
// about this file's own text rather than about the workflow it reads.
const IMAGE = `\${{ env.IMAGE }}`;
const SHA = `\${{ github.sha }}`;

const build = steps("image").find((step) =>
	step.uses?.startsWith("docker/build-push-action"),
);

// spec: deploy-workflow/a-deploy-completes
test("the build pushes both tags", () => {
	expect(build?.with?.push).toBe(true);
	const tags = String(build?.with?.tags ?? "")
		.split("\n")
		.map((tag) => tag.trim())
		.filter(Boolean);
	expect(tags.sort()).toEqual([`${IMAGE}:${SHA}`, `${IMAGE}:latest`].sort());
});

// spec: deploy-workflow/the-image-the-host-is-running
test("the host is handed the commit's tag, never `latest`", () => {
	const reference = steps("host")[0]?.env?.D2ASS_IMAGE;
	expect(reference).toBe(`${IMAGE}:${SHA}`);
	// The value the compose project resolves has to reach the machine as well
	// as be set: an `env:` the action does not forward is a variable the script
	// never sees.
	expect(steps("host")[0]?.with?.envs).toBe("D2ASS_IMAGE");
});

/**
 * One passage, not four mentions scattered through the README: a rollback
 * named in one place and its command in another is a procedure the reader has
 * to assemble while the site is down.
 */
// spec: deploy-workflow/a-release-that-has-to-be-undone
test("the README names the rollback in a single passage", () => {
	const image = deploy.env?.IMAGE as string;
	// One passage carrying the whole procedure, rather than one mentioning the
	// word: the README discusses rollback-safe migrations elsewhere, which is a
	// different subject and not a second copy of the steps.
	const whole = readme
		.split(/\n\s*\n/)
		.filter(
			(block) =>
				/roll ?back/i.test(block) &&
				block.includes("D2ASS_IMAGE") &&
				block.includes("docker compose") &&
				block.includes(image),
		);
	expect(whole).toHaveLength(1);
	// Not by the tag that moves: a rollback documented as `latest` puts the
	// host on whatever the next deploy makes of that name.
	expect(whole[0]).not.toContain(`${image}:latest`);
});

// --- the host script -------------------------------------------------------

const script = String(steps("host")[0]?.with?.script ?? "")
	.split("\n")
	.map((line) => line.trim())
	.filter(Boolean);

// spec: deploy-workflow/the-image-is-pulled-first
test("the pull precedes everything that touches the running container", () => {
	const pull = script.findIndex((line) =>
		line.startsWith("docker compose pull"),
	);
	expect(pull).toBeGreaterThanOrEqual(0);
	const touches = script.flatMap((line, at) =>
		at !== pull && /^docker\b/.test(line) ? [at] : [],
	);
	for (const at of touches) expect(at).toBeGreaterThan(pull);
});

// spec: deploy-workflow/a-pull-that-fails
test("the script stops on the failed pull rather than replacing with nothing", () => {
	// `-e` is the half that matters here; `set -u` alone leaves a failed pull
	// followed by a replacement that has nothing to replace the container with.
	expect(script[0]).toMatch(/^set -[a-z]*e[a-z]*$/);
});

// --- hygiene ---------------------------------------------------------------

/** Every `uses:` line as written, comment included. */
const usesLines = workflow
	.split("\n")
	.map((line) => line.trim())
	.filter((line) => line.startsWith("- uses:") || line.startsWith("uses:"));

// spec: deploy-workflow/an-action-pinned-by-tag
// spec: deploy-workflow/a-pin-with-no-version-beside-it
test.each(usesLines)(
	"%s is pinned by SHA with its version beside it",
	(line) => {
		// A local workflow call is a path, not an action, and carries no pin.
		if (line.includes("./.github/")) return;
		expect(line).toMatch(/@[0-9a-f]{40} # v\d[\w.-]*$/);
	},
);

// spec: deploy-workflow/the-permissions-the-workflow-takes
test("the workflow declares its permissions and no job widens them", () => {
	expect(deploy.permissions).toEqual({ contents: "read" });
	for (const job of Object.values(jobs))
		for (const scope of Object.values(job.permissions ?? {}))
			expect(scope).not.toBe("write");
});

// spec: deploy-workflow/an-event-value-reaching-a-shell
test("no run: block interpolates an attacker-controllable event value", () => {
	for (const job of Object.values(jobs))
		for (const step of job.steps ?? [])
			expect(step.run ?? "").not.toContain("github.event.");
});

// --- secrets ---------------------------------------------------------------

// spec: deploy-workflow/a-non-secret-in-the-secret-store
test("the registry, the image and the container reference are in the open", () => {
	expect(deploy.env).toEqual({
		REGISTRY: "docker.io",
		REGISTRY_USER: "laidrivm",
		IMAGE: "laidrivm/d2ass",
	});
	for (const name of Object.keys(deploy.env ?? {}))
		expect(workflow).not.toContain(`secrets.${name}`);
});

// spec: deploy-workflow/the-host-s-address-in-a-public-repository
test("the host, port and user reach the action from secrets", () => {
	const connection = steps("host")[0]?.with ?? {};
	for (const key of ["host", "port", "username", "key"])
		expect(String(connection[key] ?? "")).toMatch(/^\$\{\{ secrets\.\w+ \}\}$/);
});

// spec: deploy-workflow/a-deploy-from-a-branch-that-is-not-the-default
test("every job that reads a secret is gated on the production environment", () => {
	const reading = Object.entries(jobs).filter(([, job]) =>
		JSON.stringify(job).includes("secrets."),
	);
	expect(reading.map(([id]) => id).sort()).toEqual(["host", "image"]);
	for (const [, job] of reading) expect(job.environment).toBe("production");
});

// spec: deploy-workflow/a-commit-whose-checks-fail
test("the workflow runs on a push to the default branch alone", () => {
	expect(deploy.on).toEqual({ push: { branches: ["main"] } });
});
