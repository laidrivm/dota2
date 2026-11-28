/**
 * What the engine's test files build a case out of: a hand-built snapshot
 * small enough that every expected number is arithmetic, and the empty team
 * to vary from. One module, because a copy per file lets the shapes drift
 * while every file still passes.
 */
import type {
	HeroEntry,
	PickPhase,
	Role,
	SnapshotBundle,
} from "../../types.ts";
import type { Player, Team } from "./value.ts";

export const PHASES: Record<PickPhase, number> = {
	p1: 0.1,
	p2: 0.2,
	last: 0.4,
};

export const hero = (
	id: number,
	positions: Partial<Record<`${Role}`, number>>,
	over: Partial<HeroEntry> = {},
): HeroEntry => ({
	id,
	name: `Hero ${id}`,
	short: `hero${id}`,
	icon: "",
	aliases: [],
	sufficient: true,
	contest: 0.1,
	side: { radiant: 0, dire: 0 },
	phase: { p1: 0, p2: 0, last: 0 },
	positions: Object.fromEntries(
		Object.entries(positions).map(([role, meta]) => [
			role,
			{ share: 1 / Object.keys(positions).length, meta, sufficient: true },
		]),
	),
	...over,
});

/** Heroes 1–6 play every position at meta 0 unless a case says otherwise. */
export const everywhere = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
export const bundle = (
	heroes: HeroEntry[],
	extra: Partial<SnapshotBundle> = {},
) =>
	({
		heroes,
		matchups: {},
		synergies: {},
		...extra,
	}) as unknown as SnapshotBundle;

export const nobody: Player = { rank: null, signatures: [] };
export const team = (over: Partial<Team> = {}): Team => ({
	side: "radiant",
	players: [nobody, nobody, nobody, nobody, nobody],
	slots: [],
	...over,
});
