/**
 * The coverage check, exercised end to end: how a citation is read, and what
 * the sweep counts. The floor and what a change to it owes are in
 * `spec-coverage-floor.test.ts`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	cited,
	cleanup,
	emptyDir,
	fabricate,
	ids,
	problems,
	repo,
	spec,
	world,
} from "./spec-coverage.fixture.ts";
import { check, DECLARATION, FLOOR, gauge, uncited } from "./spec-coverage.ts";
import { counted } from "./spec-criteria.ts";

afterAll(cleanup);

// spec: spec-test-traceability/an-identifier-is-derived-from-a-heading
describe("an identifier is derived from a heading", () => {
	test("a heading becomes its capability and slug", () => {
		const dir = fabricate({
			"openspec/specs/draft-session/spec.md": spec(
				"Board is not an active context",
			),
		});
		expect(ids(counted(dir))).toEqual([
			"draft-session/board-is-not-an-active-context",
		]);
	});

	test("punctuation and a section mark collapse to single hyphens", () => {
		expect(ids(counted(repo))).toContain(
			"draft-model/insufficient-hero-picked-model-spec-7-5",
		);
	});

	test("a spec with no scenario heading yields no criteria", () => {
		const dir = fabricate({
			"openspec/specs/empty/spec.md": "# capability\n\nProse only.\n",
		});
		expect(counted(dir)).toEqual([]);
	});

	test("a scenario heading inside a fenced block is not a criterion", () => {
		const dir = fabricate({
			"openspec/specs/fenced/spec.md": `${spec("A real one")}\n\`\`\`md\n#### Scenario: An illustrated one\n\`\`\`\n`,
		});
		expect(ids(counted(dir))).toEqual(["fenced/a-real-one"]);
	});
});

// spec: spec-test-traceability/a-test-cites-one-criterion
describe("a test cites one criterion", () => {
	test("a citation above a test call marks its criterion", () => {
		const dir = world(
			'// spec: capability/a-first-thing\ntest("acts", () => {});\n',
			"A first thing",
			"A second thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});

	test("a citation above a test.each call counts", () => {
		const dir = world(
			'// spec: capability/a-first-thing\ntest.each([1])("acts %i", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});

	test("blank lines between the comment and the call do not break it", () => {
		const dir = world(
			'// spec: capability/a-first-thing\n\n\ndescribe("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});
});

// spec: spec-test-traceability/one-act-closes-several-criteria
describe("one act closes several criteria", () => {
	test("two identifiers on one line both count", () => {
		const dir = world(
			'// spec: capability/a-first-thing capability/a-second-thing\nit("acts", () => {});\n',
			"A first thing",
			"A second thing",
		);
		expect(cited(dir)).toEqual([
			"capability/a-first-thing",
			"capability/a-second-thing",
		]);
	});

	test("identifiers on consecutive comment lines all count", () => {
		const dir = world(
			'// spec: capability/a-first-thing\n//       capability/a-second-thing\ntest("acts", () => {});\n',
			"A first thing",
			"A second thing",
		);
		expect(cited(dir)).toEqual([
			"capability/a-first-thing",
			"capability/a-second-thing",
		]);
	});
});

// spec: spec-test-traceability/one-criterion-needs-several-tests
describe("one criterion needs several tests", () => {
	test("five tests citing one leave one criterion cited", () => {
		const one = '// spec: capability/a-first-thing\ntest("acts", () => {});\n';
		const dir = world(one.repeat(5), "A first thing", "A second thing");
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		const { criteria } = check(dir);
		expect(criteria.length - cited(dir).length).toBe(1);
	});
});

// spec: spec-test-traceability/a-citation-floating-in-a-file
describe("a citation floating in a file", () => {
	test("a statement between the comment and the call fails", () => {
		const dir = world(
			'// spec: capability/a-first-thing\nconst x = 1;\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(problems(dir).join("\n")).toContain("src/thing.test.ts:1");
	});

	test("a citation with no call after it at all fails", () => {
		const dir = world("// spec: capability/a-first-thing\n", "A first thing");
		expect(problems(dir).join("\n")).toContain("src/thing.test.ts:1");
	});
});

describe("what is not a citation", () => {
	test("a spec marker inside a string literal is ignored", () => {
		const dir = world(
			'const source = "// spec: capability/a-first-thing";\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual([]);
		expect(problems(dir)).toEqual([]);
	});

	test("a spec marker inside a multi-line block comment is ignored", () => {
		const dir = world(
			'/*\n// spec: capability/a-first-thing\n*/\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual([]);
		expect(problems(dir)).toEqual([]);
	});

	test("a spec marker inside a block comment is ignored", () => {
		const dir = world(
			'/* // spec: capability/a-first-thing */\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual([]);
		expect(problems(dir)).toEqual([]);
	});

	test("a string literal holding a comment opener blinds nothing below it", () => {
		const dir = world(
			'const opener = "/*";\n// spec: capability/a-first-thing\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});

	test("a block comment between a citation and its call separates them", () => {
		const dir = world(
			'// spec: capability/a-first-thing\n/* note\ntext */\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});

	test("a citation naming no identifier fails", () => {
		const dir = world('// spec:\ntest("acts", () => {});\n', "A first thing");
		expect(problems(dir).join("\n")).toContain("src/thing.test.ts:1");
	});

	test("an identifier without its capability fails", () => {
		const dir = world(
			'// spec: a-first-thing\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(problems(dir).join("\n")).toContain("a-first-thing");
		expect(cited(dir)).toEqual([]);
	});

	test("an identifier carrying uppercase or a space fails", () => {
		const dir = world(
			'// spec: capability/A First Thing\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(problems(dir).length).toBeGreaterThan(0);
		expect(cited(dir)).toEqual([]);
	});
});

// spec: spec-test-traceability/a-criterion-renamed-under-its-test
describe("a criterion renamed under its test", () => {
	test("a citation matching no criterion names citation, file and line", () => {
		const dir = world(
			'const a = 1;\n// spec: capability/the-old-wording\ntest("acts", () => {});\n',
			"The new wording",
		);
		expect(problems(dir).join("\n")).toContain(
			"src/thing.test.ts:2: no criterion capability/the-old-wording",
		);
	});
});

// spec: spec-test-traceability/a-criterion-still-in-flight
describe("a criterion still in flight", () => {
	test("a citation to an active change's delta spec is valid", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": spec("A settled thing"),
			"openspec/changes/in-flight/specs/capability/spec.md":
				spec("A proposed thing"),
			"src/thing.test.ts":
				'// spec: capability/a-proposed-thing\ntest("acts", () => {});\n',
		});
		expect(problems(dir)).toEqual([]);
		expect(ids(check(dir).criteria)).toEqual(["capability/a-settled-thing"]);
	});

	test("an archived change's delta spec is not in the validation set", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": spec("A settled thing"),
			"openspec/changes/archive/2026-01-01-done/specs/capability/spec.md":
				spec("An archived thing"),
			"src/thing.test.ts":
				'// spec: capability/an-archived-thing\ntest("acts", () => {});\n',
		});
		expect(problems(dir).join("\n")).toContain("capability/an-archived-thing");
	});

	test("an empty changes directory leaves the two sets equal", () => {
		const dir = world(
			'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			"A settled thing",
		);
		// git tracks no empty directory, so this one exists only on disk —
		// which is exactly the state a freshly archived change leaves behind.
		mkdirSync(join(dir, "openspec/changes"), { recursive: true });
		expect(problems(dir)).toEqual([]);
		expect(cited(dir)).toEqual(["capability/a-settled-thing"]);
	});

	test("an absent changes directory leaves the two sets equal", () => {
		const dir = world(
			'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			"A settled thing",
		);
		expect(problems(dir)).toEqual([]);
		expect(cited(dir)).toEqual(["capability/a-settled-thing"]);
	});
});

/** Two requirements in one capability, each carrying the same heading. */
const twice = (heading: string) =>
	`# capability\n\n### Requirement: The first rule\n\n#### Scenario: ${heading}\n\n- **WHEN** a\n- **THEN** b\n\n### Requirement: The second rule\n\n#### Scenario: ${heading}\n\n- **WHEN** c\n- **THEN** d\n`;

// spec: spec-test-traceability/an-ambiguous-identifier-is-cited
describe("an ambiguous identifier is cited", () => {
	test("a cited slug matching two criteria names both requirements", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": twice("A skipped minor"),
			"src/thing.test.ts":
				'// spec: capability/a-skipped-minor\ntest("acts", () => {});\n',
		});
		const said = problems(dir).join("\n");
		expect(said).toContain("The first rule");
		expect(said).toContain("The second rule");
	});
});

