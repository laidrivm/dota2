import { afterAll, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Every case runs against a repository built for it. Measuring the live
 * branch would change the verdict with every commit, which is the one
 * property a test of a threshold cannot have.
 */
const script = join(import.meta.dir, "diff-budget.sh");
const made: string[] = [];

afterAll(() => {
	for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) => {
	const p = Bun.spawnSync(["git", ...args], { cwd });
	if (p.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${p.stderr}`);
};

/** `null` deletes the file; `Uint8Array` writes bytes, so a binary stays binary. */
type Tree = Record<string, string | Uint8Array | null>;

const put = (dir: string, tree: Tree) => {
	for (const [path, content] of Object.entries(tree)) {
		const full = join(dir, path);
		if (content === null) {
			unlinkSync(full);
			continue;
		}
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content);
	}
};

const repo = (base: Tree, head: Tree) => {
	const dir = mkdtempSync(join(tmpdir(), "diff-budget-"));
	made.push(dir);
	git(dir, "init", "-q", "-b", "main");
	git(dir, "config", "user.email", "test@example.com");
	git(dir, "config", "user.name", "Test");
	put(dir, base);
	git(dir, "add", "-A");
	git(dir, "commit", "-qm", "base");
	git(dir, "checkout", "-qb", "feature");
	put(dir, head);
	git(dir, "add", "-A");
	git(dir, "commit", "-qm", "head", "--allow-empty");
	return dir;
};

const gate = (dir: string, base = "main") => {
	const p = Bun.spawnSync(["bash", script, base], { cwd: dir });
	return {
		line: p.stdout.toString().trim(),
		stderr: p.stderr.toString().trim(),
		code: p.exitCode,
		total: Number(p.stdout.toString().match(/— (\d+) lines/)?.[1]),
		source: Number(p.stdout.toString().match(/\((\d+) source/)?.[1]),
		test: Number(p.stdout.toString().match(/(\d+) test\)/)?.[1]),
	};
};

/** N distinct lines, so no pairing can occur by accident. */
const lines = (n: number) =>
	`${Array.from({ length: n }, (_, i) => `line ${i}`).join("\n")}\n`;

const tasks = (n: number, box: " " | "x") =>
	`${Array.from({ length: n }, (_, i) => `- [${box}] task ${i}`).join("\n")}\n`;

test("an empty diff counts zero and passes", () => {
	const g = gate(repo({ "a.ts": "one\n" }, {}));
	expect(g.line).toBe("DIFF gate: PASS — 0 lines (0 source / 0 test)");
	expect(g.code).toBe(0);
});

test("excluded artefacts contribute nothing", () => {
	const g = gate(
		repo(
			{
				"bun.lock": "old\n",
				"f.woff2": "old\n",
				"src/fixtures/snapshot.json": "{}\n",
			},
			{
				"bun.lock": lines(900),
				"f.woff2": lines(50),
				"src/fixtures/snapshot.json": lines(200),
			},
		),
	);
	expect(g.total).toBe(0);
});

test("a lockfile-heavy branch reports only its source lines", () => {
	const g = gate(
		repo(
			{ "bun.lock": "old\n" },
			{ "bun.lock": lines(900), "a.ts": lines(40) },
		),
	);
	expect(g.total).toBe(40);
});

test("ticking task boxes counts zero", () => {
	const g = gate(
		repo({ "tasks.md": tasks(30, " ") }, { "tasks.md": tasks(30, "x") }),
	);
	expect(g.total).toBe(0);
});

test("unticking counts zero too", () => {
	const g = gate(
		repo({ "tasks.md": tasks(12, "x") }, { "tasks.md": tasks(12, " ") }),
	);
	expect(g.total).toBe(0);
});

test("newly authored task lines are counted", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "tasks.md": tasks(60, " ") }));
	expect(g.total).toBe(60);
});

test("a task line whose text was rewritten is counted, not cancelled", () => {
	const g = gate(
		repo(
			{ "tasks.md": "- [ ] write the parser\n- [ ] keep me\n" },
			{ "tasks.md": "- [x] write the tokeniser\n- [ ] keep me\n" },
		),
	);
	expect(g.total).toBe(2);
});

test("an identical task line moved between files is counted on both sides", () => {
	const g = gate(
		repo(
			{ "a/tasks.md": "- [ ] write the parser\n", "b/tasks.md": "keep\n" },
			{ "a/tasks.md": "\n", "b/tasks.md": "keep\n- [x] write the parser\n" },
		),
	);
	// The removal, the addition, and the blank line left behind in a/.
	expect(g.total).toBe(3);
});

test("a task line moved with its box unchanged is counted on both sides", () => {
	const g = gate(
		repo(
			{ "tasks.md": "- [x] write the parser\nmiddle\n" },
			{ "tasks.md": "middle\n- [x] write the parser\n" },
		),
	);
	expect(g.total).toBe(2);
});

test("a pure rename contributes zero", () => {
	const body = lines(40);
	const g = gate(repo({ "old.ts": body }, { "old.ts": null, "new.ts": body }));
	expect(g.total).toBe(0);
});

test("a changed binary contributes zero", () => {
	const g = gate(
		repo(
			{ "logo.bin": new Uint8Array([0, 1, 2, 0, 3]) },
			{ "logo.bin": new Uint8Array([0, 9, 9, 0, 9, 9, 9]) },
		),
	);
	expect(g.total).toBe(0);
});

test("src/app/latest.ts is source, not test", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "src/app/latest.ts": lines(20) }));
	expect(g.source).toBe(20);
	expect(g.test).toBe(0);
});

test("an e2e spec is test", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "e2e/smoke.spec.ts": lines(20) }));
	expect(g.test).toBe(20);
	expect(g.source).toBe(0);
});

test("a root-level *.test.ts is test", () => {
	const g = gate(
		repo({ "a.ts": "one\n" }, { "readme-map.test.ts": lines(20) }),
	);
	expect(g.test).toBe(20);
	expect(g.source).toBe(0);
});

test("the split sums to the total", () => {
	const g = gate(
		repo(
			{ "a.ts": "one\n" },
			{ "src/model.ts": lines(340), "src/model.test.ts": lines(610) },
		),
	);
	expect(g.source).toBe(340);
	expect(g.test).toBe(610);
	expect(g.source + g.test).toBe(g.total);
});

test("499 lines pass", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "b.ts": lines(499) }));
	expect(g.line).toBe("DIFF gate: PASS — 499 lines (499 source / 0 test)");
	expect(g.code).toBe(0);
});

test("500 lines warn and still exit zero", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "b.ts": lines(500) }));
	expect(g.line).toBe(
		"DIFF gate: WARN — 500 lines (500 source / 0 test) — over 500, fails at 800",
	);
	expect(g.code).toBe(0);
});

test("799 lines warn", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "b.ts": lines(799) }));
	expect(g.line).toContain("WARN — 799 lines");
	expect(g.code).toBe(0);
});

test("800 lines fail and exit non-zero", () => {
	const g = gate(repo({ "a.ts": "one\n" }, { "b.ts": lines(800) }));
	expect(g.line).toBe(
		"DIFF gate: FAIL — 800 lines (800 source / 0 test) — over 800",
	);
	expect(g.code).not.toBe(0);
});

test("a test-heavy branch fails on the total, tests included", () => {
	const g = gate(
		repo({ "a.ts": "one\n" }, { "a.ts": lines(340), "a.test.ts": lines(610) }),
	);
	// 340 added + 1 removed original line, so the verdict is the total's.
	expect(g.line).toContain("FAIL");
	expect(g.code).not.toBe(0);
});

test("an unresolvable base exits non-zero rather than reporting a pass", () => {
	const g = gate(
		repo({ "a.ts": "one\n" }, { "b.ts": lines(10) }),
		"no-such-branch",
	);
	// 2, not 1: CI has to tell a diff it could not measure from one that is
	// merely over budget, and the pre-push hook absorbs both alike.
	expect(g.code).toBe(2);
	expect(g.stderr).toContain("cannot resolve base ref 'no-such-branch'");
	expect(g.line).toBe("");
});

test("the default base is resolved when no argument is given", () => {
	const dir = repo({ "a.ts": "one\n" }, { "b.ts": lines(10) });
	// No remote, so `origin/HEAD` fails and the fallback to `main` is what
	// answers — the path every other case skips by passing a base.
	const p = Bun.spawnSync(["bash", script], { cwd: dir });
	expect(p.stdout.toString()).toContain("PASS — 10 lines");
	expect(p.exitCode).toBe(0);
});

test("the origin/ prefix is stripped from the resolved default", () => {
	const dir = repo({ "a.ts": "one\n" }, { "b.ts": lines(10) });
	// A bare repository standing in for the remote, so `origin/HEAD` resolves
	// and the script has a prefix to strip.
	const remote = mkdtempSync(join(tmpdir(), "diff-budget-remote-"));
	made.push(remote);
	git(remote, "init", "-q", "--bare", "-b", "main");
	git(dir, "remote", "add", "origin", remote);
	git(dir, "push", "-q", "origin", "main", "feature");
	git(dir, "remote", "set-head", "origin", "main");
	const p = Bun.spawnSync(["bash", script], { cwd: dir });
	expect(p.stdout.toString()).toContain("PASS — 10 lines");
});

test("the same task text ticked in two files pairs within each", () => {
	const both = (box: " " | "x") => `- [${box}] write the parser\n`;
	const g = gate(
		repo(
			{ "a/tasks.md": both(" "), "b/tasks.md": both(" ") },
			{ "a/tasks.md": both("x"), "b/tasks.md": both("x") },
		),
	);
	expect(g.total).toBe(0);
});

test("an indented task line pairs on a tick", () => {
	const g = gate(
		repo(
			{ "PLAN.md": "  - [ ] **5.1 slicing rules** — rules only\n" },
			{ "PLAN.md": "  - [x] **5.1 slicing rules** — rules only\n" },
		),
	);
	expect(g.total).toBe(0);
});

test("re-indenting a task line is a change, not a tick", () => {
	const g = gate(
		repo(
			{ "tasks.md": "- [x] write the parser\n" },
			{ "tasks.md": "    - [x] write the parser\n" },
		),
	);
	expect(g.total).toBe(2);
});

test("an uppercase box pairs with a lowercase one", () => {
	const g = gate(
		repo(
			{ "tasks.md": "- [ ] write the parser\n" },
			{ "tasks.md": "- [X] write the parser\n" },
		),
	);
	expect(g.total).toBe(0);
});

test("patch headers written as file content are counted, not parsed", () => {
	// `design.md` in this repo contains a diff snippet. Inside a hunk these
	// are content: a removed `-- foo` and an added `++ foo` arrive on the
	// wire as `--- foo` and `+++ foo`.
	const g = gate(
		repo(
			{ "design.md": "intro\n--- a/old.ts\nmiddle\n" },
			{ "design.md": "intro\n+++ b/new.ts\nmiddle\n" },
		),
	);
	expect(g.total).toBe(2);
});

test("outside a git repository the script exits non-zero", () => {
	const dir = mkdtempSync(join(tmpdir(), "diff-budget-bare-"));
	made.push(dir);
	const p = Bun.spawnSync(["bash", script, "main"], { cwd: dir });
	expect(p.exitCode).not.toBe(0);
	expect(p.stdout.toString()).not.toContain("PASS");
});

test("an unrelated base exits non-zero — no merge base to measure from", () => {
	const dir = repo({ "a.ts": "one\n" }, { "b.ts": lines(10) });
	git(dir, "checkout", "-q", "--orphan", "detached");
	git(dir, "commit", "-qm", "unrelated", "--allow-empty");
	git(dir, "branch", "-f", "main", "detached");
	git(dir, "checkout", "-q", "feature");
	const g = gate(dir);
	expect(g.code).not.toBe(0);
	expect(g.stderr).toContain("no merge base");
});
