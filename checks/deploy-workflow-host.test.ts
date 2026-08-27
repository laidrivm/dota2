/**
 * The order the host script does things in, and what happens when the first
 * of them fails.
 *
 * Stopping the container before the replacement is on the machine puts the
 * download inside the outage: an image that is slow to pull turns a deploy
 * into a long one, and an image that cannot be pulled at all turns it into a
 * service that is down and not coming back. So the pull goes first, and the
 * shell has to stop on it — a script that carries on past a failed pull
 * replaces the running container with nothing.
 *
 * The pull is required to precede *every* other docker invocation rather than
 * an enumerated set of dangerous ones. A list of what stops a container is a
 * list the next command escapes through, and the requirement loses nothing by
 * the stricter reading: nothing else on that machine needs to run before the
 * image is there.
 */
import { describe, expect, test } from "bun:test";
import { hosted, SCRIPT, SSH } from "./deploy-host.fixture.ts";
import { BUILDER } from "./deploy-tags.fixture.ts";
import { chain, deployed } from "./deploy-workflow.fixture.ts";

/** A line that runs docker at all, whichever way it spells the call. */
const DOCKER = /(^|\s|[;&|])docker(\s|$)/;

/** A line that pulls, which is the one docker call allowed to be first. */
const PULL = /(^|\s|[;&|])docker\s+(compose\s+)?pull(\s|$)/;

/**
 * A line that turns on stopping at the first failing command.
 *
 * Every flag on the line, not the first group: `set -x -e` and `set -o
 * errexit` both do it and neither carries the `e` where a single-group read
 * would look. `-o errexit` is spelled out because `-o` takes a word.
 */
const ERREXIT = /^\s*set\s+(.*\s)?(-[a-z]*e[a-z]*|-o\s+errexit)(\s|$)/;

/** A line that turns it off again, which the one above says nothing about. */
const NO_ERREXIT = /^\s*set\s+(.*\s)?(\+[a-z]*e[a-z]*|\+o\s+errexit)(\s|$)/;

type Step = { uses?: string; with?: { script?: string } };
type Job = { needs?: string | string[]; steps?: Step[] };
type Workflow = { jobs?: Record<string, Job> };

/** The jobs holding a step that uses `action`. */
const jobsUsing = (jobs: Record<string, Job>, action: string) =>
	Object.entries(jobs)
		.filter(([, job]) =>
			(job.steps ?? []).some((step) => step.uses?.startsWith(`${action}@`)),
		)
		.map(([id]) => id);

/**
 * The lines of every host script the workflow runs.
 *
 * Read through the parse rather than off the file, because the script is a
 * block scalar: its lines are indented under `script:` and reading them as
 * file lines would carry that indentation into every pattern above.
 */
export const scriptsOf = (deploy: string) =>
	Object.values(((Bun.YAML.parse(deploy) ?? {}) as Workflow).jobs ?? {})
		.flatMap((job) => job.steps ?? [])
		.filter((step) => step.uses?.startsWith(`${SSH}@`))
		// Segments, not lines: `set -eu; docker compose pull` runs two commands
		// in order on one line, and reading the line whole answers neither which
		// came first nor what state the second ran under.
		.map((step) =>
			(step.with?.script ?? "")
				.split(/\n|;|&&|\|\|/)
				.map((segment) => segment.trim())
				.filter((segment) => segment !== ""),
		);

/** Everything wrong with the host steps, and nothing when nothing is. */
export function problems(deploy: string): string[] {
	const found: string[] = [];
	const jobs = ((Bun.YAML.parse(deploy) ?? {}) as Workflow).jobs ?? {};

	// Reaching the host after the checks is not enough: a host job depending on
	// them alone satisfies the gate and then pulls a tag no build has produced.
	// It has to be behind the push itself.
	const pushing = jobsUsing(jobs, BUILDER);
	if (pushing.length === 0) found.push("deploy.yml: no job pushes an image");
	for (const id of jobsUsing(jobs, SSH))
		for (const built of pushing)
			if (!chain(jobs, id).has(built))
				found.push(
					`deploy.yml: job \`${id}\` reaches the host without needing \`${built}\``,
				);

	const scripts = scriptsOf(deploy);
	// Guards every assertion below: with no host step they pass by having no
	// script to be wrong about, which is exactly how this check would go quiet
	// if the steps were ever moved out of the action.
	if (scripts.length !== 1)
		found.push(`deploy.yml: ${scripts.length} ${SSH} steps, expected one`);

	for (const lines of scripts) {
		const docker = lines
			.map((line, at) => ({ line, at }))
			.filter(({ line }) => DOCKER.test(line));
		const pulls = docker.filter(({ line }) => PULL.test(line));
		if (pulls.length === 0) {
			found.push("deploy.yml: the host script pulls nothing");
			continue;
		}
		const first = pulls[0]?.at as number;
		for (const { line, at } of docker)
			if (at < first)
				found.push(
					`deploy.yml: \`${line}\` runs before the image is on the host`,
				);
		// The pull going first only means anything while a failed one ends the
		// script: without this the deploy carries on to the replacement having
		// nothing to replace the container with.
		//
		// The question is whether it is in force *at the pull*, not whether it
		// appears anywhere — one turned on afterwards guards every step but the
		// one whose failure this exists to survive, and `set +e` before the pull
		// turns it off again while leaving the enabling line in the file to read.
		let stopping = false;
		let changed = -1;
		for (let at = 0; at < first; at++) {
			const line = lines[at] as string;
			if (ERREXIT.test(line)) [stopping, changed] = [true, at];
			else if (NO_ERREXIT.test(line)) [stopping, changed] = [false, at];
		}
		if (!stopping)
			found.push(
				changed === -1 && !lines.some((line) => ERREXIT.test(line))
					? "deploy.yml: the host script does not stop on a failure"
					: `deploy.yml: the script is not stopping on a failure when the pull runs: \`${changed === -1 ? (lines.find((line) => ERREXIT.test(line)) as string) : lines[changed]}\``,
			);
	}

	return found;
}

