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

/** The action that builds and pushes, named without its pin. */
export const BUILDER = "docker/build-push-action";

/** What the compose project resolves the image from, on the host and here. */
export const REFERENCE = "D2ASS_IMAGE";

/**
 * The commit the run is for, as GitHub spells it inside a tag.
 *
 * Escaped in a template literal rather than written plain: `${{` in a quoted
 * string is a template placeholder the linter warns about, and the warning is
 * about this file's own text rather than about anything it checks.
 */
export const SHA = `\${{ github.sha }}`;

/**
 * Whether `text` names `image` as a whole reference rather than as the start
 * of another one.
 *
 * `laidrivm/d2ass-old` contains `laidrivm/d2ass`, and a substring test would
 * read a README left behind by a rename as one that had followed it. Bounded
 * on both sides by the characters a repository name is made of, so the `:`
 * before a tag still counts as the end of one.
 */
export const names = (text: string, image: string) =>
	new RegExp(
		`(?<![\\w./-])${image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w./-])`,
	).test(text);

/**
 * The repository the workflow pushes to, read from it rather than written
 * anywhere a check could restate it: two copies of a name drift the moment
 * either is a value a file states itself.
 */
export const envOf = (deploy: string) =>
	((Bun.YAML.parse(deploy) ?? {}) as { env?: Record<string, string> }).env ??
	{};

export const imageOf = (deploy: string) => envOf(deploy).IMAGE;

/**
 * A tag with the workflow's own `env:` values put in.
 *
 * The real file writes `${{ env.IMAGE }}:latest`, so a tag compared as text
 * against the image would never match the one thing it must. Resolved from
 * what the workflow declares, not from anything restated here.
 */
export const resolve = (tag: string, env: Record<string, string>) =>
	tag.replace(
		/\$\{\{\s*env\.(\w+)\s*\}\}/g,
		(whole, name) => env[name] ?? whole,
	);

/** The two tags a build is meant to push. */
export const TAGS = ["laidrivm/d2ass:latest", `laidrivm/d2ass:${SHA}`];

/**
 * A deploy workflow, written out rather than serialised: the tag cases read
 * `D2ASS_IMAGE` line by line, and `Bun.YAML.stringify` emits one flow-style
 * line for the whole document, which would put every value on the same line as
 * every other.
 */
export const built = ({
	builder = BUILDER,
	push = "true",
	tags = TAGS,
	copies = 1,
	script = "",
} = {}) =>
	`env:
  IMAGE: laidrivm/d2ass
jobs:
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

/** A README the rollback cases have nothing to say about. */
export const ROLLBACK = `# d2ass

Some other section.

Roll back by setting ${REFERENCE} to laidrivm/d2ass at the previous commit's
SHA tag, then docker compose pull && docker compose up -d.
`;

/** The repository's own deploy workflow and README, as the real cases read them. */
export const deployed = () => ({
	workflow: readFileSync(`${root}/.github/workflows/deploy.yml`, "utf8"),
	readme: readFileSync(`${root}/README.md`, "utf8"),
});