// spec: spec-test-traceability/an-ambiguous-identifier-nobody-cites
describe("an ambiguous identifier nobody cites", () => {
	test("a delta restating a criterion it modifies is not ambiguity", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": spec("A modified thing"),
			"openspec/changes/in-flight/specs/capability/spec.md":
				spec("A modified thing"),
			"src/thing.test.ts":
				'// spec: capability/a-modified-thing\ntest("acts", () => {});\n',
		});
		expect(problems(dir)).toEqual([]);
		expect(cited(dir)).toEqual(["capability/a-modified-thing"]);
	});

	test("the same slug uncited passes", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": twice("A skipped minor"),
			"src/thing.test.ts": 'test("acts", () => {});\n',
		});
		expect(problems(dir)).toEqual([]);
	});

	test("one heading in two capabilities is two identifiers, not ambiguity", () => {
		const dir = fabricate({
			"openspec/specs/one/spec.md": spec("A shared heading"),
			"openspec/specs/two/spec.md": spec("A shared heading"),
			"src/thing.test.ts":
				'// spec: one/a-shared-heading two/a-shared-heading\ntest("acts", () => {});\n',
		});
		expect(problems(dir)).toEqual([]);
		expect(cited(dir)).toEqual([
			"one/a-shared-heading",
			"two/a-shared-heading",
		]);
	});
});

