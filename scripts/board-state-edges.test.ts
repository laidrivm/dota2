/**
 * What each unapplied change is waiting on, read from the `after:` list in its
 * `.openspec.yaml`. Blocked is computed here every time it is asked for, so no
 * case stores it and none goes stale when its predecessor is archived.
 *
 * Beside `board-state.test.ts` rather than in it: the two together are over the
 * file cap, and this half is the one a reader opens with an ordering question.
 */
import { afterAll, describe, expect, test } from "bun:test";
import {
	archived,
	cleanup,
	complete,
	fabricate,
} from "./board-state.fixture.ts";
import { boardState } from "./board-state.ts";

afterAll(cleanup);

/** A change whose `.openspec.yaml` carries `after`, written as `yaml` says. */
const ordered = (slug: string, after: string) =>
	complete(slug, `schema: spec-driven\nafter: ${after}\n`);

// spec: task-board/a-change-whose-predecessor-has-not-landed
describe("a predecessor that has not landed", () => {
	test("blocks the change, naming the slug that blocks it", () => {
		const tree = fabricate({
			...ordered("score-calibration", "[outcome-calibration]"),
			...complete("outcome-calibration"),
		});
		expect(boardState(tree).edges["score-calibration"]).toEqual({
			after: ["outcome-calibration"],
			blocking: ["outcome-calibration"],
		});
	});

	test("a predecessor at proposing blocks as one at ready does", () => {
		const half = complete("outcome-calibration");
		delete half["openspec/changes/outcome-calibration/tasks.md"];
		const tree = fabricate({
			...ordered("score-calibration", "[outcome-calibration]"),
			...half,
		});
		expect(boardState(tree).edges["score-calibration"]?.blocking).toEqual([
			"outcome-calibration",
		]);
	});

	test("only the predecessors that have not landed are named", () => {
		const tree = fabricate({
			...ordered("beta-refit", "[hero-aliases-seed, outcome-calibration]"),
			...complete("hero-aliases-seed"),
			...archived("2026-08-25", "outcome-calibration"),
		});
		expect(boardState(tree).edges["beta-refit"]).toEqual({
			after: ["hero-aliases-seed", "outcome-calibration"],
			blocking: ["hero-aliases-seed"],
		});
	});
});

// spec: task-board/a-change-whose-predecessors-have-all-landed
describe("predecessors that have all landed", () => {
	test("report the change takeable and leave the after: list standing", () => {
		const tree = fabricate({
			...ordered("score-calibration", "[outcome-calibration]"),
			...archived("2026-08-25", "outcome-calibration"),
		});
		expect(boardState(tree).edges["score-calibration"]).toEqual({
			after: ["outcome-calibration"],
			blocking: [],
		});
	});
});

// spec: task-board/a-change-with-no-ordering-constraint
describe("a change naming no predecessor", () => {
	test("an absent after: key reports takeable rather than malformed", () => {
		const tree = fabricate(complete("focus-restore-idiom"));
		expect(boardState(tree).edges["focus-restore-idiom"]).toEqual({
			after: [],
			blocking: [],
		});
	});

	test("an absent .openspec.yaml reports takeable rather than malformed", () => {
		const whole = complete("focus-restore-idiom");
		delete whole["openspec/changes/focus-restore-idiom/.openspec.yaml"];
		expect(boardState(fabricate(whole)).edges["focus-restore-idiom"]).toEqual({
			after: [],
			blocking: [],
		});
	});

	test("an empty after: list reports takeable", () => {
		const tree = fabricate(ordered("focus-restore-idiom", "[]"));
		expect(boardState(tree).edges["focus-restore-idiom"]?.blocking).toEqual([]);
	});

	test("an empty .openspec.yaml reports takeable rather than malformed", () => {
		// YAML parses an empty document to `null`, which is neither a mapping
		// carrying no `after:` nor a shape worth reporting.
		expect(
			boardState(fabricate(complete("focus-restore-idiom", ""))).edges[
				"focus-restore-idiom"
			],
		).toEqual({ after: [], blocking: [] });
	});
});

describe("what carries no edges at all", () => {
	test("an archived slug gets no key, its ordering being spent", () => {
		const tree = fabricate({
			...ordered("score-calibration", "[outcome-calibration]"),
			...archived("2026-08-25", "outcome-calibration"),
		});
		const { edges } = boardState(tree);
		expect(Object.hasOwn(edges, "outcome-calibration")).toBe(false);
		expect(Object.keys(edges)).toEqual(["score-calibration"]);
	});
});

