/**
 * Joins acceptance criteria to the tests that close them. A criterion is
 * identified by `<capability>/<slug of its scenario heading>`, derived rather
 * than stored, and a test cites one in a `// spec:` comment directly above it.
 *
 * The check ships as a test rather than a script: CI already runs `bun test`,
 * so it is blocking from the first commit with no workflow edit.
 */
import { afterAll, describe, expect, test } from "bun:test";
import {
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type Criterion = { id: string; requirement: string };

/** The scenario heading, lowercased, every other run of characters a hyphen. */
const slug = (heading: string) =>
	heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * The criteria one spec file declares. Each keeps its requirement heading,
 * which is what the ambiguity message names when one slug matches two.
 */
function parse(file: string, capability: string): Criterion[] {
	const found: Criterion[] = [];
	let requirement = "";
	// A fenced block quoting a `#### Scenario:` line illustrates the format
	// rather than declaring a criterion, and the delta specs of this very
	// change are where that first happens.
	let fenced = false;
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (line.startsWith("```")) fenced = !fenced;
		else if (fenced) continue;
		else if (line.startsWith("### Requirement:"))
			requirement = line.slice(16).trim();
		else if (line.startsWith("#### Scenario:"))
			found.push({ id: `${capability}/${slug(line.slice(14))}`, requirement });
	}
	return found;
}

/** Subdirectory names of `path`, none when it does not exist. */
function subdirs(path: string): string[] {
	if (!lstatSync(path, { throwIfNoEntry: false })?.isDirectory()) return [];
	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

/** Every criterion in `<specs>/<capability>/spec.md`, for one such directory. */
const under = (specs: string): Criterion[] =>
	subdirs(specs).flatMap((capability) => {
		const file = join(specs, capability, "spec.md");
		return lstatSync(file, { throwIfNoEntry: false })?.isFile()
			? parse(file, capability)
			: [];
	});

/** The set the count is taken over. */
const counted = (root: string) => under(join(root, "openspec/specs"));

/**
 * The criteria a citation may name: the counted set plus every active change's
 * delta spec. The asymmetry is what lets a change dogfood the check — its
 * tests cite criteria still in its own delta, valid but not yet counted, and
 * archiving moves criterion and citation into the count together. An archived
 * change sits one directory deeper and so is not read here; its criteria
 * reached `openspec/specs/` when it was archived.
 */
const validated = (root: string): Criterion[] => [
	...counted(root),
	...subdirs(join(root, "openspec/changes")).flatMap((change) =>
		under(join(root, "openspec/changes", change, "specs")),
	),
];

/**
 * A citation identifier. Anchored at both ends, so `capability/A Thing` is a
 * malformed citation the check reports rather than one silently matching
 * nothing.
 */
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A `test`, `it` or `describe` call, member forms — `test.each` — included. */
const CALL = /^\s*(?:test|it|describe)(?:\.\w+)*\s*[(`]/;

/** A line-leading `// spec:` comment. Anything indented past code is not one. */
const CITATION = /^\s*\/\/\s*spec:(.*)$/;

/** Blank, or any comment line: what may sit between a citation and its call. */
const SEPARATOR = /^\s*(?:\/\/|\/?\*|$)/;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

type Citation = { id: string; path: string; line: number };

/**
 * The citations one test file carries, and every way it got them wrong. A
 * citation is the `// spec:` line plus any comment line under it reading as
 * nothing but identifiers; the first comment line that does not is prose, and
 * prose may sit between the citation and the call it belongs to.
 */
function cite(path: string, text: string) {
	const lines = text.split("\n");
	const found: Citation[] = [];
	const wrong: string[] = [];
	lines.forEach((line, index) => {
		const marker = CITATION.exec(line);
		if (!marker) return;
		const at = `${path}:${index + 1}`;
		const named = words(marker[1] ?? "");
		if (!named.length) wrong.push(`${at}: a spec comment naming no criterion`);
		for (const id of named) {
			if (IDENTIFIER.test(id)) found.push({ id, path, line: index + 1 });
			else wrong.push(`${at}: malformed identifier "${id}"`);
		}

		let next = index + 1;
		for (; next < lines.length; next++) {
			const comment = /^\s*\/\/(.*)$/.exec(lines[next] ?? "");
			const more = comment ? words(comment[1] ?? "") : [];
			if (!more.length || !more.every((id) => IDENTIFIER.test(id))) break;
			for (const id of more) found.push({ id, path, line: next + 1 });
		}
		while (next < lines.length && SEPARATOR.test(lines[next] ?? "")) next++;
		if (!CALL.test(lines[next] ?? ""))
			wrong.push(`${at}: not directly above a test, it or describe call`);
	});
	return { found, wrong };
}

/** Tracked test files, listed at the repository root whatever `cwd` is. */
function tests(root: string): string[] {
	const ls = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
	if (ls.exitCode !== 0) throw new Error(ls.stderr.toString());
	return ls.stdout
		.toString()
		.split("\0")
		.filter(
			(path) =>
				(path.endsWith(".test.ts") || path.endsWith(".spec.ts")) &&
				!path.startsWith("node_modules/") &&
				!path.includes("/node_modules/"),
		);
}

/** Everything the check knows about one repository. */
function check(cwd?: string) {
	const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { cwd });
	if (top.exitCode !== 0) throw new Error(top.stderr.toString());
	const root = top.stdout.toString().trim();

	const criteria = counted(root);
	// Grouped rather than a set: three headings repeat under different
	// requirements today, and a slug matching two of them is an error only
	// once a test cites it — until then both simply count as uncited.
	const known = Map.groupBy(validated(root), (c) => c.id);
	const files = tests(root);
	const problems: string[] = [];
	const citations: Citation[] = [];
	for (const path of files) {
		const full = join(root, path);
		// The entry may be tracked but deleted from the work tree.
		if (!lstatSync(full, { throwIfNoEntry: false })?.isFile()) continue;
		const { found, wrong } = cite(path, readFileSync(full, "utf8"));
		citations.push(...found);
		problems.push(...wrong);
	}

	for (const { id, path, line } of citations) {
		const matched = known.get(id);
		if (!matched) problems.push(`${path}:${line}: no criterion ${id}`);
		else if (matched.length > 1)
			problems.push(
				`${path}:${line}: ${id} is ambiguous, carried by ${matched
					.map((c) => `"${c.requirement}"`)
					.join(" and ")} — rename one heading`,
			);
	}

	return {
		criteria,
		files,
		problems,
		cited: new Set(citations.map((c) => c.id)),
	};
}

const repo = join(import.meta.dir, "..");
const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function write(dir: string, files: Record<string, string>): void {
	for (const [path, text] of Object.entries(files)) {
		const full = join(dir, path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, text);
	}
}

/** A throwaway repository holding `files`, all tracked. */
function fabricate(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "spec-coverage-"));
	made.push(dir);
	const git = (...args: string[]) => {
		const run = Bun.spawnSync(["git", ...args], { cwd: dir });
		if (run.exitCode !== 0) throw new Error(run.stderr.toString());
	};
	git("init", "-b", "main");
	write(dir, files);
	git("add", "-A");
	return dir;
}