describe("a tree the check cannot read straight through", () => {
	test("run from a subdirectory it still reads the whole repository", () => {
		const dir = world(
			'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			"A settled thing",
		);
		const seen = check(join(dir, "src"));
		expect([...seen.cited]).toEqual(["capability/a-settled-thing"]);
		expect(seen.files).toEqual(["src/thing.test.ts"]);
	});

	test("outside a repository it throws rather than passing", () => {
		const dir = emptyDir("spec-coverage-bare-");
		expect(() => check(dir)).toThrow();
	});

	test("a tracked test file deleted from the work tree is skipped", () => {
		const dir = world(
			'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			"A settled thing",
		);
		rmSync(join(dir, "src/thing.test.ts"));
		expect(problems(dir)).toEqual([]);
		expect(cited(dir)).toEqual([]);
	});
});

describe("the repository as it stands", () => {
	const here = check(repo);

	test("nothing is cited wrongly", () => {
		expect(here.problems).toEqual([]);
	});

	// spec: spec-test-traceability/the-repository-as-it-stands
	test("the count of uncited criteria sits exactly on the floor", () => {
		expect(gauge(uncited(repo), FLOOR, DECLARATION)).toEqual([]);
	});

	test("the sweep read criteria and test files rather than nothing", () => {
		expect(here.criteria.length).toBeGreaterThan(0);
		expect(here.files.length).toBeGreaterThan(0);
		// Without this the check passes vacuously: a scanner finding nothing
		// reports no problems either, and this file's own citations are the
		// only ones in the tree.
		expect(here.cited.size).toBeGreaterThan(0);
	});
});

describe("what the sweep reads", () => {
	test.each(["ts", "tsx", "js", "jsx", "cts", "cjs", "mts", "mjs"])(
		"a citation in a .%s test is read",
		(ext) => {
			const dir = fabricate({
				"openspec/specs/capability/spec.md": spec("A settled thing"),
				[`src/thing.test.${ext}`]:
					'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			});
			expect(cited(dir)).toEqual(["capability/a-settled-thing"]);
		},
	);

	test.each(["ctsx", "cjsx", "mtsx", "mjsx"])(
		"a citation in a .%s test is not, because Bun does not run one",
		(ext) => {
			const dir = fabricate({
				"openspec/specs/capability/spec.md": spec("A settled thing"),
				[`src/thing.test.${ext}`]:
					'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
			});
			expect(cited(dir)).toEqual([]);
		},
	);

	test("a test file under a dot-directory is not read", () => {
		// Bun does not run it, so a citation there would close a criterion no
		// test ever executes.
		const dir = fabricate({
			"openspec/specs/capability/spec.md": spec("A settled thing"),
			".vendor/thing.test.ts":
				'// spec: capability/a-settled-thing\ntest("acts", () => {});\n',
		});
		expect(cited(dir)).toEqual([]);
	});

	test("a scenario before any requirement heading keeps an empty requirement", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md":
				"# capability\n\n#### Scenario: An orphan\n\n- **WHEN** a\n- **THEN** b\n",
		});
		expect(counted(dir)).toMatchObject([
			{ id: "capability/an-orphan", requirement: "" },
		]);
	});

	test("every test file is scanned, whichever runner owns it", () => {
		const dir = fabricate({
			// Playwright owns `e2e/**` here, so bun test never runs it — and its
			// citations count all the same.
			"bunfig.toml": '[test]\npathIgnorePatterns = ["e2e/**"]\n',
			"openspec/specs/capability/spec.md": spec(
				"A first thing",
				"A second thing",
				"A third thing",
				"A fourth thing",
			),
			"src/thing.test.ts":
				'// spec: capability/a-first-thing\ntest("acts", () => {});\n',
			"e2e/thing.spec.ts":
				'// spec: capability/a-second-thing\ntest("acts", () => {});\n',
			"src/thing_test.ts":
				'// spec: capability/a-third-thing\ntest("acts", () => {});\n',
			"src/thing_spec.tsx":
				'// spec: capability/a-fourth-thing\ntest("acts", () => {});\n',
		});
		expect(cited(dir)).toEqual([
			"capability/a-first-thing",
			"capability/a-fourth-thing",
			"capability/a-second-thing",
			"capability/a-third-thing",
		]);
	});

	test("a tracked file under node_modules is not scanned", () => {
		const dir = fabricate({
			"openspec/specs/capability/spec.md": spec("A first thing"),
			"node_modules/pkg/thing.test.ts": "// spec: capability/the-old-wording\n",
		});
		expect(check(dir).files).toEqual([]);
		expect(problems(dir)).toEqual([]);
	});

	test("a tree with no citations counts every criterion as uncited", () => {
		const dir = world(
			'test("acts", () => {});\n',
			"A first thing",
			"A second thing",
		);
		expect(uncited(dir)).toBe(2);
	});

	test("a citation indented inside a describe block counts", () => {
		const dir = world(
			'describe("outer", () => {\n\t// spec: capability/a-first-thing\n\ttest("acts", () => {});\n});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual(["capability/a-first-thing"]);
		expect(problems(dir)).toEqual([]);
	});
});
