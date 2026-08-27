/**
 * What a build pushes, what the host is then told to run, and whether the way
 * back is written down.
 *
 * The three are one subject. `latest` exists so a reader can see which build
 * is newest; the SHA exists so the machine itself answers which commit is
 * serving, so that two deploys close together cannot race for a name and a
 * rollback is a change of one value. Push only `latest` and the second
 * question has no answer; run `latest` on the host and it has a different
 * answer every pull; push both and write neither down, and the rollback is
 * performed from memory under pressure.
 *
 * The host half is vacuous until Task 5.5 adds the steps that reach the
 * machine — there is no `D2ASS_IMAGE` in the workflow to be wrong yet. The
 * fixtures below exercise it both ways regardless, which is what makes it a
 * rule rather than a hope, and 5.1 is where the real file gains a host step
 * for it to read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The repository root: this file reads artefacts of it, from `checks/`. */
const root = join(import.meta.dir, "..");

/** The action that builds and pushes, named without its pin. */
const BUILDER = "docker/build-push-action";

/** What the compose project resolves the image from, on the host and here. */
const REFERENCE = "D2ASS_IMAGE";

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

/**
 * The commit the run is for, as GitHub spells it inside a tag.
 *
 * Escaped in a template literal rather than written plain: `${{` in a quoted
 * string is a template placeholder the linter warns about, and the warning is
 * about this file's own text rather than about anything it checks.
 */
const SHA = `\${{ github.sha }}`;

/** What a tag names, which is everything after the repository's own colon. */
const referenceOf = (tag: string) => tag.slice(tag.lastIndexOf(":") + 1);

/** Everything wrong with the three, and an empty list when nothing is. */
export function problems(deploy: string, readme: string): string[] {
	const found: string[] = [];
	const doc = (Bun.YAML.parse(deploy) ?? {}) as Workflow;

	const pushing = Object.values(doc.jobs ?? {})
		.flatMap((job) => job.steps ?? [])
		.filter((step) => step.uses?.startsWith(BUILDER));
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
	}

	// One passage, not three mentions scattered through the file: a rollback
	// named in one place and its command in another is a procedure the reader
	// has to assemble while the site is down.
	const named = readme
		.split(/\n\s*\n/)
		.some(
			(block) =>
				/roll ?back/i.test(block) &&
				block.includes(REFERENCE) &&
				block.includes("docker compose"),
		);
	if (!named)
		found.push(
			`README: no passage names the rollback with both ${REFERENCE} and the command`,
		);

	return found;
}

/** The two tags a build is meant to push. */
const TAGS = ["laidrivm/d2ass:latest", `laidrivm/d2ass:${SHA}`];

/**
 * A deploy workflow, written out rather than serialised: this check reads
 * `D2ASS_IMAGE` line by line, and `Bun.YAML.stringify` emits one flow-style
 * line for the whole document, which would put every value on the same line as
 * every other.
 */
const workflow = ({
	builder = BUILDER,
	push = "true",
	tags = TAGS,
	copies = 1,
	script = "",
} = {}) =>
	`jobs:
  deploy:
    steps:
${Array.from(
	{ length: copies },
	() => `      - uses: ${builder}@${"a".repeat(40)} # v6.20.0
        with:
          push: ${push}
          tags: |
${tags.map((tag) => `            ${tag}`).join("\n")}`,
).join("\n")}
${script ? `      - uses: appleboy/ssh-action@${"b".repeat(40)} # v1.2.5\n        with:\n          script: ${script}\n` : ""}`;

/** A README this check has nothing to say about. */
const README = `# d2ass

Some other section.

Roll back by setting ${REFERENCE} to the previous commit's SHA tag, then
docker compose pull && docker compose up -d.
`;

// spec: deploy-workflow/a-deploy-completes
describe("the tags a build pushes", () => {
	test("both of them passes", () => {
		expect(problems(workflow(), README)).toEqual([]);
	});

	test.each([
		["latest", [TAGS[1] as string], "no `latest`"],
		["the commit SHA", [TAGS[0] as string], "no commit SHA"],
	])("without %s fails", (_what, tags, message) => {
		expect(problems(workflow({ tags }), README)).toEqual([
			`deploy.yml: ${message} among the tags pushed`,
		]);
	});

	test("a comma-separated list reads the same", () => {
		expect(problems(workflow({ tags: [TAGS.join(",")] }), README)).toEqual([]);
	});

	test("a build that pushes nothing fails", () => {
		expect(problems(workflow({ push: "false" }), README)).toEqual([
			"deploy.yml: the build step does not push",
		]);
	});

	test.each([
		["no build step at all", { builder: "actions/checkout" }, 0],
		["a second build step", { copies: 2 }, 2],
	])("a workflow with %s fails", (_what, over, count) => {
		expect(problems(workflow(over), README)).toEqual([
			`deploy.yml: ${count} ${BUILDER} steps, expected one`,
		]);
	});

	test("a build step carrying no tags at all reports both", () => {
		expect(problems(workflow({ tags: [] }), README)).toEqual([
			"deploy.yml: no `latest` among the tags pushed",
			"deploy.yml: no commit SHA among the tags pushed",
		]);
	});
});

// spec: deploy-workflow/the-image-the-host-is-running
describe("the reference handed to the host", () => {
	const host = (value: string) =>
		workflow({ script: `${REFERENCE}=${value} docker compose up -d` });

	test("the commit's SHA tag passes", () => {
		expect(problems(host(TAGS[1] as string), README)).toEqual([]);
	});

	test.each([
		[TAGS[0] as string, "is handed `latest`"],
		["laidrivm/d2ass:v2", "is handed no commit SHA"],
	])("%s fails", (value, message) => {
		expect(problems(host(value), README)).toEqual([
			`deploy.yml: ${REFERENCE} ${message}: script: ${REFERENCE}=${value} docker compose up -d`,
		]);
	});

	test("a line naming the SHA and falling back to `latest` fails", () => {
		// The stricter reading wins: a fallback is a path on which the host runs
		// a mutable tag, and it is the path taken exactly when something has
		// already gone wrong.
		const both = `${TAGS[1] as string} || ${REFERENCE}=${TAGS[0] as string}`;
		expect(problems(host(both), README)).toEqual([
			`deploy.yml: ${REFERENCE} is handed \`latest\`: script: ${REFERENCE}=${both} docker compose up -d`,
		]);
	});
});

// spec: deploy-workflow/a-release-that-has-to-be-undone
describe("the rollback in the README", () => {
	const message = `README: no passage names the rollback with both ${REFERENCE} and the command`;

	test("a passage naming neither the value nor the command fails", () => {
		const vague = "# d2ass\n\nA bad release can be rolled back.\n";
		expect(problems(workflow(), vague)).toEqual([message]);
	});

	test("the two spread across separate passages fails", () => {
		const split = `# d2ass\n\nRoll back if a release is bad.\n\n${REFERENCE} names the image; docker compose up -d.\n`;
		expect(problems(workflow(), split)).toEqual([message]);
	});
});

// spec: deploy-workflow/a-deploy-completes
test("this repository passes", () => {
	expect(
		problems(
			readFileSync(`${root}/.github/workflows/deploy.yml`, "utf8"),
			readFileSync(`${root}/README.md`, "utf8"),
		),
	).toEqual([]);
});
