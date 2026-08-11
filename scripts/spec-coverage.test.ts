/**
 * Joins acceptance criteria to the tests that close them. A criterion is
 * identified by `<capability>/<slug of its scenario heading>`, derived rather
 * than stored, and a test cites one in a `// spec:` comment directly above it.
 *
 * The check ships as a test rather than a script: CI already runs `bun test`,
 * so it is blocking from the first commit with no workflow edit.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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
