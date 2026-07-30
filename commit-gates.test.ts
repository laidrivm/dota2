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

const hook: string = JSON.parse(readFileSync(`${root}/package.json`, "utf8"))[
	"simple-git-hooks"
]["pre-commit"];

test("every docker:// step in CI names a digest", () => {
	// A tag is mutable, so an image pinned by tag alone is a different image
	// tomorrow. Until now only a reviewer's eye enforced this.
	const workflows = `${root}/.github/workflows`;
	let found = 0;
	for (const name of readdirSync(workflows).filter((f) => f.endsWith(".yml"))) {
		for (const line of readFileSync(join(workflows, name), "utf8").split(
			"\n",
		)) {
			const image = line.match(/uses:\s*(docker:\/\/\S+)/)?.[1];
			if (!image) continue;
			found++;
			expect(`${name}: ${image}`).toMatch(/@sha256:[0-9a-f]{64}$/);
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
		// The hook reaches biome through bunx; stubbing it keeps this test on
		// the gitleaks half rather than on biome's opinion of the tree.
		for (const [name, body] of Object.entries({ bunx: "exit 0", ...stubs })) {
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
