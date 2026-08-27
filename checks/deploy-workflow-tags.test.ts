/**
 * What a build pushes, and what the host is then told to run.
 *
 * One subject in two halves. `latest` exists so a reader can see which build is
 * newest; the SHA exists so the machine itself answers which commit is serving,
 * so that two deploys close together cannot race for a name and a rollback is a
 * change of one value. Push only `latest` and the second question has no
 * answer; run `latest` on the host and it has a different answer every pull.
 * Whether the way back is written down is
 * `checks/deploy-workflow-rollback.test.ts`.
 *
 * The host half reads the line that *gives* the reference a value, not every
 * line naming it: the action is also told which variables to forward, and
 * `envs: D2ASS_IMAGE` names the reference while saying nothing about what it
 * holds. What the line says is resolved through the workflow's own `env:`
 * first, since what is written there is `${{ env.IMAGE }}` rather than the
 * repository's name.
 */
import { describe, expect, test } from "bun:test";
import { SSH } from "./deploy-host.fixture.ts";
import {
	BUILDER,
	built,
	envOf,
	imageOf,
	names,
	REFERENCE,
	resolve,
	SHA,
	TAGS,
} from "./deploy-tags.fixture.ts";
import { deployed } from "./deploy-workflow.fixture.ts";

type Step = {
	uses?: string;
	env?: Record<string, string>;
	with?: { tags?: string | string[]; push?: boolean | string; envs?: string };
};
type Workflow = { jobs?: Record<string, { steps?: Step[] }> };

/** The tag list as the action reads it: newlines or commas, either way. */
const tagsOf = (step: Step) =>
	(Array.isArray(step.with?.tags) ? step.with.tags : [step.with?.tags ?? ""])
		.flatMap((line) => String(line).split(/[\n,]/))
		.map((tag) => tag.trim())
		.filter(Boolean);

/** What a tag names, which is everything after the repository's own colon. */
const referenceOf = (tag: string) => tag.slice(tag.lastIndexOf(":") + 1);

/** Everything wrong with the two, and an empty list when nothing is. */
export function problems(deploy: string): string[] {
	const found: string[] = [];
	const doc = (Bun.YAML.parse(deploy) ?? {}) as Workflow;

	const image = imageOf(deploy);
	if (!image)
		found.push("deploy.yml: no IMAGE in env, so nothing names what is pushed");

	const pushing = Object.values(doc.jobs ?? {})
		.flatMap((job) => job.steps ?? [])
		// The `@` is part of the boundary: without it `docker/build-push-actions`
		// or any other name this one is a prefix of would be read as the builder,
		// and every assertion below would then be about the wrong step.
		.filter((step) => step.uses?.startsWith(`${BUILDER}@`));
	// Guards the two assertions under it, both of which are about the tags a
	// push carries: with no pushing step they would pass by having none.
	if (pushing.length !== 1)
		found.push(`deploy.yml: ${pushing.length} ${BUILDER} steps, expected one`);

	for (const step of pushing) {
		// A build that is not a push leaves the registry holding neither tag,
		// and the step reads identically but for this one word.
		if (step.with?.push !== true && step.with?.push !== "true")
			found.push("deploy.yml: the build step does not push");
		const tags = tagsOf(step).map((tag) => resolve(tag, envOf(deploy)));
		const references = tags.map(referenceOf);
		if (!references.includes("latest"))
			found.push("deploy.yml: no `latest` among the tags pushed");
		if (!references.includes(SHA))
			found.push("deploy.yml: no commit SHA among the tags pushed");
		// The repository as well as the reference: a pair of tags on
		// `other/repository` carries both `latest` and this commit and satisfies
		// the two assertions above while pushing nothing this deploy owns.
		// Compared whole rather than by prefix, so `laidrivm/d2ass-old` is not
		// this repository.
		for (const tag of tags)
			if (image && tag.slice(0, tag.lastIndexOf(":")) !== image)
				found.push(`deploy.yml: pushes ${tag}, which is not ${image}`);
	}

	// What the host is actually handed, read through the parse and from nowhere
	// else. A line that looks like an assignment is not one: `echo
	// D2ASS_IMAGE=…:latest` inside the script sets nothing the host receives,
	// and a text scan reads it as both a value that exists and a wrong one.
	const opening = Object.values(doc.jobs ?? {})
		.flatMap((job) => job.steps ?? [])
		.filter((step) => step.uses?.startsWith(`${SSH}@`));
	if (opening.length === 0)
		found.push(`deploy.yml: nothing hands the host a ${REFERENCE}`);

	for (const step of opening) {
		const written = step.env?.[REFERENCE];
		if (!written) {
			found.push(`deploy.yml: the host step declares no ${REFERENCE}`);
			continue;
		}
		// Declared and never forwarded is the same absence wearing a value.
		if (
			!String(step.with?.envs ?? "")
				.split(/[\s,]+/)
				.includes(REFERENCE)
		)
			found.push(`deploy.yml: ${REFERENCE} is declared but never forwarded`);
		// Resolved through the workflow's own `env:`, since what is written
		// there is `${{ env.IMAGE }}` and not the repository's name.
		const value = resolve(written, envOf(deploy));
		if (value.includes("latest"))
			found.push(`deploy.yml: ${REFERENCE} is handed \`latest\`: ${written}`);
		else if (!value.includes("github.sha"))
			found.push(
				`deploy.yml: ${REFERENCE} is handed no commit SHA: ${written}`,
			);
		// The whole reference, bounded, not the two halves separately. Each half
		// on its own reads as correct while the pair names something the run
		// never pushed: `someone-else/d2ass:${{ github.sha }}` carries this
		// commit and another repository, and `laidrivm/d2ass:${{ github.sha
		// }}-debug` carries this repository and another tag.
		else if (image && !names(value, `${image}:${SHA}`))
			found.push(`deploy.yml: ${REFERENCE} is not ${image}:${SHA}: ${written}`);
	}

	return found;
}