// spec: deploy-workflow/the-image-is-pulled-first
describe("the order the host script runs in", () => {
	test("pull, then bring the project up, passes", () => {
		expect(problems(hosted())).toEqual([]);
	});

	test.each([
		["up", "docker compose up -d"],
		["down", "docker compose down"],
		["stop", "docker stop d2ass-app"],
	])("%s before the pull fails", (_what, command) => {
		const script = ["set -eu", command, "docker compose pull"];
		expect(problems(hosted({ script }))).toEqual([
			`deploy.yml: \`${command}\` runs before the image is on the host`,
		]);
	});

	test("a script that pulls nothing fails", () => {
		const script = ["set -eu", "docker compose up -d"];
		expect(problems(hosted({ script }))).toEqual([
			"deploy.yml: the host script pulls nothing",
		]);
	});

	test("the setting and the pull on one line passes", () => {
		// Valid shell, and read as a whole line it carries neither pattern in a
		// form either would match — so the line has to be read as the two
		// commands it is.
		const script = ["set -eu; docker compose pull", "docker compose up -d"];
		expect(problems(hosted({ script }))).toEqual([]);
	});

	test("turned off on the pull's own line fails", () => {
		const script = [
			"set -eu",
			"set +e; docker compose pull",
			"docker compose up -d",
		];
		expect(problems(hosted({ script }))).toEqual([
			"deploy.yml: the script is not stopping on a failure when the pull runs: `set +e`",
		]);
	});

	test("pull and up on one line passes", () => {
		// `&&` short-circuits, so the pull is first and nothing follows a failed
		// one — the same guarantee the two-line form gives.
		const script = ["set -eu", "docker compose pull && docker compose up -d"];
		expect(problems(hosted({ script }))).toEqual([]);
	});

	test.each([
		[
			"no host step at all",
			(y: string) => y.replace(`${SSH}@`, "actions/checkout@"),
			0,
		],
		[
			"a second one",
			(y: string) => y + y.slice(y.indexOf(`      - uses: ${SSH}@`)),
			2,
		],
	])("a workflow with %s fails", (_what, mangle, count) => {
		expect(problems(mangle(hosted()))).toContainEqual(
			`deploy.yml: ${count} ${SSH} steps, expected one`,
		);
	});
});

// spec: deploy-workflow/a-pull-that-fails
describe("a pull that cannot succeed", () => {
	test("fails when nothing stops the script", () => {
		expect(problems(hosted({ script: SCRIPT.slice(1) }))).toEqual([
			"deploy.yml: the host script does not stop on a failure",
		]);
	});

	test.each([
		"set -e",
		"set -eu",
		"set -euo pipefail",
		"set -x -e",
		"set -o errexit",
	])("passes with `%s`", (setting) => {
		const script = [setting, ...SCRIPT.slice(1)];
		expect(problems(hosted({ script }))).toEqual([]);
	});

	test.each([
		[
			"turned on only after the pull",
			["docker compose pull", "set -eu", "docker compose up -d"],
			"set -eu",
		],
		[
			"turned off again before it",
			["set -eu", "set +e", "docker compose pull", "docker compose up -d"],
			"set +e",
		],
		[
			"turned off by the long form",
			["set -eu", "set +o errexit", "docker compose pull"],
			"set +o errexit",
		],
	])("%s fails", (_what, script, named) => {
		expect(problems(hosted({ script }))).toEqual([
			`deploy.yml: the script is not stopping on a failure when the pull runs: \`${named}\``,
		]);
	});

	test("`set -u` alone does not count", () => {
		// It stops on an unset variable and carries on past a failed command,
		// which is the failure this case exists to tell from the one above.
		const script = ["set -u", ...SCRIPT.slice(1)];
		expect(problems(hosted({ script }))).toEqual([
			"deploy.yml: the host script does not stop on a failure",
		]);
	});
});

// spec: deploy-workflow/the-image-is-pulled-first
describe("when the host is reached", () => {
	test("a host job that does not need the push fails", () => {
		const parallel = hosted().replace("    needs: image\n", "");
		expect(problems(parallel)).toEqual([
			"deploy.yml: job `host` reaches the host without needing `image`",
		]);
	});

	test("a workflow that pushes nothing at all fails", () => {
		const nothing = hosted().replace(`${BUILDER}@`, "actions/checkout@");
		expect(problems(nothing)).toEqual(["deploy.yml: no job pushes an image"]);
	});
});

// spec: deploy-workflow/the-image-is-pulled-first
test("this repository passes", () => {
	expect(problems(deployed().workflow)).toEqual([]);
});
