/**
 * Which of the deploy's values are held as secrets, and which are written in
 * the open.
 *
 * Both directions, because both are failures. A value in the store that grants
 * nothing — the registry, the image repository, a container name — hides from
 * a reader what the workflow actually deploys and leaves the store itself
 * unauditable for what is really sensitive. A value in the open that does
 * grant something is the SSH host, port and user of a machine, in a public
 * repository, listening on a port that is not the default.
 *
 * The five names below are the requirement's own list rather than this file's
 * choice; the three open ones are too. What each connection input is called is
 * the action's, and is read off the step.
 */
import { describe, expect, test } from "bun:test";
import { hosted, SECRETS, SSH, secret } from "./deploy-host.fixture.ts";
import { deployed } from "./deploy-workflow.fixture.ts";

/** The values that grant nothing, each of which belongs in `env:`. */
const OPEN = ["REGISTRY", "REGISTRY_USER", "IMAGE"];

/**
 * What a secret in the store must not be: any of the three above, by name.
 * Case-insensitive, because the expression context is — `secrets.registry`
 * reads the same secret as `secrets.REGISTRY`.
 */
const NOT_SECRET = /REGISTRY|IMAGE|CONTAINER/i;

/** The connection inputs the requirement names, in the action's spelling. */
const CONNECTION = ["host", "port", "username", "key"];

/** A `secrets.NAME` reference, whichever expression carries it. */
const SECRET = /secrets\.([A-Za-z_][A-Za-z0-9_]*)/g;

type Step = { uses?: string; with?: Record<string, string> };
type Job = { environment?: string; steps?: Step[] };
type Workflow = { env?: Record<string, string>; jobs?: Record<string, Job> };

/** Everything wrong with the split, and nothing when nothing is. */
export function problems(deploy: string): string[] {
	const found: string[] = [];
	const doc = (Bun.YAML.parse(deploy) ?? {}) as Workflow;

	for (const name of OPEN)
		if (!doc.env?.[name])
			found.push(
				`deploy.yml: ${name} is not in env:, so it is written nowhere`,
			);

	// Read off the whole file rather than off the steps: a non-secret in the
	// store is wrong wherever it is reached from, and a rule that only looked
	// where one is expected would miss the one place nobody expected.
	for (const [, name] of deploy.matchAll(SECRET))
		if (NOT_SECRET.test(name as string))
			found.push(
				`deploy.yml: secrets.${name} grants nothing and belongs in env:`,
			);

	const steps = Object.values(doc.jobs ?? {}).flatMap((job) => job.steps ?? []);
	const ssh = steps.filter((step) => step.uses?.startsWith(`${SSH}@`));
	// Guards the loop under it: with no step opening a connection, every
	// assertion about how it is given one passes by having none.
	if (ssh.length !== 1)
		found.push(`deploy.yml: ${ssh.length} ${SSH} steps, expected one`);

	for (const step of ssh)
		for (const input of CONNECTION) {
			const value = step.with?.[input];
			// Compared whole: a value that merely *contains* a secret is one that
			// carries something beside it, and what is beside it is in the open.
			if (!value || !/^\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}$/.test(value))
				found.push(
					`deploy.yml: the connection's ${input} is ${value ? `\`${value}\`` : "absent"}, not a secret`,
				);
		}

	for (const [id, job] of Object.entries(doc.jobs ?? {}))
		if (
			JSON.stringify(job).includes("secrets.") &&
			job.environment !== "production"
		)
			found.push(
				`deploy.yml: job \`${id}\` reads a secret outside the production environment`,
			);

	return found;
}

// spec: deploy-workflow/a-non-secret-in-the-secret-store
describe("a value that grants nothing", () => {
	test("in env: passes", () => {
		expect(problems(hosted())).toEqual([]);
	});

	test.each(["REGISTRY", "IMAGE", "DOCKER_CONTAINER", "registry"])(
		"read from secrets.%s fails",
		(name) => {
			const stored = hosted().replace(
				`registry: \${{ env.REGISTRY }}`,
				`registry: ${secret(name)}`,
			);
			expect(problems(stored)).toEqual([
				`deploy.yml: secrets.${name} grants nothing and belongs in env:`,
			]);
		},
	);

	test.each(OPEN)("dropped from env: entirely, %s fails", (name) => {
		const gone = hosted().replace(new RegExp(`^  ${name}: .*\n`, "m"), "");
		expect(problems(gone)).toEqual([
			`deploy.yml: ${name} is not in env:, so it is written nowhere`,
		]);
	});
});

// spec: deploy-workflow/the-host-s-address-in-a-public-repository
describe("a value that does grant something", () => {
	test("a second step opening a connection fails", () => {
		const twice = hosted();
		const doubled = twice + twice.slice(twice.indexOf(`      - uses: ${SSH}@`));
		expect(problems(doubled)).toContainEqual(
			`deploy.yml: 2 ${SSH} steps, expected one`,
		);
	});

	test.each(CONNECTION)("%s written in the open fails", (input) => {
		const open = hosted({
			inputs: Object.fromEntries(
				CONNECTION.map((name) => [
					name,
					name === input ? "d2ass.laidrivm.com" : secret(`SSH_${name}`),
				]),
			),
		});
		expect(problems(open)).toContainEqual(
			`deploy.yml: the connection's ${input} is \`d2ass.laidrivm.com\`, not a secret`,
		);
	});

	test("a fallback written beside the secret fails", () => {
		// A whole-value comparison, not a search. The fallback is the reason:
		// `22` in the open is the default this machine deliberately does not
		// listen on, and the line reads almost the same as the correct one.
		const fallback = `\${{ secrets.SSH_PORT || 22 }}`;
		const beside = hosted({
			inputs: {
				host: secret("SSH_HOST"),
				port: fallback,
				username: secret("SSH_USER"),
				key: secret("SSH_KEY"),
			},
		});
		expect(problems(beside)).toEqual([
			`deploy.yml: the connection's port is \`${fallback}\`, not a secret`,
		]);
	});

	test("every name the requirement lists is one the workflow reads", () => {
		const read = new Set(
			[...hosted().matchAll(SECRET)].map(([, name]) => name as string),
		);
		expect([...read].sort()).toEqual([...SECRETS].sort());
	});
});

// spec: deploy-workflow/a-deploy-from-a-branch-that-is-not-the-default
describe("what stands between a run and the credentials", () => {
	test("a job reading a secret outside the production environment fails", () => {
		const ungated = hosted({ environment: "" });
		expect(problems(ungated)).toEqual([
			"deploy.yml: job `image` reads a secret outside the production environment",
			"deploy.yml: job `host` reads a secret outside the production environment",
		]);
	});

	test("another environment does not stand in for it", () => {
		const staging = hosted({ environment: "    environment: staging" });
		expect(problems(staging)).toHaveLength(2);
	});
});

// spec: deploy-workflow/a-non-secret-in-the-secret-store
test("this repository passes", () => {
	expect(problems(deployed().workflow)).toEqual([]);
});