// spec: task-board/an-after-naming-a-slug-that-does-not-exist
describe("an after: naming a slug the tree does not hold", () => {
	test("fails naming the slug and the file, rather than reading it as landed", () => {
		const tree = fabricate(
			ordered("score-calibration", "[outcome-calibraton]"),
		);
		expect(() => boardState(tree)).toThrow(/outcome-calibraton/);
		expect(() => boardState(tree)).toThrow(
			/openspec\/changes\/score-calibration\/\.openspec\.yaml/,
		);
	});

	test("an archived slug resolves, the archive being where landed work sits", () => {
		const tree = fabricate({
			...ordered("score-calibration", "[outcome-calibration]"),
			...archived("2026-08-25", "outcome-calibration"),
		});
		expect(() => boardState(tree)).not.toThrow();
	});
});

// spec: task-board/an-after-that-is-not-a-list
describe("an after: that is not a list", () => {
	test("a bare string fails naming the file, and its characters are not walked", () => {
		const tree = fabricate(ordered("score-calibration", "outcome-calibration"));
		let said = "";
		try {
			boardState(tree);
		} catch (error) {
			said = error instanceof Error ? error.message : String(error);
		}
		expect(said).toContain("openspec/changes/score-calibration/.openspec.yaml");
		expect(said).toContain("bare string");
		// The characters a walk would have yielded, each of which would then be
		// reported as a slug naming nothing — a typo in a file whose real defect
		// is its shape.
		expect(said).not.toContain(" o,");
		expect(said).not.toMatch(/names o\b/);
	});

	test("a mapping fails naming the file", () => {
		const tree = fabricate(
			complete(
				"score-calibration",
				"schema: spec-driven\nafter:\n  outcome-calibration: true\n",
			),
		);
		expect(() => boardState(tree)).toThrow(
			/score-calibration\/\.openspec\.yaml/,
		);
	});

	test("a list holding something that is not a slug fails naming the file", () => {
		const tree = fabricate(ordered("score-calibration", "[7]"));
		expect(() => boardState(tree)).toThrow(
			/score-calibration\/\.openspec\.yaml/,
		);
	});

	test("a file that is not YAML at all fails naming the file", () => {
		const tree = fabricate(
			complete("score-calibration", "after: [a\n  - unclosed: {\n"),
		);
		// "not YAML" as well as the path: every other case in this block also
		// throws naming that file, so the path alone would pass on a parse that
		// succeeded and failed further down for a different reason.
		expect(() => boardState(tree)).toThrow(
			/score-calibration\/\.openspec\.yaml: not YAML/,
		);
	});
});

describe("more than one defect in one tree", () => {
	test("every problem is reported, not only the first the sweep reaches", () => {
		const tree = fabricate({
			...ordered("score-calibration", "[a-slug-that-is-nowhere]"),
			...ordered("beta-refit", "outcome-calibration"),
			"openspec/changes/archive/not-a-dated-name/p.md": "",
		});
		let said = "";
		try {
			boardState(tree);
		} catch (error) {
			said = error instanceof Error ? error.message : String(error);
		}
		// Three unrelated defects: a throw at the first would report one and
		// send the reader back for the other two a run at a time.
		expect(said).toContain("a-slug-that-is-nowhere");
		expect(said).toContain("bare string");
		expect(said).toContain("not-a-dated-name");
	});
});

describe("an ordering that contradicts itself", () => {
	test("a change named in its own after: is reported rather than left blocked", () => {
		const tree = fabricate(ordered("score-calibration", "[score-calibration]"));
		expect(() => boardState(tree)).toThrow(/score-calibration/);
	});

	test("a two-change cycle is reported, naming both", () => {
		const tree = fabricate({
			...ordered("laning-phase-model", "[suggestion-calibration]"),
			...ordered("suggestion-calibration", "[laning-phase-model]"),
		});
		let said = "";
		try {
			boardState(tree);
		} catch (error) {
			said = error instanceof Error ? error.message : String(error);
		}
		expect(said).toContain("laning-phase-model");
		expect(said).toContain("suggestion-calibration");
		// Once, from whichever member the sweep reaches first: a cycle reported
		// once per member reads as two arguments rather than as one.
		expect(
			said.split("\n").filter((line) => line.includes("cycle")).length,
		).toBe(1);
	});
});