// spec: deploy-workflow/a-deploy-completes
describe("the tags a build pushes", () => {
	test("both of them passes", () => {
		expect(problems(built())).toEqual([]);
	});

	test.each([
		["latest", [TAGS[1] as string], "no `latest`"],
		["the commit SHA", [TAGS[0] as string], "no commit SHA"],
	])("without %s fails", (_what, tags, message) => {
		expect(problems(built({ tags }))).toEqual([
			`deploy.yml: ${message} among the tags pushed`,
		]);
	});

	test("a comma-separated list reads the same", () => {
		expect(problems(built({ tags: [TAGS.join(",")] }))).toEqual([]);
	});

	test("a build that pushes nothing fails", () => {
		expect(problems(built({ push: "false" }))).toEqual([
			"deploy.yml: the build step does not push",
		]);
	});

	test.each([
		["no build step at all", { builder: "actions/checkout" }, 0],
		[
			"only an action this one's name is a prefix of",
			{ builder: `${BUILDER}s` },
			0,
		],
		["a second build step", { copies: 2 }, 2],
	])("a workflow with %s fails", (_what, over, count) => {
		expect(problems(built(over))).toEqual([
			`deploy.yml: ${count} ${BUILDER} steps, expected one`,
		]);
	});

	test("tags on another repository fail, both of them", () => {
		// Both carry the right reference, so the two assertions above pass and
		// the registry gets an image this deploy does not own.
		const tags = ["other/repository:latest", `other/repository:${SHA}`];
		expect(problems(built({ tags }))).toEqual([
			"deploy.yml: pushes other/repository:latest, which is not laidrivm/d2ass",
			`deploy.yml: pushes other/repository:${SHA}, which is not laidrivm/d2ass`,
		]);
	});

	test("a tag on a repository this one's name is a prefix of fails", () => {
		const tags = [TAGS[0] as string, `laidrivm/d2ass-old:${SHA}`];
		expect(problems(built({ tags }))).toEqual([
			`deploy.yml: pushes laidrivm/d2ass-old:${SHA}, which is not laidrivm/d2ass`,
		]);
	});

	test("a build step carrying no tags at all reports both", () => {
		expect(problems(built({ tags: [] }))).toEqual([
			"deploy.yml: no `latest` among the tags pushed",
			"deploy.yml: no commit SHA among the tags pushed",
		]);
	});

	test("a workflow naming no image at all fails", () => {
		const nameless = built().replace("env:\n  IMAGE: laidrivm/d2ass\n", "");
		expect(problems(nameless)).toEqual([
			"deploy.yml: no IMAGE in env, so nothing names what is pushed",
		]);
	});
});

// spec: deploy-workflow/the-image-the-host-is-running
describe("the reference handed to the host", () => {
	const host = (value: string) => built({ reference: value });
	const said = (value: string) => value;

	test("the commit's SHA tag passes", () => {
		expect(problems(host(TAGS[1] as string))).toEqual([]);
	});

	test.each([
		[TAGS[0] as string, "is handed `latest`"],
		["laidrivm/d2ass:v2", "is handed no commit SHA"],
		[`someone-else/d2ass:${SHA}`, `is not laidrivm/d2ass:${SHA}`],
		[`${TAGS[1] as string}-debug`, `is not laidrivm/d2ass:${SHA}`],
	])("%s fails", (value, message) => {
		// The last two are the ones a reader would pass: each carries this run's
		// commit, and neither names a reference this run pushed.
		expect(problems(host(value))).toEqual([
			`deploy.yml: ${REFERENCE} ${message}: ${said(value)}`,
		]);
	});

	test("an echoed value beside a correct one is not read at all", () => {
		// The script can say anything; what the host is handed is the step's
		// `env:`. Scanning the text reads this as a second, wrong value.
		const echoed = built().replace(
			"            docker compose pull",
			`            echo ${REFERENCE}=laidrivm/d2ass:latest`,
		);
		expect(problems(echoed)).toEqual([]);
	});

	test("a script line that merely looks like an assignment is not one", () => {
		// `echo D2ASS_IMAGE=…` sets nothing the host receives. Read as text it
		// counts, and the step forwarding no value at all reports green.
		const echoed = built()
			.replace(
				new RegExp(`^\\s*${REFERENCE}: .*$`, "m"),
				"          UNRELATED: 1",
			)
			.replace(
				"            docker compose pull",
				`            echo ${REFERENCE}=laidrivm/d2ass:${SHA}`,
			);
		expect(problems(echoed)).toEqual([
			`deploy.yml: the host step declares no ${REFERENCE}`,
		]);
	});

	test("a value declared but never forwarded fails", () => {
		const kept = built().replace(`          envs: ${REFERENCE}\n`, "");
		expect(problems(kept)).toEqual([
			`deploy.yml: ${REFERENCE} is declared but never forwarded`,
		]);
	});

	test("a line naming the SHA and falling back to `latest` fails", () => {
		// The stricter reading wins: a fallback is a path on which the host runs
		// a mutable tag, and it is the path taken exactly when something has
		// already gone wrong.
		const both = `${TAGS[1] as string} || ${REFERENCE}=${TAGS[0] as string}`;
		expect(problems(host(both))).toEqual([
			`deploy.yml: ${REFERENCE} is handed \`latest\`: ${said(both)}`,
		]);
	});
});

// spec: deploy-workflow/a-deploy-completes
test("this repository passes", () => {
	expect(problems(deployed().workflow)).toEqual([]);
});
