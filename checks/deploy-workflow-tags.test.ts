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
 * The host half is vacuous until Task 5.5 adds the steps that reach the
 * machine — there is no `D2ASS_IMAGE` in the workflow to be wrong yet. The
 * fixtures below exercise it both ways regardless, which is what makes it a
 * rule rather than a hope, and 5.1 is where the real file gains a host step
 * for it to read.
 */
import { describe, expect, test } from "bun:test";
import {
	BUILDER,
	built,
	deployed,
	imageOf,
	names,
	REFERENCE,
	SHA,
	TAGS,
} from "./deploy-workflow.fixture.ts";

type Step = {
	uses?: string;
	with?: { tags?: string | string[]; push?: boolean | string };
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
		const references = tagsOf(step).map(referenceOf);
		if (!references.includes("latest"))
			found.push("deploy.yml: no `latest` among the tags pushed");
		if (!references.includes(SHA))
			found.push("deploy.yml: no commit SHA among the tags pushed");
	}

	const image = imageOf(deploy);
	if (!image)
		found.push("deploy.yml: no IMAGE in env, so nothing names what is pushed");

	for (const line of deploy.split(/\r\n|\n|\r/)) {
		if (!line.includes(REFERENCE)) continue;
		// Read line by line rather than through the parse: the reference reaches
		// the host inside a shell script, an `env:` value or an action's `script`
		// block depending on how 5.5 writes it, and a rule that has to be moved
		// when that is decided is a rule that will not be.
		if (line.includes("latest"))
			found.push(
				`deploy.yml: ${REFERENCE} is handed \`latest\`: ${line.trim()}`,
			);
		else if (!line.includes("github.sha"))
			found.push(
				`deploy.yml: ${REFERENCE} is handed no commit SHA: ${line.trim()}`,
			);
		// The whole reference, bounded, not the two halves separately. Each half
		// on its own reads as correct while the pair names something the run
		// never pushed: `someone-else/d2ass:${{ github.sha }}` carries this
		// commit and another repository, and `laidrivm/d2ass:${{ github.sha
		// }}-debug` carries this repository and another tag.
		else if (image && !names(line, `${image}:${SHA}`))
			found.push(
				`deploy.yml: ${REFERENCE} is not ${image}:${SHA}: ${line.trim()}`,
			);
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
	const host = (value: string) =>
		built({ script: `${REFERENCE}=${value} docker compose up -d` });
	const said = (value: string) =>
		`script: ${REFERENCE}=${value} docker compose up -d`;

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
