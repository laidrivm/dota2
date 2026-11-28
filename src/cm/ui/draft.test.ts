/**
 * The draft's steps in the CM session: what entering a hero and undoing one
 * leave behind, step by step through the Captains Mode order.
 */
import { describe, expect, test } from "bun:test";
import {
	type CmSession,
	emptySession,
	parseSession,
	reduce,
	stepInProgress,
	takenAt,
} from "./session.ts";

const PUDGE = 14;
const LION = 26;

const setUp = (pickOrder: "first" | "second" = "first"): CmSession =>
	reduce(reduce(emptySession(), { type: "side", side: "radiant" }), {
		type: "pickOrder",
		pickOrder,
	});

/** `session` after entering `count` more heroes, each new to the draft. */
const entered = (session: CmSession, count: number): CmSession =>
	Array.from(
		{ length: count },
		(_, i) => 101 + session.steps.length + i,
	).reduce((s, hero) => reduce(s, { type: "enter", hero }), session);

describe("entering heroes", () => {
	test("a hero fills the step in progress and moves it on", () => {
		const once = reduce(setUp(), { type: "enter", hero: PUDGE });
		expect(once.steps).toEqual([PUDGE]);
		expect(stepInProgress(once)).toEqual({
			step: 2,
			action: "ban",
			team: "ours",
		});
	});

	test("nothing is entered before the side and pick order are set", () => {
		const sided = reduce(emptySession(), { type: "side", side: "dire" });
		expect(reduce(sided, { type: "enter", hero: PUDGE })).toBe(sided);
		expect(stepInProgress(sided)).toBeNull();
	});

	// spec: cm-draft/a-banned-hero-offered-again
	test("a hero banned at step 2 is taken at step 8, and entering it changes nothing", () => {
		const banned = reduce(entered(setUp(), 1), { type: "enter", hero: PUDGE });
		const atEight = entered(banned, 5);
		expect(stepInProgress(atEight)?.step).toBe(8);
		expect(takenAt(atEight, PUDGE)).toBe(2);
		expect(reduce(atEight, { type: "enter", hero: PUDGE })).toBe(atEight);
	});

	// spec: cm-draft/the-order-from-the-second-pick
	test("after step 24 the draft is complete and takes no hero", () => {
		const done = entered(setUp("second"), 24);
		expect(done.steps).toHaveLength(24);
		expect(stepInProgress(done)).toBeNull();
		expect(reduce(done, { type: "enter", hero: PUDGE })).toBe(done);
	});

	test("the setup is fixed once a step is entered", () => {
		const once = reduce(setUp(), { type: "enter", hero: PUDGE });
		expect(reduce(once, { type: "side", side: "dire" })).toBe(once);
		expect(reduce(once, { type: "pickOrder", pickOrder: "second" })).toBe(once);
		const undone = reduce(once, { type: "undo" });
		expect(reduce(undone, { type: "side", side: "dire" }).side).toBe("dire");
	});
});

describe("undoing", () => {
	test("undo walks from step 24 back to 1 through every earlier state", () => {
		const states = Array.from({ length: 25 }, (_, n) => entered(setUp(), n));
		let session = states[24] as CmSession;
		for (let n = 23; n >= 0; n--) {
			session = reduce(session, { type: "undo" });
			expect(session).toEqual(states[n] as CmSession);
		}
		expect(reduce(session, { type: "undo" })).toBe(session);
	});

	// spec: cm-draft/undoing-a-pick
	test("undoing step 9 makes it the step in progress and its hero enterable", () => {
		const nine = reduce(entered(setUp(), 8), { type: "enter", hero: LION });
		const undone = reduce(nine, { type: "undo" });
		expect(stepInProgress(undone)?.step).toBe(9);
		expect(takenAt(undone, LION)).toBeNull();
		expect(undone.ours).toBe(nine.ours);
		expect(undone.pickOrder).toBe("first");
	});
});

describe("a stored draft", () => {
	test("round-trips through JSON", () => {
		const session = entered(setUp(), 11);
		expect(parseSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
	});

	test.each([
		["a hero entered twice", [PUDGE, PUDGE]],
		["25 steps", Array.from({ length: 25 }, (_, i) => i + 1)],
		["a step with no setup", [PUDGE]],
	])("with %s falls back to empty", (name, steps) => {
		const base = name === "a step with no setup" ? emptySession() : setUp();
		expect(parseSession({ ...base, steps })).toEqual(emptySession());
	});
});
