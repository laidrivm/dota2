import { describe, expect, test } from "bun:test";
import {
	chmodSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = import.meta.dir;

const hooks: Record<string, string> = JSON.parse(
	readFileSync(`${root}/package.json`, "utf8"),
)["simple-git-hooks"];
const hook = hooks["pre-commit"] as string;

test("every docker:// step in CI names a digest", () => {
	// A tag is mutable, so an image pinned by tag alone is a different image
	// tomorrow. Until now only a reviewer's eye enforced this.
	const workflows = `${root}/.github/workflows`;
	let found = 0;
	// Both extensions: GitHub reads either, and a `.yaml` file skipped here
	// would carry an unpinned image while the `.yml` files keep the count above
	// zero and the sweep looking healthy.
	const files = readdirSync(workflows).filter((f) => /\.ya?ml$/.test(f));
	for (const name of files) {
		// Parsed rather than grepped line by line, so a quoted or folded
		// scalar is the same `uses` value to this check as a plain one.
		// `Bun.YAML` is what `scripts/check-yaml.ts` already reads YAML with.
		const doc = Bun.YAML.parse(readFileSync(join(workflows, name), "utf8")) as {
			jobs?: Record<string, { steps?: { uses?: string }[] }>;
		};
		for (const job of Object.values(doc.jobs ?? {})) {
			for (const step of job.steps ?? []) {
				if (!step.uses?.startsWith("docker://")) continue;
				found++;
				expect(`${name}: ${step.uses}`).toMatch(/@sha256:[0-9a-f]{64}$/);
			}
		}
	}
	// Guards the guard: an empty sweep passes every assertion above.
	expect(found).toBeGreaterThan(0);
});

/**
 * Runs a hook's own command string under `sh`, with `PATH` holding only the
 * stubs asked for — so "the tool is absent" and "the tool found something" are
 * both reproducible without installing anything.
 *
 * `bun` and the other runners default to succeeding, which keeps each case on
 * the gate it names rather than on the tree's real state; a case that wants one
 * to fail passes its own stub. The working directory is the stub directory and
 * not the repository, so a command this forgot to stub cannot reach the real
 * tree — `rm -rf reports/mutation` is in one of these hooks.
 */
function runHook(command: string, stubs: Record<string, string> = {}) {
	const bin = mkdtempSync(join(tmpdir(), "hook-gates-"));
	const all = {
		bun: "exit 0",
		bunx: "exit 0",
		bash: "exit 0",
		rm: "exit 0",
		// The secret scan resolves its range through `git`, so a case that did
		// not stub it would read the real repository's refs.
		git: "echo main",
		...stubs,
	};
	for (const [name, body] of Object.entries(all)) {
		const path = join(bin, name);
		writeFileSync(path, `#!/bin/sh\n${body}\n`);
		chmodSync(path, 0o755);
	}
	// Absolute, because `PATH` holds only the stubs — and it is the interpreter
	// the generated hook itself runs under.
	const run = Bun.spawnSync(["/bin/sh", "-c", command], {
		cwd: bin,
		env: { PATH: bin },
		stderr: "pipe",
	});
	rmSync(bin, { recursive: true, force: true });
	return {
		code: run.exitCode,
		output: run.stdout.toString() + run.stderr.toString(),
	};
}

describe("the pre-commit secret scan", () => {
	test("it passes silently when gitleaks is not installed", () => {
		// A fresh clone has no gitleaks binary and must still commit, without a
		// warning on every commit.
		const { code, output } = runHook(hook);
		expect(code).toBe(0);
		expect(output.trim()).toBe("");
	});

	test("a finding fails the commit", () => {
		// The shape that would break this is `&& gitleaks … || true`, which
		// reports and then swallows.
		const { code } = runHook(hook, {
			gitleaks: "echo 'leaks found: 1' >&2; exit 1",
		});
		expect(code).not.toBe(0);
	});

	test("a clean scan lets the commit through", () => {
		expect(runHook(hook, { gitleaks: "exit 0" }).code).toBe(0);
	});
});

describe("the pre-push gates", () => {
	const push = hooks["pre-push"] as string;

	// spec: commit-gates/a-tool-the-machine-does-not-have
	test("neither optional tool installed passes silently", () => {
		// A fresh clone has neither binary and must still push, without a
		// warning naming a tool the developer never asked for.
		const { code, output } = runHook(push);
		expect(code).toBe(0);
		expect(output).not.toContain("actionlint");
		expect(output).not.toContain("gitleaks");
	});

	// spec: commit-gates/a-tool-the-machine-has-reporting-a-finding
	test("a gitleaks finding blocks the push", () => {
		// The shape that would break this is `command -v gitleaks && gitleaks …`,
		// which reports and then leaves the chain's status to the guard.
		const { code } = runHook(push, {
			gitleaks: "echo 'leaks found: 1' >&2; exit 1",
		});
		expect(code).not.toBe(0);
	});

	// spec: commit-gates/a-secret-that-is-already-in-the-base-branch
	test("the secret scan reads the commits the push adds, not all history", () => {
		// `gitleaks git .` with no range walks every commit ever made, so one
		// secret landing in history would block every push by everyone until a
		// baseline was added. The range is resolved the way
		// `scripts/diff-budget.sh` resolves its base.
		const { output } = runHook(push, {
			gitleaks: 'echo "ARGS $*"; exit 0',
			git: "echo main",
		});
		expect(output).toContain("--log-opts=main..HEAD");
	});

	test("an actionlint finding blocks the push", () => {
		expect(
			runHook(push, { actionlint: "echo 'workflow error' >&2; exit 1" }).code,
		).not.toBe(0);
	});

	test("a clean run of both optional tools lets the push through", () => {
		expect(
			runHook(push, { actionlint: "exit 0", gitleaks: "exit 0" }).code,
		).toBe(0);
	});

	// spec: commit-gates/a-gate-that-ci-would-fail-blocks-the-push-instead
	test("a surviving-mutant count over the floor blocks the push", () => {
		// The floor is the last `bun` invocation in the chain, so a stub that
		// fails on it and passes on everything else pins this gate alone.
		const { code } = runHook(push, {
			bun: "case \"$*\" in *mutation-floor*) echo '185 surviving mutants against a floor of 67' >&2; exit 1 ;; *) exit 0 ;; esac",
		});
		expect(code).not.toBe(0);
	});

	// spec: commit-gates/the-budget-is-still-soft
	test("the diff budget is absorbed, so an over-budget branch still pushes", () => {
		// `change-slicing` requires this one gate to report and not block: it
		// measures what a reviewer must read, which is not a defect.
		const { code } = runHook(push, {
			bash: "echo 'DIFF gate: FAIL — 950 lines'; exit 1",
		});
		expect(code).toBe(0);
	});

	test("the first failing gate stops the chain", () => {
		// `&&` throughout, so a later gate cannot run and overwrite the verdict
		// with its own. Biome is first, and nothing after it should be reached.
		const { code, output } = runHook(push, {
			bun: "case \"$*\" in *' lint'*) echo 'biome failed' >&2; exit 1 ;; *) echo \"REACHED $*\"; exit 0 ;; esac",
		});
		expect(code).not.toBe(0);
		expect(output).toContain("biome failed");
		expect(output).not.toContain("REACHED");
	});

	test.each([
		["biome", "bun run lint"],
		["the YAML syntax check", "bun run lint:yaml"],
		["the suppression scan", "bun run lint:suppressions"],
		["the type check", "bun run typecheck"],
		["the suite", "bun test"],
		["Stryker", "bunx --no-install stryker run"],
		["the mutation floor", "bun scripts/mutation-floor.ts"],
		["the diff budget", "scripts/diff-budget.sh"],
		["the secret scan over what it pushes", 'gitleaks git . --log-opts="'],
	])("the hook runs %s", (_label, command) => {
		// Membership, which no behavioural case above covers: each of those
		// stubs the runners, so a gate deleted from the chain simply never runs
		// and every one of them still passes.
		expect(push).toContain(command);
	});

	test("the hook on disk matches package.json", () => {
		// `simple-git-hooks` writes the file only when `bun run prepare` runs,
		// so the two drift the moment one is edited without the other. Compared
		// as the file's last line rather than with `toContain`: a gate dropped
		// from the front of the chain leaves a string the file still contains.
		//
		// The path comes from git rather than from joining `.git/` by hand: in
		// a linked worktree `.git` is a file naming the real directory, so the
		// join resolves to nothing and this fails wherever `CLAUDE.md`'s own
		// rule about cutting a branch in a worktree has been followed.
		const hook = Bun.spawnSync(
			[
				"git",
				"rev-parse",
				"--path-format=absolute",
				"--git-path",
				"hooks/pre-push",
			],
			{ cwd: root },
		);
		expect(hook.exitCode).toBe(0);
		const onDisk = readFileSync(hook.stdout.toString().trim(), "utf8")
			.trimEnd()
			.split("\n")
			.at(-1);
		expect(onDisk).toBe(push);
	});
});
