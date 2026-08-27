/**
 * What a check workflow has to be for the deploy's dependency on it to mean
 * anything.
 *
 * Three properties, and each fails silently in a way the gate itself cannot
 * see. Without `workflow_call:` the dependency cannot be written at all. With
 * the trigger but without `pull_request:`, the deploy is gated and every pull
 * request is not — the check moves from before the merge to after it and the
 * gate file reads exactly the same. And two called workflows sharing a
 * concurrency group cancel each other: in a called workflow `github.workflow`
 * is the *caller's* name, so that spelling collapses all three into one group
 * and `cancel-in-progress` leaves two gates cancelled — which fails the
 * `needs:` that was gating on them, so a deploy that never runs is the mildest
 * shape this takes.
 */
import { describe, expect, test } from "bun:test";
import {
	check,
	checks,
	JOBS,
	ownersOf,
	parse,
	repository,
	triggersOf,
} from "./deploy-workflow.fixture.ts";

/** Everything wrong with the called workflows, empty when nothing is. */
export function problems(files: Record<string, string>): string[] {
	const docs = parse(files);
	const { owners, problems: found } = ownersOf(docs);

	/**
	 * The group each called workflow holds, keyed by the normalised form and
	 * carrying the spelling the file used, which is what a reader has to find.
	 */
	const groups = new Map<string, { raw: string; sharing: string[] }>();

	for (const [name, owned] of owners) {
		const which = owned.join(" and ");
		const doc = docs.get(name);
		const triggers = doc ? triggersOf(doc) : new Set<string>();
		for (const trigger of ["workflow_call", "pull_request"])
			if (!triggers.has(trigger))
				found.push(
					`${name}: the ${which}'s workflow does not run on ${trigger}`,
				);
		// Lowercased before it is compared: GitHub states the group name is case
		// insensitive, so `Deploy-…` and `deploy-…` are one group and a raw key
		// would miss exactly the collision this exists to catch.
		const group = doc?.concurrency?.group?.toLowerCase();
		// Required so the comparison below is a comparison: two workflows
		// declaring none would otherwise read as two that agree.
		if (!group)
			found.push(`${name}: the ${which}'s workflow declares no group`);
		else {
			const seen = groups.get(group);
			groups.set(group, {
				raw: seen?.raw ?? (doc?.concurrency?.group as string),
				sharing: [...(seen?.sharing ?? []), name],
			});
		}
	}

	for (const { raw, sharing } of groups.values())
		if (sharing.length > 1)
			found.push(
				`${sharing.join(", ")}: share the concurrency group \`${raw}\`, so a deploy calling them cancels all but one`,
			);

	return found;
}

// spec: deploy-workflow/a-check-the-deploy-cannot-depend-on
describe("a workflow the deploy calls", () => {
	test("callable, triggered on pull requests and grouped alone passes", () => {
		expect(problems(checks())).toEqual([]);
	});

	test.each([
		["a single event written as a scalar", "workflow_call"],
		["several written as a sequence", ["pull_request", "workflow_call"]],
	])("passes with %s", (_what, on) => {
		// Both are what GitHub accepts and neither is a mapping: a membership
		// test against the raw value throws on the first and reads array indexes
		// on the second, so a file declaring every trigger reports none.
		const written = { ...checks(), "e2e.yml": check("e2e.yml", { on }) };
		const expected =
			typeof on === "string"
				? [
						"e2e.yml: the end-to-end suite's workflow does not run on pull_request",
					]
				: [];
		expect(problems(written)).toEqual(expected);
	});

	test.each(["workflow_call", "pull_request"])(
		"fails when it does not run on %s",
		(dropped) => {
			const on =
				dropped === "workflow_call"
					? { pull_request: null }
					: { workflow_call: null };
			const missing = { ...checks(), "e2e.yml": check("e2e.yml", { on }) };
			expect(problems(missing)).toEqual([
				`e2e.yml: the end-to-end suite's workflow does not run on ${dropped}`,
			]);
		},
	);
});

// spec: deploy-workflow/a-commit-whose-checks-fail
describe("the concurrency group a called workflow holds", () => {
	test("two workflows sharing one fails", () => {
		// What `${{ github.workflow }}` resolves to in every one of them: the
		// caller's name, which is one string for all three. Assembled rather
		// than written plain, a `${{` in a quoted string being a placeholder the
		// linter warns about — the warning would be about this file's own text.
		const group = `Deploy-\${{ github.ref }}`;
		const shared = Object.fromEntries(
			Object.keys(JOBS).map((name) => [name, check(name, { group })]),
		);
		expect(problems(shared)).toEqual([
			`lint.yml, test.yml, e2e.yml: share the concurrency group \`${group}\`, so a deploy calling them cancels all but one`,
		]);
	});

	test("two whose groups differ only in case fails", () => {
		// GitHub states the group name is case insensitive, so these are one
		// group and one of the two gates gets cancelled.
		const mixed = {
			...checks(),
			"test.yml": check("test.yml", { group: "Shared" }),
			"e2e.yml": check("e2e.yml", { group: "shared" }),
		};
		expect(problems(mixed)).toEqual([
			"test.yml, e2e.yml: share the concurrency group `Shared`, so a deploy calling them cancels all but one",
		]);
	});

	test("a workflow declaring none fails", () => {
		const bare = { ...checks(), "e2e.yml": check("e2e.yml", { group: null }) };
		expect(problems(bare)).toEqual([
			"e2e.yml: the end-to-end suite's workflow declares no group",
		]);
	});
});

// spec: deploy-workflow/a-check-the-deploy-cannot-depend-on
test("this repository passes", () => {
	expect(problems(repository())).toEqual([]);
});
