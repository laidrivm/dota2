/**
 * The draft read into two valued teams: each step's hero goes to the team the
 * order gives it, and each team's picks are placed on positions by the
 * assignment worth most (cm-model, *Heroes are assigned to the positions that
 * maximise the team*).
 */
import { roleAssignments } from "../../model-terms.ts";
import type {
	HeroEntry,
	HeroId,
	Role,
	Side,
	SnapshotBundle,
} from "../../types.ts";
import { type PickOrder, stepAt, type Team as TeamName } from "./order.ts";
import {
	comfort,
	metaAt,
	type Player,
	rankWeight,
	type Slot,
	type Team,
	teamValue,
} from "./value.ts";

/** A player as the roster gives them: the page's own type satisfies it. */
export interface Rostered extends Player {
	position: Role | null;
}

/** What the engine reads of the page's session. */
export interface DraftState {
	/** The captain's team's side; the enemy's is the other. */
	side: Side;
	pickOrder: PickOrder;
	steps: readonly HeroId[];
	ours: readonly Rostered[];
	theirs: readonly Rostered[];
}

/**
 * `picks` placed on positions by the assignment worth most to the team.
 *
 * The placement weighs each slot's rank-weighted meta and signature comfort
 * only: side, phase and synergy do not depend on positions, and matchups
 * would make each team's placement wait on the other's. A position's player
 * is the one whose known position it is; a position nobody holds is valued
 * with no player — weight 1, no signature.
 */
export function assignTeam(
	bundle: SnapshotBundle,
	picks: readonly HeroId[],
	roster: readonly Rostered[],
): Slot[] {
	const byId = new Map(bundle.heroes.map((hero) => [hero.id, hero]));
	const holder = (position: Role) =>
		roster.find((player) => player.position === position) ?? null;
	const worth = (hero: HeroEntry | undefined, position: Role) => {
		if (hero === undefined) return 0;
		const player = holder(position);
		return (
			rankWeight(player, roster) *
			(metaAt(hero, position) + comfort(player, hero.id))
		);
	};

	// Stryker disable next-line ArrayDeclaration: the first placement always replaces it — roleAssignments yields one even for no picks, and any worth beats -Infinity
	let best: Role[] = [];
	let bestWorth = Number.NEGATIVE_INFINITY;
	// The first placement wins a tie, so the same draft always reads the same.
	for (const placement of roleAssignments(picks.length)) {
		let total = 0;
		placement.forEach((position, i) => {
			total += worth(byId.get(picks[i] as HeroId), position);
		});
		if (total > bestWorth) {
			best = placement;
			bestWorth = total;
		}
	}
	return picks.map((hero, i) => {
		const position = best[i] as Role;
		return { hero, position, player: holder(position) };
	});
}

/** Each team's picks so far, in the order it made them. */
export function picksOf(state: DraftState): Record<TeamName, HeroId[]> {
	const picks: Record<TeamName, HeroId[]> = { ours: [], theirs: [] };
	state.steps.forEach((hero, index) => {
		const at = stepAt(index, state.pickOrder);
		// Stryker disable next-line OptionalChaining: steps hold at most 24 heroes — reduce and parseSession cap them — so stepAt never answers null here
		if (at?.action === "pick") picks[at.team].push(hero);
	});
	return picks;
}

const other = (side: Side): Side => (side === "radiant" ? "dire" : "radiant");

/** Both teams as `teamValue` reads them, each assigned. */
export function teamsOf(
	bundle: SnapshotBundle,
	state: DraftState,
	picks = picksOf(state),
): { ours: Team; theirs: Team } {
	return {
		ours: {
			side: state.side,
			players: state.ours,
			slots: assignTeam(bundle, picks.ours, state.ours),
		},
		theirs: {
			side: other(state.side),
			players: state.theirs,
			slots: assignTeam(bundle, picks.theirs, state.theirs),
		},
	};
}

/** Each team's value against the other, from a pair `teamsOf` built. */
export const valued = (
	bundle: SnapshotBundle,
	teams: { ours: Team; theirs: Team },
) => ({
	ours: teamValue(bundle, teams.ours, teams.theirs.slots),
	theirs: teamValue(bundle, teams.theirs, teams.ours.slots),
});
