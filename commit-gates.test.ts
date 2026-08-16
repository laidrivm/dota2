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

describe("the pre-commit secret scan", () => {
	/**
	 * Runs the hook's own command string under `sh`, with `PATH` holding only
	 * the stubs asked for — so "gitleaks is absent" and "gitleaks found
	 * something" are both reproducible without installing anything.
	 */
	function runHook(stubs: Record<string, string>) {
		const bin = mkdtempSync(join(tmpdir(), "commit-gates-"));
		// The hook reaches biome through `bun run`; stubbing it keeps this test
		// on the gitleaks half rather than on biome's opinion of the tree.
		for (const [name, body] of Object.entries({ bun: "exit 0", ...stubs })) {
			const path = join(bin, name);
			writeFileSync(path, `#!/bin/sh\n${body}\n`);
			chmodSync(path, 0o755);
		}
		// Absolute, because `PATH` below holds only the stubs — and it is the
		// interpreter the generated hook itself runs under.
		const run = Bun.spawnSync(["/bin/sh", "-c", hook], {
			cwd: root,
			env: { PATH: bin },
			stderr: "pipe",
		});
		rmSync(bin, { recursive: true, force: true });
		return {
			code: run.exitCode,
			output: run.stdout.toString() + run.stderr.toString(),
		};
	}

	test("it passes silently when gitleaks is not installed", () => {
		// A fresh clone has no gitleaks binary and must still commit, without a
		// warning on every commit.
		const { code, output } = runHook({});
		expect(code).toBe(0);
		expect(output.trim()).toBe("");
	});

	test("a finding fails the commit", () => {
		// The shape that would break this is `&& gitleaks … || true`, which
		// reports and then swallows.
		const { code } = runHook({ gitleaks: "echo 'leaks found: 1' >&2; exit 1" });
		expect(code).not.toBe(0);
	});

	test("a clean scan lets the commit through", () => {
		expect(runHook({ gitleaks: "exit 0" }).code).toBe(0);
	});
});

describe("the pre-push gates", () => {
	const push = hooks["pre-push"] as string;

	/**
	 * The same shape the pre-commit block uses, over the other hook: `PATH`
	 * holds only the stubs asked for, so "the tool is absent" and "the tool
	 * found something" are both reproducible without installing anything.
	 *
	 * `bun` and `bunx` are stubbed to succeed by default, which is what keeps
	 * each case on the gate it names rather than on the tree's real state —
	 * running the real suite here would make this file take as long as the
	 * hook does.
	 */
	function runPush(stubs: Record<string, string>) {
		const bin = mkdtempSync(join(tmpdir(), "push-gates-"));
		// `rm` too: the hook deletes the stale mutation report, and `PATH` here
		// holds nothing but these stubs.
		const all = {
			bun: "exit 0",
			bunx: "exit 0",
			bash: "exit 0",
			rm: "exit 0",
			...stubs,
		};
		for (const [name, body] of Object.entries(all)) {
			const path = join(bin, name);
			writeFileSync(path, `#!/bin/sh\n${body}\n`);
			chmodSync(path, 0o755);
		}
		const run = Bun.spawnSync(["/bin/sh", "-c", push], {
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

	test("neither optional tool installed passes silently", () => {
		// A fresh clone has neither binary and must still push, without a
		// warning naming a tool the developer never asked for.
		const { code, output } = runPush({});
		expect(code).toBe(0);
		expect(output).not.toContain("actionlint");
		expect(output).not.toContain("gitleaks");
	});

	test("a gitleaks finding blocks the push", () => {
		// The shape that would break this is `command -v gitleaks && gitleaks …`,
		// which reports and then leaves the chain's status to the guard.
		const { code } = runPush({
			gitleaks: "echo 'leaks found: 1' >&2; exit 1",
		});
		expect(code).not.toBe(0);
	});

	test("an actionlint finding blocks the push", () => {
		expect(
			runPush({ actionlint: "echo 'workflow error' >&2; exit 1" }).code,
		).not.toBe(0);
	});

	test("a clean run of both optional tools lets the push through", () => {
		expect(runPush({ actionlint: "exit 0", gitleaks: "exit 0" }).code).toBe(0);
	});

	test("a surviving-mutant count over the floor blocks the push", () => {
		// The floor is the last `bun` invocation in the chain, so a stub that
		// fails on it and passes on everything else pins this gate alone.
		const { code } = runPush({
			bun: "case \"$*\" in *mutation-floor*) echo '185 surviving mutants against a floor of 67' >&2; exit 1 ;; *) exit 0 ;; esac",
		});
		expect(code).not.toBe(0);
	});

	test("the diff budget is absorbed, so an over-budget branch still pushes", () => {
		// `change-slicing` requires this one gate to report and not block: it
		// measures what a reviewer must read, which is not a defect.
		const { code } = runPush({
			bash: "echo 'DIFF gate: FAIL — 950 lines'; exit 1",
		});
		expect(code).toBe(0);
	});

	test("the first failing gate stops the chain", () => {
		// `&&` throughout, so a later gate cannot run and overwrite the verdict
		// with its own. Biome is first, and nothing after it should be reached.
		const { code, output } = runPush({
			bun: "case \"$*\" in *' lint'*) echo 'biome failed' >&2; exit 1 ;; *) echo \"REACHED $*\"; exit 0 ;; esac",
		});
		expect(code).not.toBe(0);
		expect(output).toContain("biome failed");
		expect(output).not.toContain("REACHED");
	});

	test("the hook on disk matches package.json", () => {
		// `simple-git-hooks` writes the file only when `bun run prepare` runs,
		// so the two drift the moment one is edited without the other.
		expect(readFileSync(`${root}/.git/hooks/pre-push`, "utf8")).toContain(push);
	});
});
