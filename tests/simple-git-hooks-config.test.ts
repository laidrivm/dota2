// Tests for the simple-git-hooks configuration introduced in package.json
// and mirrored in bun.lock (Task 6 — see tasks/task-6.md and PLAN.md).
//
// These are configuration/behaviour tests: simple-git-hooks reads the
// "simple-git-hooks" block and the "prepare" script verbatim from
// package.json to install .git/hooks, so asserting on that declared shape
// is asserting the actual behaviour hooks will have — not an implementation
// detail.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const packageJsonPath = join(rootDir, "package.json");
const bunLockPath = join(rootDir, "bun.lock");

function readPackageJson(): {
	name: string;
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
	"simple-git-hooks"?: Record<string, string>;
} {
	return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

describe("package.json - simple-git-hooks setup", () => {
	test("package.json is valid, parseable JSON", () => {
		expect(() => readPackageJson()).not.toThrow();
	});

	test("declares a prepare script that installs the hooks on bun install", () => {
		const pkg = readPackageJson();
		expect(pkg.scripts?.prepare).toBe("simple-git-hooks");
	});

	test("pins simple-git-hooks as an exact devDependency", () => {
		const pkg = readPackageJson();
		expect(pkg.devDependencies?.["simple-git-hooks"]).toBe("2.13.1");
	});

	test("does not also list simple-git-hooks as a runtime dependency", () => {
		const pkg = readPackageJson();
		expect(pkg.dependencies?.["simple-git-hooks"]).toBeUndefined();
	});

	test("every devDependency is pinned to an exact version (no ^ or ~ ranges)", () => {
		const pkg = readPackageJson();
		const devDeps = pkg.devDependencies ?? {};
		expect(Object.keys(devDeps).length).toBeGreaterThan(0);
		for (const [name, version] of Object.entries(devDeps)) {
			expect(version, `${name} should be pinned exactly`).not.toMatch(
				/^[\^~]/,
			);
		}
	});

	describe("simple-git-hooks hook definitions", () => {
		test("defines exactly pre-commit and pre-push, nothing else", () => {
			const pkg = readPackageJson();
			const hooks = pkg["simple-git-hooks"];
			expect(hooks).toBeDefined();
			expect(Object.keys(hooks ?? {}).sort()).toEqual([
				"pre-commit",
				"pre-push",
			]);
		});

		test("pre-commit runs a staged-only biome check", () => {
			const pkg = readPackageJson();
			const preCommit = pkg["simple-git-hooks"]?.["pre-commit"] ?? "";
			expect(preCommit).toContain("biome check");
			expect(preCommit).toContain("--staged");
			expect(preCommit).toContain("--no-errors-on-unmatched");
		});

		test("pre-commit deliberately does not autofix (cannot re-stage)", () => {
			// Deviation documented in tasks/task-6.md: --write is intentionally
			// omitted because simple-git-hooks can't re-stage autofixed files.
			const pkg = readPackageJson();
			const preCommit = pkg["simple-git-hooks"]?.["pre-commit"] ?? "";
			expect(preCommit).not.toContain("--write");
		});

		test("pre-commit does not run the whole-repo lint command", () => {
			const pkg = readPackageJson();
			const preCommit = pkg["simple-git-hooks"]?.["pre-commit"] ?? "";
			expect(preCommit).not.toContain("biome ci");
		});

		test("pre-push typechecks then runs tests, tolerating an empty suite", () => {
			const pkg = readPackageJson();
			const prePush = pkg["simple-git-hooks"]?.["pre-push"] ?? "";
			expect(prePush).toContain("bun run typecheck");
			expect(prePush).toContain("bun test");
			expect(prePush).toContain("--pass-with-no-tests");
		});

		test("pre-push chains typecheck before tests with &&, not a fire-and-forget separator", () => {
			const pkg = readPackageJson();
			const prePush = pkg["simple-git-hooks"]?.["pre-push"] ?? "";
			const typecheckIndex = prePush.indexOf("bun run typecheck");
			const testIndex = prePush.indexOf("bun test");
			expect(typecheckIndex).toBeGreaterThanOrEqual(0);
			expect(testIndex).toBeGreaterThan(typecheckIndex);
			expect(prePush.slice(typecheckIndex, testIndex)).toContain("&&");
		});

		test("no hook runs e2e, coverage, audit, or a remote shell pipe", () => {
			const pkg = readPackageJson();
			const hooks = pkg["simple-git-hooks"] ?? {};
			for (const command of Object.values(hooks)) {
				expect(command).not.toMatch(/playwright|coverage|audit/i);
				expect(command).not.toMatch(/curl|wget/i);
			}
		});
	});
});

describe("bun.lock - simple-git-hooks entry", () => {
	const lockText = readFileSync(bunLockPath, "utf8");

	test("lists simple-git-hooks in the root workspace devDependencies", () => {
		expect(lockText).toMatch(/"simple-git-hooks":\s*"2\.13\.1"/);
	});

	test("registers a matching package entry exposing the cli.js bin", () => {
		expect(lockText).toMatch(
			/"simple-git-hooks":\s*\[\s*"simple-git-hooks@2\.13\.1"/,
		);
		expect(lockText).toContain('"bin": { "simple-git-hooks": "cli.js" }');
	});

	test("the locked version matches the version pinned in package.json", () => {
		const pkg = readPackageJson();
		const pkgVersion = pkg.devDependencies?.["simple-git-hooks"];
		const lockMatch = lockText.match(
			/"simple-git-hooks":\s*\[\s*"simple-git-hooks@([\d.]+)"/,
		);
		expect(lockMatch?.[1]).toBe(pkgVersion);
	});
});