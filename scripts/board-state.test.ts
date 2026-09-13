/**
 * The three statuses `scripts/board-state.ts` derives, and the five it never
 * reports. Every case but the last builds its own tree: this repository's
 * changes directory is the subject of one case and the fixture of none.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	archived,
	cleanup,
	complete,
	fabricate,
} from "./board-state.fixture.ts";
import { boardState } from "./board-state.ts";
import { root } from "./root.ts";

afterAll(cleanup);

/** The four artefacts, minus one, so each absence is one case's subject. */
const without = (slug: string, artefact: string) => {
	const whole = complete(slug);
	delete whole[`openspec/changes/${slug}/${artefact}`];
	return whole;
};

// spec: task-board/a-complete-change-directory-no-step-applied
describe("a change directory holding all four artefacts", () => {
	test("derives ready", () => {
		const tree = fabricate(complete("candidacy-gate"));
		expect(boardState(tree).status).toEqual({ "candidacy-gate": "ready" });
	});

	test("derives ready with every task box ticked, the boxes being unread", () => {
		const whole = complete("candidacy-gate");
		whole["openspec/changes/candidacy-gate/tasks.md"] = "- [x] 1.1 done\n";
		expect(boardState(fabricate(whole)).status["candidacy-gate"]).toBe("ready");
	});
});

// spec: task-board/a-change-directory-missing-an-artefact
describe("a change directory missing one artefact", () => {
	for (const artefact of ["proposal.md", "design.md", "tasks.md"]) {
		test(`derives proposing without ${artefact}`, () => {
			const tree = fabricate(without("candidacy-gate", artefact));
			expect(boardState(tree).status["candidacy-gate"]).toBe("proposing");
		});
	}
});

// spec: task-board/a-change-directory-whose-specs-is-empty
describe("a change directory whose specs/ holds no delta", () => {
	test("derives proposing where the directory is empty", () => {
		const whole = without("candidacy-gate", "specs/a-capability/spec.md");
		whole["openspec/changes/candidacy-gate/specs/"] = "";
		expect(boardState(fabricate(whole)).status["candidacy-gate"]).toBe(
			"proposing",
		);
	});

	test("derives proposing where the directory is absent", () => {
		const tree = fabricate(
			without("candidacy-gate", "specs/a-capability/spec.md"),
		);
		expect(boardState(tree).status["candidacy-gate"]).toBe("proposing");
	});

	test("derives proposing where the directory holds no markdown", () => {
		const whole = without("candidacy-gate", "specs/a-capability/spec.md");
		whole["openspec/changes/candidacy-gate/specs/a-capability/notes.txt"] = "";
		expect(boardState(fabricate(whole)).status["candidacy-gate"]).toBe(
			"proposing",
		);
	});

	test("derives ready from a delta at any depth, the walk being recursive", () => {
		const whole = without("candidacy-gate", "specs/a-capability/spec.md");
		whole["openspec/changes/candidacy-gate/specs/a/deeper/spec.md"] = "";
		expect(boardState(fabricate(whole)).status["candidacy-gate"]).toBe("ready");
	});
});

// spec: task-board/an-archived-change
describe("a change the archive holds", () => {
	test("derives done", () => {
		const tree = fabricate(archived("2026-08-25", "repo-layout"));
		expect(boardState(tree).status).toEqual({ "repo-layout": "done" });
	});

	test("derives done though a directory for the slug also stands unapplied", () => {
		const tree = fabricate({
			...complete("repo-layout"),
			...archived("2026-08-25", "repo-layout"),
		});
		expect(boardState(tree).status["repo-layout"]).toBe("done");
	});

	test("derives done for its own slug and not for one the slug prefixes", () => {
		const tree = fabricate({
			...archived("2026-08-01", "archive"),
			...complete("archive-preflight"),
		});
		expect(boardState(tree).status).toEqual({
			archive: "done",
			"archive-preflight": "ready",
		});
	});

	test("an entry not named <date>-<slug> is reported, naming the directory", () => {
		const tree = fabricate({ "openspec/changes/archive/repo-layout/x.md": "" });
		expect(() => boardState(tree)).toThrow(/archive\/repo-layout/);
	});

	test("an entry whose date is not four-two-two is reported too", () => {
		// The case above carries no date at all, so nothing exercises the digit
		// counts: a looser `\d+` would still read `2026-8-25-x` as an archive
		// and derive `done` for a slug spelled `25-x`.
		const tree = fabricate({ "openspec/changes/archive/2026-8-25-x/p.md": "" });
		expect(() => boardState(tree)).toThrow(/2026-8-25-x/);
	});
});