/** A spec file carrying `scenarios` under one requirement. */
const spec = (...scenarios: string[]) =>
	`# capability\n\n### Requirement: A thing holds\n\n${scenarios
		.map((s) => `#### Scenario: ${s}\n\n- **WHEN** a\n- **THEN** b\n`)
		.join("\n")}`;

const ids = (list: Criterion[]) => list.map((c) => c.id);

/** A repository holding one capability's `scenarios` and one test file. */
const world = (source: string, ...scenarios: string[]) =>
	fabricate({
		"openspec/specs/capability/spec.md": spec(...scenarios),
		"src/thing.test.ts": source,
	});

const cited = (dir: string) => [...check(dir).cited].sort();
const problems = (dir: string) => check(dir).problems;

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

	test("a spec marker inside a block comment is ignored", () => {
		const dir = world(
			'/* // spec: capability/a-first-thing */\ntest("acts", () => {});\n',
			"A first thing",
		);
		expect(cited(dir)).toEqual([]);
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
		const dir = mkdtempSync(join(tmpdir(), "spec-coverage-bare-"));
		made.push(dir);
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

	test("the sweep read criteria and test files rather than nothing", () => {
		expect(here.criteria.length).toBeGreaterThan(0);
		expect(here.files.length).toBeGreaterThan(0);
		// Without this the check passes vacuously: a scanner finding nothing
		// reports no problems either, and this file's own citations are the
		// only ones in the tree.
		expect(here.cited.size).toBeGreaterThan(0);
	});
});
