/** The CM order table, read the way the board reads it. */
import { expect, test } from "bun:test";
import { ORDER, stepAt } from "./order.ts";

test("the order is 24 steps: 7 bans and 5 picks for each team", () => {
	expect(ORDER).toHaveLength(24);
	for (const first of [true, false]) {
		const own = ORDER.filter((step) => step.first === first);
		expect(own.filter((step) => step.action === "ban")).toHaveLength(7);
		expect(own.filter((step) => step.action === "pick")).toHaveLength(5);
	}
});

test("the steps follow the spec's table", () => {
	const written = ORDER.map((s) => `${s.action[0]}${s.first ? "A" : "B"}`);
	expect(written.join(" ")).toBe(
		"bA bA bB bB bA bB bB pA pB bA bA bB pB pA pA pB pB pA bA bB bA bB pA pB",
	);
});

// spec: cm-draft/the-order-from-the-second-pick
test("picking second, step 3 is the captain's ban and 1, 2 and 5 the enemy's", () => {
	expect(stepAt(2, "second")).toEqual({ action: "ban", team: "ours" });
	for (const index of [0, 1, 4])
		expect(stepAt(index, "second")).toEqual({ action: "ban", team: "theirs" });
	expect(stepAt(0, "first")).toEqual({ action: "ban", team: "ours" });
});

test("there is no step after the 24th", () => {
	expect(stepAt(23, "first")).toEqual({ action: "pick", team: "theirs" });
	expect(stepAt(24, "first")).toBeNull();
	expect([ORDER[0]?.step, ORDER[23]?.step]).toEqual([1, 24]);
});