// spec: task-board/a-slug-reported-at-no-status-at-all
// spec: task-board/a-status-the-tree-cannot-see
describe("what the derivation reports nothing for", () => {
	test("an empty changes directory derives nothing and is not an error", () => {
		const tree = fabricate({ "openspec/changes/": "" });
		expect(boardState(tree)).toEqual({ status: {}, edges: {} });
	});

	test("a tree with no changes directory at all does the same", () => {
		// Distinct from the case above, and reached by every run from a root
		// that is not a repository: absent and empty must not be told apart by
		// one throwing.
		expect(boardState(fabricate({ "README.md": "" }))).toEqual({
			status: {},
			edges: {},
		});
	});

	test("an archive directory holding nothing derives no done and reports nothing", () => {
		const tree = fabricate({
			...complete("candidacy-gate"),
			"openspec/changes/archive/": "",
		});
		expect(boardState(tree).status).toEqual({ "candidacy-gate": "ready" });
	});

	test("a plain file under changes/ is skipped rather than read as a change", () => {
		const tree = fabricate({
			...complete("candidacy-gate"),
			"openspec/changes/notes.md": "",
		});
		expect(Object.keys(boardState(tree).status)).toEqual(["candidacy-gate"]);
	});

	test("a slug the tree cannot see carries no key, rather than suggested", () => {
		const state = boardState(fabricate(complete("candidacy-gate")));
		expect(Object.hasOwn(state.status, "a-finding-nobody-proposed")).toBe(
			false,
		);
		expect(Object.values(state.status)).not.toContain("suggested");
	});

	test("no key carries any of the five statuses moved by hand", () => {
		const state = boardState(
			fabricate({
				...complete("candidacy-gate"),
				...archived("2026-08-25", "repo-layout"),
			}),
		);
		for (const hand of [
			"suggested",
			"exploring",
			"implementing",
			"reviewing",
			"archiving",
		])
			expect(Object.values(state.status)).not.toContain(hand);
	});
});

// spec: task-board/a-card-on-a-board-whose-tree-is-elsewhere
describe("the output names no board", () => {
	test("neither the board a slug sits on nor the two whose trees are elsewhere", () => {
		const state = boardState(fabricate(complete("candidacy-gate")));
		for (const board of ["D2ASS", "Harness", "mellon"])
			expect(JSON.stringify(state)).not.toContain(board);
	});
});

describe("a sweep over a whole tree", () => {
	test("gives every slug exactly one status, omitting none and doubling none", () => {
		const changes = Array.from({ length: 20 }, (_, n) => `open-${n}`);
		const archives = Array.from({ length: 30 }, (_, n) => `shipped-${n}`);
		const tree = fabricate(
			Object.assign(
				{},
				...changes.map((slug) => complete(slug)),
				...archives.map((slug) => archived("2026-08-25", slug)),
			),
		);
		const { status } = boardState(tree);
		expect(Object.keys(status).length).toBe(50);
		for (const slug of changes) expect(status[slug]).toBe("ready");
		for (const slug of archives) expect(status[slug]).toBe("done");
	});
});

// spec: task-board/the-derivation-reaches-no-network
describe("the derivation reaches no network", () => {
	const source = readFileSync(join(root, "scripts/board-state.ts"), "utf8");

	const imports = (text: string) =>
		[...text.matchAll(/^import .*? from "(.+)";$/gm)].flatMap(
			(match) => match[1] ?? [],
		);

	test("the module imports the filesystem, the path join, the root and nothing else", () => {
		const imported = imports(source);
		expect(imported.length).toBeGreaterThan(0);
		expect(
			imported.filter(
				(from) => !["node:fs", "node:path", "./root.ts"].includes(from),
			),
		).toEqual([]);
	});

	test("the one module it does import reaches nothing either", () => {
		// Allowing `./root.ts` above allows whatever `./root.ts` allows, and the
		// case above would pass a version of it that had grown a fetch.
		const from = readFileSync(join(root, "scripts/root.ts"), "utf8");
		expect(imports(from)).toEqual(["node:path"]);
	});

	test("it calls nothing that opens a socket", () => {
		// Token by token rather than by parse: a mention in prose would fail this
		// case wrongly, and the repair is to reword the comment. The direction
		// that passes wrongly is the one a parser would be bought to prevent.
		for (const reach of ["fetch(", "XMLHttpRequest", "Bun.connect", "notion"])
			expect(source).not.toContain(reach);
	});

	test("a full run produces both halves of the output from the tree alone", () => {
		const tree = fabricate({
			...complete(
				"score-calibration",
				"schema: spec-driven\nafter: [outcome-calibration]\n",
			),
			...archived("2026-08-25", "outcome-calibration"),
		});
		expect(boardState(tree)).toEqual({
			status: {
				"score-calibration": "ready",
				"outcome-calibration": "done",
			},
			edges: {
				"score-calibration": { after: ["outcome-calibration"], blocking: [] },
			},
		});
	});
});

describe("what may not reach the output, this repository being public", () => {
	test("no option identifier, board URL, view URL or bare UUID", () => {
		const emitted = JSON.stringify(boardState(root));
		for (const secret of [
			"collectionPropertyOption://",
			"collection://",
			"view://",
			"notion.so",
			"notion.com",
		])
			expect(emitted).not.toContain(secret);
		expect(emitted).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
	});
});
