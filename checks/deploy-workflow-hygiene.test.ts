/**
 * The hygiene the other six workflows already practise, written down for the
 * one that holds a deploy key.
 *
 * None of it is new practice and none of it is uniform: measured over the
 * workflows in this repository, every one pins its actions by SHA with a
 * version comment and declares `permissions:`, five of six declare a
 * concurrency group, and the one that reads `github.event.*` passes it through
 * `env:`. It is checked here because it is practised and stated nowhere — no
 * rule, no criterion — and because this workflow is the one that can reach the
 * machine.
 *
 * Deliberately this workflow alone. Holding every workflow in the tree to the
 * same criteria is worth doing and needs a home that is not a capability about
 * deploying.
 *
 * The pins are read off the file's lines rather than through the parse: the
 * version beside a SHA is a YAML comment, and a parse throws it away — which
 * is exactly the half a reader needs to know how far behind a pin has fallen.
 */
import { describe, expect, test } from "bun:test";
import { hosted, SSH } from "./deploy-host.fixture.ts";
import { deployed } from "./deploy-workflow.fixture.ts";

/** A `uses:` line, with whatever follows the reference on it. */
const USES = /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/;

/** A reference pinned the way this repository pins one. */
const PINNED = /^[^@\s]+@[0-9a-f]{40}$/;

/** The version beside a pin, which is what says how old it is. */
const VERSION = /^\s*#\s*v\S+/;

/** An expression reaching a value an outsider can choose the text of. */
const EVENT = /\$\{\{[^}]*github\.event\b/;

type Workflow = {
	permissions?: string | Record<string, string>;
	concurrency?: { group?: string };
	jobs?: Record<string, { steps?: { run?: string }[] }>;
};

/** Everything wrong with the workflow's hygiene, and nothing when nothing is. */
export function problems(deploy: string): string[] {
	const found: string[] = [];
	const doc = (Bun.YAML.parse(deploy) ?? {}) as Workflow;

	let pins = 0;
	for (const line of deploy.split(/\r\n|\n|\r/)) {
		const uses = USES.exec(line);
		if (!uses) continue;
		const [, reference = "", rest = ""] = uses;
		// The one exemption, and it is not a pin that was skipped: a workflow in
		// this repository is called by path and has no ref to pin at all.
		if (reference.startsWith("./")) continue;
		pins++;
		if (!PINNED.test(reference))
			found.push(`deploy.yml: ${reference} is not pinned by commit SHA`);
		else if (!VERSION.test(rest))
			found.push(`deploy.yml: ${reference} carries no version beside it`);
	}
	// Guards the loop: a file naming no action at all satisfies every assertion
	// in it, and this workflow cannot do its job without naming several.
	if (pins === 0) found.push("deploy.yml: no pinned action at all");

	// A mapping, never a string. `write-all` and `read-all` are the two strings
	// GitHub accepts here, and both grant scopes this workflow does not use.
	const permissions = doc.permissions;
	if (typeof permissions !== "object" || permissions === null)
		found.push(
			`deploy.yml: permissions is ${permissions === undefined ? "absent" : `\`${permissions}\``}, not a set of scopes`,
		);
	else
		for (const [scope, granted] of Object.entries(permissions))
			if (granted !== "read" && granted !== "none")
				found.push(`deploy.yml: permissions grants ${scope}: ${granted}`);

	if (!doc.concurrency?.group)
		found.push("deploy.yml: no concurrency group, so two deploys can overlap");

	for (const job of Object.values(doc.jobs ?? {}))
		for (const step of job.steps ?? [])
			if (step.run && EVENT.test(step.run))
				found.push(
					`deploy.yml: a run: block interpolates an event value: ${step.run.trim()}`,
				);

	return found;
}

// spec: deploy-workflow/an-action-pinned-by-tag
describe("how an action is named", () => {
	test("a full commit SHA with the version beside it passes", () => {
		expect(problems(hosted())).toEqual([]);
	});

	test.each([
		[`${SSH}@v1.2.5`, "a tag"],
		[`${SSH}@master`, "a branch"],
		[`${SSH}@${"b".repeat(39)}`, "a SHA one character short"],
	])("%s fails — %s", (pin) => {
		expect(problems(hosted({ pin }))).toEqual([
			`deploy.yml: ${pin} is not pinned by commit SHA`,
		]);
	});

	test("a workflow naming no action at all fails", () => {
		const bare = hosted().replace(/^\s*(- )?uses: .*$/gm, "      - run: true");
		expect(problems(bare)).toContainEqual(
			"deploy.yml: no pinned action at all",
		);
	});
});

// spec: deploy-workflow/a-pin-with-no-version-beside-it
describe("a pin with nothing beside it", () => {
	test.each([
		["nothing at all", ""],
		["a comment that is not a version", " # ssh"],
	])("fails with %s", (_what, beside) => {
		const pin = `${SSH}@${"b".repeat(40)}${beside}`;
		expect(problems(hosted({ pin }))).toEqual([
			`deploy.yml: ${SSH}@${"b".repeat(40)} carries no version beside it`,
		]);
	});
});

// spec: deploy-workflow/the-permissions-the-workflow-takes
describe("the permissions the workflow takes", () => {
	test.each([
		[
			"write-all",
			"deploy.yml: permissions is `write-all`, not a set of scopes",
		],
		["read-all", "deploy.yml: permissions is `read-all`, not a set of scopes"],
	])("%s fails", (widened, message) => {
		const wide = hosted({ permissions: "" }).replace(
			"permissions:\n",
			`permissions: ${widened}\n`,
		);
		expect(problems(wide)).toEqual([message]);
	});

	test("a scope granted write fails", () => {
		const write = hosted({
			permissions: "  contents: read\n  packages: write",
		});
		expect(problems(write)).toEqual([
			"deploy.yml: permissions grants packages: write",
		]);
	});

	test("a scope granted none passes beside a read one", () => {
		const narrow = hosted({ permissions: "  contents: read\n  actions: none" });
		expect(problems(narrow)).toEqual([]);
	});
});

describe("two deploys at once", () => {
	test("a workflow declaring no concurrency group fails", () => {
		const overlapping = hosted({ concurrency: "  cancel-in-progress: false" });
		expect(problems(overlapping)).toEqual([
			"deploy.yml: no concurrency group, so two deploys can overlap",
		]);
	});
});

// spec: deploy-workflow/an-event-value-reaching-a-shell
describe("an event value reaching a shell", () => {
	test("interpolated into a run: block, it fails", () => {
		const run = `echo "\${{ github.event.pull_request.title }}"`;
		expect(problems(hosted({ run }))).toEqual([
			`deploy.yml: a run: block interpolates an event value: ${run}`,
		]);
	});

	test("read through env: instead, it passes", () => {
		// The same value, and the difference is the whole rule: a branch or a
		// title carrying shell metacharacters becomes shell in the first form and
		// stays a string in this one.
		const through = hosted().replace(
			"  host:\n",
			`  event:\n    runs-on: ubuntu-latest\n    env:\n      TITLE: \${{ github.event.head_commit.message }}\n    steps:\n      - run: echo "$TITLE"\n\n  host:\n`,
		);
		expect(problems(through)).toEqual([]);
	});
});

// spec: deploy-workflow/an-action-pinned-by-tag
test("this repository passes", () => {
	expect(problems(deployed().workflow)).toEqual([]);
});
