/**
 * The Captains Mode draft order (cm-draft, *The draft follows the Captains
 * Mode order*): 24 steps, each a ban or a pick by team A — the team that picks
 * first — or team B. The table reads as the spec's does, row by row.
 */

export type PickOrder = "first" | "second";
export type Team = "ours" | "theirs";
export type StepAction = "ban" | "pick";

const TABLE = [
	["ban", "A A B B A B B"],
	["pick", "A B"],
	["ban", "A A B"],
	["pick", "B A A B B A"],
	["ban", "A B A B"],
	["pick", "A B"],
] as const;

/** Every step in order, `ORDER[0]` being step 1. */
export const ORDER: readonly { action: StepAction; first: boolean }[] =
	TABLE.flatMap(([action, teams]) =>
		teams.split(" ").map((slot) => ({ action, first: slot === "A" })),
	);

/** Step `index` (0-based) as the captain sees it: whose it is, and what. */
export function stepAt(
	index: number,
	pickOrder: PickOrder,
): { action: StepAction; team: Team } | null {
	const step = ORDER[index];
	if (step === undefined) return null;
	const ours = step.first === (pickOrder === "first");
	return { action: step.action, team: ours ? "ours" : "theirs" };
}
