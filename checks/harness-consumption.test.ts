import { afterAll, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./root.ts";

/**
 * How this repository consumes the pinned harness, checked against the tree
 * and against fabricated clones of it. The harness's own suite tests each
 * check; these cases assert this repository is wired to them.
 */

const settings = await Bun.file(join(root, ".claude/settings.json")).json();
const hook: string = settings.hooks.PreToolUse[0].hooks[0].command;

const made: string[] = [];
afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/**
 * A clone on `main`, with the installed harness linked in when asked. Built
 * under the system temp directory, which holds no `.env` for bun to read.
 */
function clone(installed: boolean): string {
	const dir = mkdtempSync(join(tmpdir(), "harness-consumption-"));
	made.push(dir);
	Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
	if (installed) {
		mkdirSync(join(dir, "node_modules"));
		symlinkSync(
			join(root, "node_modules/harness"),
			join(dir, "node_modules/harness"),
		);
	}
	return dir;
}

/**
 * The settings hook command run as Claude Code runs it: under a shell, with
 * the event on stdin and `CLAUDE_PROJECT_DIR` naming the clone. The
 * environment is only what the hook reads, so nothing the suite inherited
 * decides a case.
 */
function hookOn(dir: string, command: string) {
	const run = Bun.spawnSync(["sh", "-c", hook], {
		cwd: dir,
		env: {
			PATH: process.env.PATH ?? "",
			HOME: process.env.HOME ?? "",
			CLAUDE_PROJECT_DIR: dir,
		},
		stdin: Buffer.from(
			JSON.stringify({ cwd: dir, tool_name: "Bash", tool_input: { command } }),
		),
		stderr: "pipe",
	});
	return { code: run.exitCode, reason: run.stderr.toString() };
}

describe("before the harness is installed", () => {
	// spec: harness-consumption/a-fresh-clone
	test.each(["bun install", "bun i", "bun install --frozen-lockfile"])(
		"%s runs",
		(command) => {
			expect(hookOn(clone(false), command).code).toBe(0);
		},
	);

	// spec: harness-consumption/any-other-command-before-the-install
	test.each([
		"git status",
		"bun install left-pad",
		"bun install --registry https://registry.example.test",
		"bun install --cwd elsewhere",
		"bun install && git status",
	])("%s is blocked with the install named", (command) => {
		const { code, reason } = hookOn(clone(false), command);
		expect(code).toBe(2);
		expect(reason).toContain("bun install");
	});
});

describe("after the harness is installed", () => {
	// spec: harness-consumption/after-the-install
	test("a commit on main is refused by the package's guard", () => {
		const { code, reason } = hookOn(clone(true), "git commit -m x");
		expect(code).toBe(2);
		expect(reason).toContain("command-guard: HEAD is on main");
	});

	// spec: harness-consumption/after-the-install
	test("a command the guard allows runs, install or not", () => {
		expect(hookOn(clone(true), "git status").code).toBe(0);
	});
});

/**
 * A consumer whose `package.json` holds only the mutation floor, with a report
 * in which one mutant of two survives, run through the installed gate.
 */
function mutationVerdict(surviving: number) {
	const dir = mkdtempSync(join(tmpdir(), "harness-consumption-"));
	made.push(dir);
	Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src/model.ts"), "export const x = 1;\n");
	mkdirSync(join(dir, "reports/mutation"), { recursive: true });
	writeFileSync(
		join(dir, "reports/mutation/mutation.json"),
		JSON.stringify({
			files: {
				"src/model.ts": {
					mutants: [{ status: "Survived" }, { status: "Killed" }],
				},
			},
		}),
	);
	const harness = {
		mutationFloor: { module: "src/model.ts", surviving, why: "a case" },
	};
	writeFileSync(join(dir, "package.json"), JSON.stringify({ harness }));
	const gate = join(root, "node_modules/harness/bun/mutation-floor.ts");
	return Bun.spawnSync(["bun", gate], {
		cwd: dir,
		env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
	}).exitCode;
}

/** The installed gates' own source: no case, no fixture a case builds from. */
const gateSource = () => {
	const dir = join(root, "node_modules/harness/bun");
	return readdirSync(dir)
		.filter((name) => !/\.(test|fixture)\.ts$/.test(name))
		.map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
};

/** Each job's `run:` steps, in order, per job of a workflow. */
const runs = (workflow: string): string[][] => {
	const parsed = Bun.YAML.parse(
		readFileSync(join(root, ".github/workflows", workflow), "utf8"),
	) as { jobs: Record<string, { steps?: { run?: string }[] }> };
	return Object.values(parsed.jobs).map((job) =>
		(job.steps ?? []).flatMap((step) => (step.run ? [step.run] : [])),
	);
};

describe("the values the gates run with", () => {
	// spec: harness-consumption/raising-the-mutation-floor
	test("the floor in this repository's package.json decides the verdict", () => {
		expect(mutationVerdict(1)).toBe(0);
		expect(mutationVerdict(2)).not.toBe(0);
	});

	// spec: harness-consumption/a-d2ass-value-in-a-gate
	test.each(["src/model.ts", "src/fixtures/snapshot.json"])(
		"no installed gate names %s",
		(path) => {
			const naming = gateSource().filter(({ text }) => text.includes(path));
			expect(naming.map(({ name }) => name)).toEqual([]);
		},
	);
});

/** A `bun run <name>` resolved to the command the manifest gives it. */
function resolved(run: string): string {
	const { scripts } = JSON.parse(
		readFileSync(join(root, "package.json"), "utf8"),
	) as { scripts: Record<string, string> };
	return run.replace(/^bun run (\S+)/, (all, name) => scripts[name] ?? all);
}

describe("CI runs the gates from the pin", () => {
	// spec: harness-consumption/a-workflow-running-a-gate
	test.each(["diff-budget.yml", "lint.yml", "mutation.yml"])(
		"%s runs each harness gate from node_modules after its job's install",
		(workflow) => {
			const jobs = runs(workflow);
			let gates = 0;
			for (const steps of jobs) {
				const commands = steps.map(resolved);
				expect(commands.some((run) => /\bscripts\//.test(run))).toBe(false);
				const install = steps.indexOf("bun install --frozen-lockfile");
				commands.forEach((run, at) => {
					if (!run.includes("node_modules/harness/")) return;
					gates++;
					expect(install).toBeGreaterThanOrEqual(0);
					expect(at).toBeGreaterThan(install);
				});
			}
			expect(gates).toBeGreaterThan(0);
		},
	);
});
