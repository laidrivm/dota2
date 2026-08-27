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
import { deployed } from "./deploy-workflow.fixture.ts";

/** A line that runs docker at all, whichever way it spells the call. */
const DOCKER = /(^|\s|[;&|])docker(\s|$)/;

/** A line that pulls, which is the one docker call allowed to be first. */
const PULL = /(^|\s|[;&|])docker\s+(compose\s+)?pull(\s|$)/;

/** The shell settings that stop a script at its first failing command. */
const ERREXIT = /^\s*set\s+-[a-z]*e[a-z]*(\s|$)/;

type Step = { uses?: string; with?: { script?: string } };
type Workflow = { jobs?: Record<string, { steps?: Step[] }> };

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
		.map((step) => (step.with?.script ?? "").split("\n").map((l) => l.trim()));

/** Everything wrong with the host script, and nothing when nothing is. */
export function problems(deploy: string): string[] {
	const found: string[] = [];
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
		if (!lines.some((line) => ERREXIT.test(line)))
			found.push("deploy.yml: the host script does not stop on a failure");
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

	test("a workflow with no host step at all fails", () => {
		const bare = hosted().replace(`${SSH}@`, "actions/checkout@");
		expect(problems(bare)).toEqual([
			`deploy.yml: 0 ${SSH} steps, expected one`,
		]);
	});
});

// spec: deploy-workflow/a-pull-that-fails
describe("a pull that cannot succeed", () => {
	test("fails when nothing stops the script", () => {
		expect(problems(hosted({ script: SCRIPT.slice(1) }))).toEqual([
			"deploy.yml: the host script does not stop on a failure",
		]);
	});

	test.each(["set -e", "set -eu", "set -euo pipefail"])(
		"passes with `%s`",
		(setting) => {
			const script = [setting, ...SCRIPT.slice(1)];
			expect(problems(hosted({ script }))).toEqual([]);
		},
	);

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
test("this repository passes", () => {
	expect(problems(deployed().workflow)).toEqual([]);
});
